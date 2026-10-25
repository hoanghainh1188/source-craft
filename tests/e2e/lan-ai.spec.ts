import { test, expect } from "@playwright/test";
import type { AddressInfo } from "node:net";
import { createServer, type Server } from "node:http";
import { mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { launchFresh, dismissOnboarding } from "./helper";

// #228 follow-up — bật LAN AI ⇒ câu hỏi THẬT SỰ đi tới máy chủ LAN (không phải Ollama cục bộ), badge "lan" khớp hành vi;
// "Trả lời bằng AI cục bộ" (098, target local) vẫn là Ollama; tắt LAN ⇒ về Ollama + badge local. Hai máy chủ giả HTTP:
// "Ollama cục bộ" (OLLAMA_HOST) và "máy chủ LAN" (127.0.0.1 — qua SSRF guard như loopback).

interface FakeServer {
  server: Server;
  url: string;
  chats: number;
  auth: (string | undefined)[];
}

async function fakeOllama(answer: string): Promise<FakeServer> {
  const fake: FakeServer = {
    server: undefined as unknown as Server,
    url: "",
    chats: 0,
    auth: [],
  };
  fake.server = createServer((req, res) => {
    res.setHeader("content-type", "application/json");
    if (req.url === "/api/show") {
      res.statusCode = 404;
      res.end("{}");
      return;
    }
    if (req.url !== "/api/chat") {
      res.end(JSON.stringify({ models: [{ name: "fake:1b", size: 1 }] }));
      return;
    }
    fake.chats += 1;
    fake.auth.push(req.headers["authorization"]);
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      const parsed = JSON.parse(body) as { stream?: boolean };
      const msg = { message: { content: `${answer} [1]` }, done: true };
      if (parsed.stream) res.setHeader("content-type", "application/x-ndjson");
      res.end(JSON.stringify(msg) + (parsed.stream ? "\n" : ""));
    });
  });
  await new Promise<void>((r) => fake.server.listen(0, "127.0.0.1", r));
  fake.url = `http://127.0.0.1:${(fake.server.address() as AddressInfo).port}`;
  return fake;
}

test.setTimeout(90_000);

test("LAN AI bật ⇒ hỏi đáp đi qua máy chủ LAN, badge lan; target local vẫn Ollama; tắt ⇒ về Ollama", async () => {
  const local = await fakeOllama("TỪ-CỤC-BỘ");
  const lan = await fakeOllama("TỪ-LAN");
  const app = await launchFresh({ OLLAMA_HOST: local.url });
  try {
    const win = await app.firstWindow();
    await dismissOnboarding(win);

    const dir = await mkdtemp(join(tmpdir(), "iv-lan-"));
    const file = join(dir, "nguon.txt");
    await writeFile(file, "Phở là món ăn truyền thống của Việt Nam.");
    const nbId = await win.evaluate(async (f) => {
      await window.api.aiSetSelectedModels({
        chatModel: "fake:1b",
        embeddingModel: null,
      });
      const nb = await window.api.notebookCreate({
        name: "LAN",
        color: "#1E6B57",
      });
      await window.api.sourceAdd({
        notebookId: nb.id,
        kind: "txt",
        filePath: f,
      });
      return nb.id;
    }, file);
    await expect
      .poll(
        () =>
          win.evaluate(
            async (id) =>
              (await window.api.sourceListByNotebook(id)).filter(
                (s) => s.status === "ready",
              ).length,
            nbId,
          ),
        { timeout: 30_000 },
      )
      .toBe(1);

    const ask = (target: "active" | "local") =>
      win.evaluate(
        async ([id, t]) =>
          (
            await window.api.ragAsk({
              notebookId: id,
              question: "Phở là gì?",
              mode: "open",
              history: [],
              target: t,
            })
          ).answer,
        [nbId, target] as const,
      );

    // Bật LAN (bản e2e mặc định tầng enterprise).
    await win.evaluate(
      (url) =>
        window.api.saveLanAiConfig({
          enabled: true,
          provider: "lan-ollama",
          baseUrl: url,
          chatModel: "fake:1b",
          token: "lan-secret",
        }),
      lan.url,
    );
    await expect
      .poll(() => win.evaluate(() => window.api.getPrivacyState()))
      .toMatchObject({ mode: "lan" });

    const localBefore = local.chats;
    expect(await ask("active")).toContain("TỪ-LAN");
    expect(lan.chats).toBeGreaterThan(0);
    expect(local.chats).toBe(localBefore);
    expect(lan.auth.every((a) => a === "Bearer lan-secret")).toBe(true);

    // 098: "Trả lời bằng AI cục bộ" KHÔNG bao giờ ra LAN.
    const lanBefore = lan.chats;
    expect(await ask("local")).toContain("TỪ-CỤC-BỘ");
    expect(lan.chats).toBe(lanBefore);

    // Tắt LAN ⇒ badge local + câu trả lời từ Ollama cục bộ.
    await win.evaluate(() =>
      window.api.saveLanAiConfig({
        enabled: false,
        provider: "lan-ollama",
        baseUrl: "",
        chatModel: null,
      }),
    );
    await expect
      .poll(() => win.evaluate(() => window.api.getPrivacyState()))
      .toMatchObject({ mode: "local" });
    expect(await ask("active")).toContain("TỪ-CỤC-BỘ");
    expect(lan.chats).toBe(lanBefore);
  } finally {
    await app.close();
    local.server.close();
    lan.server.close();
  }
});
