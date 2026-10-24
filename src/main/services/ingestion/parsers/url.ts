import { lookup } from "node:dns/promises";
import type { ParseResult } from "./index";
import {
  SsrfError,
  assertResolvedIpAllowed,
  assertSafeUrl,
} from "./ssrf-guard";
import { SIZE_LIMITS } from "../size-limits";

// Fetch + trích nội dung chính từ URL (FR-004/019, A6). CHỈ ở main. Chặn SSRF mỗi hop redirect.
// Adapter thư viện (jsdom/readability) — HTML→văn bản thuần ở url-text.ts (150, đã test) — loại khỏi ngưỡng coverage; SSRF logic đã test ở ssrf-guard.

const MAX_REDIRECTS = 5;

async function safeFetch(rawUrl: string): Promise<Response> {
  let target = rawUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const u = assertSafeUrl(target);
    const host = u.hostname.replace(/^\[|\]$/g, "");
    // Phân giải DNS + kiểm IP thực tế mỗi hop (chống DNS-rebinding tới IP nội bộ).
    if (!/^[\d.]+$/.test(host) && !host.includes(":")) {
      const { address } = await lookup(host);
      assertResolvedIpAllowed(address);
    }
    const res = await fetch(u, {
      redirect: "manual",
      headers: { "user-agent": "SourceCraft/1.0 (local)" },
    });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) return res;
      target = new URL(loc, u).toString();
      continue;
    }
    return res;
  }
  throw new SsrfError("Too many redirects.");
}

/** Đọc body theo stream, cắt NGAY khi vượt `cap` (tránh buffer toàn bộ response độc hại vào RAM). */
async function readBodyCapped(res: Response, cap: number): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) {
    const buf = await res.arrayBuffer();
    if (buf.byteLength > cap)
      throw new Error("Web page exceeds the size limit.");
    return new TextDecoder().decode(buf);
  }
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > cap) {
      await reader.cancel();
      throw new Error("Web page exceeds the size limit.");
    }
    chunks.push(value);
  }
  const merged = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    merged.set(c, off);
    off += c.byteLength;
  }
  return new TextDecoder().decode(merged);
}

export async function fetchAndParseUrl(rawUrl: string): Promise<ParseResult> {
  const res = await safeFetch(rawUrl);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  // Fast-path: từ chối sớm nếu Content-Length đã báo vượt; rồi đọc stream có cắt ngưỡng.
  const declared = Number(res.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > SIZE_LIMITS.url) {
    throw new Error("Web page exceeds the size limit.");
  }
  const html = await readBodyCapped(res, SIZE_LIMITS.url);

  const { JSDOM } = await import("jsdom");
  const { Readability } = await import("@mozilla/readability");
  const { articleHtmlToText } = await import("./url-text");

  const dom = new JSDOM(html, { url: rawUrl });
  const article = new Readability(dom.window.document).parse();
  if (!article || !article.content) {
    throw new Error("Could not extract the main content of the page.");
  }
  // 150: chỉ giữ chữ (bỏ cú pháp liên kết/ảnh/dấu chú thích) — văn bản chính tắc cho locator.
  const text = articleHtmlToText(article.content);

  return {
    pageCount: null,
    title: article.title ?? undefined,
    pages: [{ page: null, text }],
  };
}
