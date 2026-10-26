import { test, expect, type Page } from "@playwright/test";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import { createServer, type Server } from "node:http";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { launchFresh, dismissOnboarding } from "./helper";

// 149 (T017): huỷ lượt tạo Studio end-to-end với "Ollama" giả HTTP — đếm request /api/chat, ghi nhận kết nối bị client đóng.
// Tài liệu ~40.000 ký tự > ngân sách 16.000 ⇒ nhiều phần; lượt map thứ 2 treo ⇒ bấm Huỷ ở "Đang đọc phần 2/".

interface Fake {
  server: Server;
  url: string;
  stats: { requests: number; closed: number };
  /** độ trễ (ms) cho request /api/chat thứ n (1-based, đếm toàn cục) */
  setDelay: (fn: (n: number, isMap: boolean) => number) => void;
}

async function fakeOllama(): Promise<Fake> {
  const stats = { requests: 0, closed: 0 };
  let delayFor = (_n: number, _isMap: boolean): number => 50;
  const server = createServer((req, res) => {
    res.setHeader("content-type", "application/json");
    if (req.url === "/api/chat") {
      stats.requests += 1;
      const n = stats.requests;
      let body = "";
      req.on("data", (c) => (body += c));
      req.on("end", () => {
        const msgs = (JSON.parse(body) as { messages: { content: string }[] })
          .messages;
        const first =
          /\[(\d+)\]/.exec(msgs[msgs.length - 1].content)?.[1] ?? "1";
        const isMap = msgs[0].content.startsWith("Extract NOTES");
        const content = isMap
          ? `- ý chính [${first}]`
          : `Kết luận ngắn [${first}].`;
        const timer = setTimeout(
          () => res.end(JSON.stringify({ message: { content } })),
          delayFor(n, isMap),
        );
        res.on("close", () => {
          if (!res.writableEnded) {
            stats.closed += 1;
            clearTimeout(timer);
          }
        });
      });
      return;
    }
    if (req.url === "/api/show") {
      res.statusCode = 404;
      res.end("{}");
      return;
    }
    res.end(JSON.stringify({ models: [{ name: "fake:1b", size: 1 }] }));
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const { port } = server.address() as AddressInfo;
  return {
    server,
    url: `http://127.0.0.1:${port}`,
    stats,
    setDelay: (fn) => (delayFor = fn),
  };
}

async function bigDoc(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "iv-149-"));
  const file = join(dir, "dai.txt");
  const para = (i: number): string =>
    `Đoạn ${i}: phở là món ăn truyền thống của Việt Nam với nước dùng hầm xương, bánh phở và thịt bò hoặc gà, được bán ở khắp các thành phố lớn.`;
  await writeFile(
    file,
    Array.from({ length: 300 }, (_, i) => para(i)).join("\n\n"),
  );
  return file;
}

async function openNotebook(
  win: Page,
  file: string,
  name = "Huỷ",
): Promise<string> {
  const nbId = await win.evaluate(
    async ([f, n]) => {
      await window.api.aiSetSelectedModels({
        chatModel: "fake:1b",
        embeddingModel: null,
      });
      const nb = await window.api.notebookCreate({ name: n, color: "#1E6B57" });
      await window.api.sourceAdd({
        notebookId: nb.id,
        kind: "txt",
        filePath: f,
      });
      return nb.id;
    },
    [file, name] as const,
  );
  await expect
    .poll(
      () =>
        win.evaluate(
          async (id) => (await window.api.sourceListByNotebook(id))[0]?.status,
          nbId,
        ),
      { timeout: 30_000 },
    )
    .toBe("ready");
  await win.evaluate((id) => {
    window.location.hash = `#/workspace/${id}`;
  }, nbId);
  return nbId;
}

