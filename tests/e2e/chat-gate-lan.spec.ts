import { test, expect } from "@playwright/test";
import type { AddressInfo } from "node:net";
import { createServer, type Server } from "node:http";
import { mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { launchFresh, dismissOnboarding } from "./helper";

// Máy chỉ có máy chủ LAN của tổ chức (KHÔNG có Ollama cục bộ) ⇒ cột Chat không chặn, gửi câu hỏi qua giao diện và nhận
// câu trả lời từ LAN. "Ollama cục bộ" trỏ vào một cổng đã đóng.

async function fakeLan(
  answer: string,
): Promise<{ server: Server; url: string; chats: () => number }> {
  let chats = 0;
  const server = createServer((req, res) => {
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
    chats += 1;
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      const parsed = JSON.parse(body) as { stream?: boolean };
      const msg = { message: { content: `${answer} [1]` }, done: true };
      if (parsed.stream) res.setHeader("content-type", "application/x-ndjson");
      res.end(JSON.stringify(msg) + (parsed.stream ? "\n" : ""));
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  return {
    server,
    url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
    chats: () => chats,
  };
}

/** Cổng localhost chắc chắn không có ai nghe (mở rồi đóng ngay). */
async function closedPortUrl(): Promise<string> {
  const s = createServer();
  await new Promise<void>((r) => s.listen(0, "127.0.0.1", r));
  const { port } = s.address() as AddressInfo;
  await new Promise<void>((r) => s.close(() => r()));
  return `http://127.0.0.1:${port}`;
}

test.setTimeout(90_000);

test("chỉ có LAN AI (không Ollama cục bộ) ⇒ Chat không chặn, hỏi qua giao diện nhận câu trả lời từ LAN", async () => {
  const lan = await fakeLan("TỪ-LAN");
  const app = await launchFresh({ OLLAMA_HOST: await closedPortUrl() });
  try {
    const win = await app.firstWindow();
    await dismissOnboarding(win);

    const dir = await mkdtemp(join(tmpdir(), "iv-lan-gate-"));
    const file = join(dir, "nguon.txt");
    await writeFile(file, "Phở là món ăn truyền thống của Việt Nam.");
    const nbId = await win.evaluate(
      async ([f, url]) => {
        await window.api.saveLanAiConfig({
          enabled: true,
          provider: "lan-ollama",
          baseUrl: url,
          chatModel: "fake:1b",
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
      },
      [file, lan.url] as const,
    );
    await expect
      .poll(() => win.evaluate(() => window.api.getPrivacyState()))
      .toMatchObject({ mode: "lan" });
    await expect
      .poll(
        () =>
          win.evaluate(
            async (id) =>
              (await window.api.sourceListByNotebook(id))[0]?.status,
            nbId,
          ),
        { timeout: 30_000 },
      )
      .toBe("ready");

    // Ollama cục bộ thật sự không chạy; provider đang bật (LAN) sẵn sàng.
    const status = await win.evaluate(() => window.api.aiGetRuntimeStatus());
    expect(status).toMatchObject({
      ollamaReady: false,
      activeProviderId: "lan-ollama",
      activeReady: true,
    });

    await win.evaluate((id) => {
      window.location.hash = `#/workspace/${id}`;
    }, nbId);
    await expect(win.getByTestId("chat-block")).toHaveCount(0);
    await win.getByTestId("chat-input").fill("Phở là gì?");
    await win.getByTestId("chat-send").click();
    await expect(win.getByTestId("chat-thread")).toContainText("TỪ-LAN", {
      timeout: 20_000,
    });
    expect(lan.chats()).toBeGreaterThan(0);
  } finally {
    await app.close();
    lan.server.close();
  }
});
