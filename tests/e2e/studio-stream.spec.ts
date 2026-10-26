import {
  test,
  expect,
  type ElectronApplication,
  type Page,
} from "@playwright/test";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import { createServer, type Server } from "node:http";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { launchFresh, dismissOnboarding } from "./helper";

// 178 (PR 4, T068, SC-006, FR-030..FR-045): stream lượt viết cuối + phạm vi nhiều nguồn, end-to-end với "Ollama" giả HTTP trả
// NDJSON chậm. Kiểm: chữ hiện dần, không [n] thô; chữ đầu tiên ≤ 2 s sau token đầu của bước viết; xong ⇒ chip; Huỷ giữa
// stream ⇒ chữ tạm biến mất, không phiên bản mới, server thấy kết nối đóng; cửa sổ thứ 2 KHÔNG nhận token; 2/4 nguồn ⇒ chip
// chỉ trỏ 2 nguồn.

interface Fake {
  server: Server;
  url: string;
  stats: { streams: number; closed: number; firstTokenAt: number | null };
  /** số mẩu + độ trễ giữa các mẩu của lượt stream kế tiếp */
  setStream: (s: { count: number; gapMs: number }) => void;
}

async function fakeOllama(): Promise<Fake> {
  const stats = {
    streams: 0,
    closed: 0,
    firstTokenAt: null as number | null,
  };
  let plan = { count: 6, gapMs: 250 };
  const server = createServer((req, res) => {
    if (req.url !== "/api/chat") {
      res.setHeader("content-type", "application/json");
      if (req.url === "/api/show") {
        res.statusCode = 404;
        res.end("{}");
        return;
      }
      res.end(JSON.stringify({ models: [{ name: "fake:1b", size: 1 }] }));
      return;
    }
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      const parsed = JSON.parse(body) as {
        stream?: boolean;
        messages: { content: string }[];
      };
      const user = parsed.messages[parsed.messages.length - 1].content;
      const ns = [
        ...new Set([...user.matchAll(/\[(\d+)\]/g)].map((m) => m[1])),
      ];
      const chips = ns.map((n) => `[${n}]`).join(" ");
      if (!parsed.stream) {
        res.setHeader("content-type", "application/json");
        res.end(
          JSON.stringify({ message: { content: `- ý chính [${ns[0] ?? 1}]` } }),
        );
        return;
      }
      // Bước viết (stream): mẩu chữ + mẩu chip cắt đôi "[1" / "]" để kiểm gỡ mẩu chưa đóng.
      stats.streams += 1;
      stats.firstTokenAt = null;
      res.setHeader("content-type", "application/x-ndjson");
      const pieces: string[] = [];
      for (let i = 0; i < plan.count; i += 1) {
        pieces.push(`Phở ngon ${i} `, `[${ns[0] ?? 1}`, "] ");
      }
      pieces.push(`Kết luận ${chips}.`);
      let i = 0;
      let timer: NodeJS.Timeout | undefined;
      const next = (): void => {
        if (i >= pieces.length) {
          res.end(
            JSON.stringify({ message: { content: "" }, done: true }) + "\n",
          );
          return;
        }
        if (stats.firstTokenAt === null) stats.firstTokenAt = Date.now();
        res.write(
          JSON.stringify({ message: { content: pieces[i] }, done: false }) +
            "\n",
        );
        i += 1;
        timer = setTimeout(next, plan.gapMs);
      };
      res.on("close", () => {
        if (!res.writableEnded) {
          stats.closed += 1;
          clearTimeout(timer);
        }
      });
      next();
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const { port } = server.address() as AddressInfo;
  return {
    server,
    url: `http://127.0.0.1:${port}`,
    stats,
    setStream: (s) => (plan = s),
  };
}

async function docs(n: number): Promise<string[]> {
  const dir = await mkdtemp(join(tmpdir(), "iv-178s-"));
  const files: string[] = [];
  for (let i = 0; i < n; i += 1) {
    const f = join(dir, `nguon-${i + 1}.txt`);
    await writeFile(
      f,
      `Nguồn ${i + 1}: phở là món ăn truyền thống của Việt Nam, nước dùng hầm xương ${i + 1} giờ.`,
    );
    files.push(f);
  }
  return files;
}

async function openNotebook(win: Page, files: string[]): Promise<string> {
  const nbId = await win.evaluate(async (fs) => {
    await window.api.aiSetSelectedModels({
      chatModel: "fake:1b",
      embeddingModel: null,
    });
    const nb = await window.api.notebookCreate({
      name: "Stream",
      color: "#1E6B57",
    });
    for (const f of fs) {
      await window.api.sourceAdd({
        notebookId: nb.id,
        kind: "txt",
        filePath: f,
      });
    }
    return nb.id;
  }, files);
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
    .toBe(files.length);
  await win.evaluate((id) => {
    window.location.hash = `#/workspace/${id}`;
  }, nbId);
  return nbId;
}

const versionsOf = (win: Page, nbId: string, kind: string) =>
  win.evaluate(
    async ([id, k]) =>
      (await window.api.studioList(id)).filter((r) => r.kind === k),
    [nbId, kind] as const,
  );

async function openSecondWindow(app: ElectronApplication): Promise<Page> {
  const pending = app.waitForEvent("window");
  // Cùng preload + ranh giới bảo mật như cửa sổ chính (src/main/index.ts createWindow).
  const preload = join(process.cwd(), "out/preload/index.cjs");
  await app.evaluate(async ({ BrowserWindow }, preloadPath) => {
    const [first] = BrowserWindow.getAllWindows();
    const w = new BrowserWindow({
      show: false,
      webPreferences: {
        preload: preloadPath,
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
      },
    });
    await w.loadURL(first!.webContents.getURL());
  }, preload);
  return pending;
}

test.setTimeout(120_000);

test("178 PR 4 — stream lượt viết: hiện dần không [n], ≤ 2 s, chip khi xong; Huỷ giữa stream; chỉ cửa sổ gọi nhận; 2/4 nguồn", async ({}, testInfo) => {
  const fake = await fakeOllama();
  const app = await launchFresh({ OLLAMA_HOST: fake.url });
  try {
    const win = await app.firstWindow();
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0]!.setSize(900, 760),
    );
    await dismissOnboarding(win);
    const nbId = await openNotebook(win, await docs(4));

    // Cửa sổ thứ 2 lắng nghe studio:streamToken — KHÔNG được nhận gì (kênh chỉ về sender).
    const other = await openSecondWindow(app);
    await other.waitForFunction(
      () => typeof window.api?.onStudioStreamToken === "function",
    );
    await other.evaluate(() => {
      const w = window as unknown as { __got: string[] };
      w.__got = [];
      window.api.onStudioStreamToken((e) => w.__got.push(e.delta));
    });

    // Đối chứng dương: cửa sổ gọi đăng ký listener cùng cách ⇒ PHẢI nhận token.
    await win.evaluate(() => {
      const w = window as unknown as { __got: string[] };
      w.__got = [];
      window.api.onStudioStreamToken((e) => w.__got.push(e.delta));
    });

    // (1) Stream: chữ hiện dần, không [n] thô, ≤ 2 s sau token đầu của bước viết; xong ⇒ chip.
    fake.setStream({ count: 6, gapMs: 300 });
    const btn = win.getByTestId("studio-btn-summary");
    await expect(btn).toBeEnabled({ timeout: 15_000 });
    await btn.click();
    const stream = win.getByTestId("studio-stream-summary");
    await expect
      .poll(() => fake.stats.firstTokenAt, { timeout: 15_000 })
      .not.toBeNull();
    await expect(stream).toBeVisible({ timeout: 2_000 });
    const firstSeen = Date.now();
    expect(firstSeen - fake.stats.firstTokenAt!).toBeLessThanOrEqual(2_000);
    const seen: string[] = [];
    for (let i = 0; i < 6; i += 1) {
      const t = await stream.innerText().catch(() => "");
      if (t) seen.push(t);
      await win.waitForTimeout(250);
    }
    expect(seen.length).toBeGreaterThan(1);
    expect(seen[seen.length - 1].length).toBeGreaterThan(seen[0].length);
    for (const t of seen) expect(t).not.toMatch(/\[\d|\d\]/);
    expect(await stream.locator(".cite").count()).toBe(0);
    await win
      .getByTestId("studio-col")
      .screenshot({ path: testInfo.outputPath("studio-stream-vi.png") });
    const card = win.getByTestId("studio-card-summary");
    await expect(card).toBeVisible({ timeout: 30_000 });
    await expect(stream).toHaveCount(0);
    await expect(card.locator(".cite").first()).toBeVisible();
    expect(
      (
        await win.evaluate(
          () => (window as unknown as { __got: string[] }).__got,
        )
      ).length,
    ).toBeGreaterThan(3);
    expect(
      await other.evaluate(
        () => (window as unknown as { __got: string[] }).__got,
      ),
    ).toEqual([]);

    // (2) Huỷ giữa stream ⇒ chữ tạm biến mất, không phiên bản mới, kết nối đóng.
    const before = (await versionsOf(win, nbId, "keyPoints")).length;
    fake.setStream({ count: 60, gapMs: 400 });
    const closedBefore = fake.stats.closed;
    await win.getByTestId("studio-btn-keyPoints").click();
    const keyPointsStream = win.getByTestId("studio-stream-keyPoints");
    await expect(keyPointsStream).toBeVisible({ timeout: 15_000 });
    await win.getByTestId("studio-cancel-keyPoints").click();
    await expect(keyPointsStream).toHaveCount(0, { timeout: 2_000 });
    await expect
      .poll(() => fake.stats.closed, { timeout: 5_000 })
      .toBeGreaterThan(closedBefore);
    await win.waitForTimeout(1_500);
    await expect(win.getByTestId("studio-card-keyPoints")).toHaveCount(0);
    await expect(win.getByTestId("studio-error-keyPoints")).toHaveCount(0);
    expect((await versionsOf(win, nbId, "keyPoints")).length).toBe(before);

    // (3) Phạm vi 2/4 nguồn ⇒ chip chỉ trỏ 2 nguồn; phiên bản ghi "Phạm vi: 2 nguồn".
    fake.setStream({ count: 1, gapMs: 30 });
    const toggle = win.getByTestId("studio-scope-toggle");
    await expect(toggle).toHaveText("Phạm vi: Tất cả nguồn");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    const list = win.getByTestId("studio-scope-list");
    await list.getByLabel("nguon-2.txt").check();
    await list.getByLabel("nguon-4.txt").check();
    await expect(toggle).toHaveText("Phạm vi: 2 nguồn");
    await win.keyboard.press("Escape");
    await expect(toggle).toBeFocused();
    await win.getByTestId("studio-btn-keyPoints").click();
    const keyPoints = win.getByTestId("studio-card-keyPoints");
    await expect(keyPoints).toBeVisible({ timeout: 30_000 });
    await expect(win.getByTestId("studio-scope-note-keyPoints")).toHaveText(
      "Phạm vi: 2 nguồn",
    );
    const [saved] = await versionsOf(win, nbId, "keyPoints");
    const titles = await win.evaluate(
      async ([id, ids]) =>
        (await window.api.sourceListByNotebook(id))
          .filter((s) => ids.includes(s.id))
          .map((s) => s.title)
          .sort(),
      [nbId, saved.sourceIds ?? []] as const,
    );
    expect(titles).toEqual(["nguon-2.txt", "nguon-4.txt"]);
    expect(saved.citations.length).toBeGreaterThan(0);
    for (const c of saved.citations)
      expect(saved.sourceIds).toContain(c.sourceId);
    expect(
      await other.evaluate(
        () => (window as unknown as { __got: string[] }).__got,
      ),
    ).toEqual([]);
  } finally {
    await app.close();
    fake.server.close();
  }
});