async function expectNoOverflow(win: Page): Promise<void> {
  const overflow = await win
    .getByTestId("studio-col")
    .evaluate((el) => el.scrollWidth - el.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
}

test("149 — Huỷ giữa phần 2: ngắt kết nối, không request mới, không lưu; Tạo lại + Huỷ giữ card cũ; rời notebook ⇒ tự huỷ", async ({}, testInfo) => {
  const fake = await fakeOllama();
  const app = await launchFresh({ OLLAMA_HOST: fake.url });
  try {
    const win = await app.firstWindow();
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0]!.setSize(900, 760),
    );
    await dismissOnboarding(win);
    expect(
      await win.evaluate(() => ({
        cancel: typeof window.api.studioCancel,
        invoke: typeof (window.api as unknown as { invoke?: unknown }).invoke,
      })),
    ).toEqual({ cancel: "function", invoke: "undefined" });
    const nbId = await openNotebook(win, await bigDoc());

    // (1) Huỷ ở phần 2 — lượt map thứ 2 treo 20 s.
    fake.setDelay((n) => (n === 2 ? 20_000 : 50));
    const btn = win.getByTestId("studio-btn-keyPoints");
    await expect(btn).toBeEnabled({ timeout: 15_000 });
    await btn.click();
    const cancelBtn = win.getByTestId("studio-cancel-keyPoints");
    await expect(cancelBtn).toBeVisible();
    await expect(win.getByTestId("studio-progress-keyPoints")).toContainText(
      "Đang đọc phần 2/",
    );
    await expectNoOverflow(win);
    await win
      .getByTestId("studio-col")
      .screenshot({ path: testInfo.outputPath("studio-cancel-vi.png") });
    const before = fake.stats.requests;
    // (review B1) bằng bàn phím: focus nút Huỷ + Enter ⇒ sau huỷ focus về nút loại (không có kết quả cũ).
    await cancelBtn.focus();
    await win.keyboard.press("Enter");
    await expect
      .poll(() => fake.stats.closed, { timeout: 2_000 })
      .toBeGreaterThanOrEqual(1);
    await expect(cancelBtn).toHaveCount(0, { timeout: 2_000 });
    await expect(win.getByTestId("studio-progress-keyPoints")).toHaveCount(0);
    await expect(win.getByTestId("studio-error-keyPoints")).toHaveCount(0);
    await expect(btn).toHaveText("Ý chính");
    await expect(btn).toBeFocused();
    await win.waitForTimeout(3_000);
    expect(fake.stats.requests).toBe(before); // không request mới (kể cả thử lại / bước cuối)
    expect(
      await win.evaluate(
        async (id) =>
          (await window.api.studioList(id)).some((r) => r.kind === "keyPoints"),
        nbId,
      ),
    ).toBe(false);

    // (2) Có kết quả cũ ⇒ Tạo lại ⇒ Huỷ ⇒ card cũ nguyên vẹn.
    fake.setDelay(() => 30);
    await win.getByTestId("studio-btn-summary").click();
    const card = win.getByTestId("studio-card-summary");
    await expect(card).toBeVisible({ timeout: 30_000 });
    const oldText = await card.innerText();
    const base = fake.stats.requests;
    fake.setDelay((n) => (n === base + 2 ? 20_000 : 30));
    await win.getByTestId("studio-regen-summary").click();
    await expect(win.getByTestId("studio-progress-summary")).toContainText(
      "Đang đọc phần 2/",
    );
    await win.getByTestId("studio-cancel-summary").focus();
    await win.keyboard.press("Enter");
    await expect(win.getByTestId("studio-cancel-summary")).toHaveCount(0, {
      timeout: 2_000,
    });
    // (review B1) có kết quả cũ ⇒ focus về "Tạo lại"
    await expect(win.getByTestId("studio-regen-summary")).toBeFocused();
    expect(await card.innerText()).toBe(oldText);
    await expect(win.getByTestId("studio-error-summary")).toHaveCount(0);

    // (3) Đang tạo mà rời notebook ⇒ tự huỷ (kết nối đóng, không lưu).
    const closedBefore = fake.stats.closed;
    fake.setDelay(() => 20_000);
    await win.getByTestId("studio-btn-keyPoints").click();
    await expect(win.getByTestId("studio-cancel-keyPoints")).toBeVisible();
    await expect.poll(() => fake.stats.requests).toBeGreaterThan(base + 2);
    await win.evaluate(() => {
      window.location.hash = "#/notebooks";
    });
    await expect
      .poll(() => fake.stats.closed, { timeout: 3_000 })
      .toBeGreaterThan(closedBefore);
    expect(
      await win.evaluate(
        async (id) =>
          (await window.api.studioList(id)).some((r) => r.kind === "keyPoints"),
        nbId,
      ),
    ).toBe(false);

    // (4) Lượt mới cùng (notebook, loại) ⇒ lượt cũ bị huỷ (supersede): reject studioCancelled, kết nối đóng.
    const closed4 = fake.stats.closed;
    const outcome = await win.evaluate(async (id) => {
      const first = window.api
        .studioGenerate({
          notebookId: id,
          kind: "summary",
          generationId: "first-run",
        })
        .then(
          () => "done",
          (e: unknown) => String(e),
        );
      await new Promise((r) => setTimeout(r, 500));
      const second = window.api.studioGenerate({
        notebookId: id,
        kind: "summary",
        generationId: "second-run",
      });
      const firstResult = await first;
      await window.api.studioCancel("second-run");
      await second.catch(() => undefined);
      return firstResult;
    }, nbId);
    expect(outcome).toContain("studioCancelled");
    expect(fake.stats.closed).toBeGreaterThan(closed4);
  } finally {
    await app.close();
    fake.server.close();
  }
});

test("149 — English: nút Cancel, không tràn ở 900 px", async ({}, testInfo) => {
  const fake = await fakeOllama();
  fake.setDelay((n) => (n === 2 ? 20_000 : 50));
  const app = await launchFresh({ OLLAMA_HOST: fake.url, IV_UI_LANG: "en" });
  try {
    const win = await app.firstWindow();
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0]!.setSize(900, 760),
    );
    await dismissOnboarding(win);
    await openNotebook(win, await bigDoc(), "Cancel");
    const btn = win.getByTestId("studio-btn-summary");
    await expect(btn).toBeEnabled({ timeout: 15_000 });
    await btn.click();
    const cancelBtn = win.getByTestId("studio-cancel-summary");
    await expect(cancelBtn).toHaveText("Cancel");
    await expect(cancelBtn).toHaveAttribute(
      "aria-label",
      "Cancel creating Document summary",
    );
    await expect(win.getByTestId("studio-progress-summary")).toContainText(
      "Reading part 2 of",
    );
    await expectNoOverflow(win);
    await win
      .getByTestId("studio-col")
      .screenshot({ path: testInfo.outputPath("studio-cancel-en.png") });
    await cancelBtn.click();
    await expect(cancelBtn).toHaveCount(0, { timeout: 2_000 });
    await expect(btn).toHaveText("Document summary");
  } finally {
    await app.close();
    fake.server.close();
  }
});
