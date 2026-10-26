import { test, expect, type Page } from "@playwright/test";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import { createServer, type Server } from "node:http";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { launchFresh, dismissOnboarding, sizedWindow } from "./helper";

// 146 (T020): tiến độ Studio end-to-end với "Ollama" giả (như #135) — /api/tags + /api/chat chậm ~1,5 s. Notebook nhỏ ⇒ một lượt
// ⇒ thẻ hiện "Đang viết…" (bất định) rồi kết quả. Cột Studio hẹp không tràn (vi/en); (L1) giảm chuyển động ⇒ thanh không chạy.

const FIXTURE = join(process.cwd(), "tests/fixtures/sample.txt");

async function fakeOllama(
  delayMs = 1500,
): Promise<{ server: Server; url: string }> {
  const server = createServer((req, res) => {
    res.setHeader("content-type", "application/json");
    if (req.url === "/api/chat") {
      let body = "";
      req.on("data", (c) => (body += c));
      req.on("end", () => {
        // Trả ghi chú / kết luận trích [n] ĐẦU TIÊN có trong đầu vào (hợp lệ cho cả lượt map lẫn bước cuối).
        const msgs = (JSON.parse(body) as { messages: { content: string }[] })
          .messages;
        const n = /\[(\d+)\]/.exec(msgs[msgs.length - 1].content)?.[1] ?? "1";
        const isMap = msgs[0].content.startsWith("Extract NOTES");
        const content = isMap ? `- ý chính [${n}]` : `Kết luận ngắn [${n}].`;
        setTimeout(
          () => res.end(JSON.stringify({ message: { content } })),
          delayMs,
        );
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
  return { server, url: `http://127.0.0.1:${port}` };
}

async function openNotebook(win: Page, file = FIXTURE): Promise<void> {
  const nbId = await win.evaluate(async (file) => {
    await window.api.aiSetSelectedModels({
      chatModel: "fake:1b",
      embeddingModel: null,
    });
    const nb = await window.api.notebookCreate({
      name: "Progress",
      color: "#1E6B57",
    });
    await window.api.sourceAdd({
      notebookId: nb.id,
      kind: "txt",
      filePath: file,
    });
    return nb.id;
  }, file);
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
}

/** Cột Studio không tràn ngang (kể cả khối tiến độ). */
async function expectNoOverflow(win: Page): Promise<void> {
  const overflow = await win
    .getByTestId("studio-col")
    .evaluate((el) => el.scrollWidth - el.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
}

for (const lang of ["vi", "en"] as const) {
  test(`146 — Studio hiện tiến độ rồi kết quả (${lang})`, async ({}, testInfo) => {
    const { server, url } = await fakeOllama();
    const app = await launchFresh({ OLLAMA_HOST: url, IV_UI_LANG: lang });
    try {
      const win = await sizedWindow(app, 1024, 760);
      await dismissOnboarding(win);

      // Preload: kênh chỉ nhận, không lộ invoke chung.
      expect(
        await win.evaluate(() => ({
          on: typeof window.api.onStudioProgress,
          invoke: typeof (window.api as unknown as { invoke?: unknown }).invoke,
        })),
      ).toEqual({ on: "function", invoke: "undefined" });

      await openNotebook(win);
      const btn = win.getByTestId("studio-btn-summary");
      await expect(btn).toBeEnabled({ timeout: 15_000 });
      await btn.click();

      const prog = win.getByTestId("studio-progress-summary");
      await expect(prog).toBeVisible();
      await expect(prog).toContainText(
        lang === "vi" ? "Đang viết…" : "Writing…",
      );
      const bar = prog.getByRole("progressbar");
      await expect(bar).toHaveAttribute(
        "aria-valuetext",
        lang === "vi" ? "Đang viết…" : "Writing…",
      );
      expect(await bar.getAttribute("aria-valuenow")).toBeNull();
      await expect(btn).toHaveText(lang === "vi" ? "Đang tạo…" : "Creating…");
      await expectNoOverflow(win);
      await win.getByTestId("studio-col").screenshot({
        path: testInfo.outputPath(`studio-progress-${lang}.png`),
      });

      await expect(win.getByTestId("studio-card-summary")).toBeVisible({
        timeout: 20_000,
      });
      await expect(prog).toHaveCount(0);

      // (L1) giảm chuyển động ⇒ thanh bất định không có animation.
      await win.emulateMedia({ reducedMotion: "reduce" });
      // 248: loại core (bản stub không có loại Pro như faq).
      await win.getByTestId("studio-btn-keyPoints").click();
      const fill = win
        .getByTestId("studio-progress-keyPoints")
        .locator(".studio-progress-fill");
      await expect(fill).toBeVisible();
      expect(
        await fill.evaluate((el) => getComputedStyle(el).animationName),
      ).toBe("none");
      await expect(win.getByTestId("studio-card-keyPoints")).toBeVisible({
        timeout: 20_000,
      });
    } finally {
      await app.close();
      server.close();
    }
  });
}

// 146 (review): đường NHIỀU PHẦN trên UI thật — tài liệu ~40.000 ký tự > ngân sách 16.000 (Ollama giả không trả /api/show) ⇒
// map-reduce ⇒ "Đang đọc phần i/N…" tăng dần, thanh xác định, rồi "Đang viết…" và kết quả; cửa sổ nhỏ nhất (900 px) không tràn.
test("146 — nhiều phần: đọc i/N tăng dần rồi viết; cửa sổ nhỏ nhất không tràn", async ({}, testInfo) => {
  // Chờ kết quả tới 60 s (poll bên dưới) ⇒ giới hạn test phải lớn hơn mặc định 30 s (máy bận khi chạy cả bộ e2e).
  test.setTimeout(90_000);
  const dir = await mkdtemp(join(tmpdir(), "iv-146-"));
  const big = join(dir, "dai.txt");
  const para = (i: number): string =>
    `Đoạn ${i}: phở là món ăn truyền thống của Việt Nam với nước dùng hầm xương, bánh phở và thịt bò hoặc gà, được bán ở khắp các thành phố lớn.`;
  await writeFile(
    big,
    Array.from({ length: 300 }, (_, i) => para(i)).join("\n\n"),
  );
  const { server, url } = await fakeOllama(700);
  const app = await launchFresh({ OLLAMA_HOST: url });
  try {
    const win = await sizedWindow(app, 900, 700);
    await dismissOnboarding(win);
    await openNotebook(win, big);
    const btn = win.getByTestId("studio-btn-keyPoints");
    await expect(btn).toBeEnabled({ timeout: 15_000 });
    await btn.click();

    const prog = win.getByTestId("studio-progress-keyPoints");
    await expect(prog).toContainText("Đang đọc phần 1/");
    const bar = prog.getByRole("progressbar");
    await expect(bar).toHaveAttribute("aria-valuenow", "1");
    await expectNoOverflow(win);
    await win
      .getByTestId("studio-col")
      .screenshot({ path: testInfo.outputPath("studio-progress-reading.png") });

    // Ghi chuỗi câu tiến độ tới khi có kết quả.
    const seen: string[] = [];
    const card = win.getByTestId("studio-card-keyPoints");
    await expect
      .poll(
        async () => {
          if ((await prog.count()) > 0) {
            // 149: thẻ có thêm nút Huỷ ⇒ chỉ đọc dòng pha. Thẻ có thể biến mất giữa count() và textContent() (lượt vừa xong)
            // ⇒ đọc với timeout ngắn, mất thì bỏ qua (không để auto-wait 30 s làm test đỏ).
            const t = (
              (await prog
                .locator(".studio-progress-text")
                .textContent({ timeout: 200 })
                .catch(() => null)) ?? ""
            ).trim();
            if (t && seen[seen.length - 1] !== t) seen.push(t);
          }
          return card.count();
        },
        { timeout: 60_000, intervals: [100] },
      )
      .toBe(1);
    const reading = seen
      .map((t) => /Đang đọc phần (\d+)\/(\d+)/.exec(t))
      .filter((m): m is RegExpExecArray => m !== null);
    const total = Number(reading[0][2]);
    expect(total).toBeGreaterThan(1);
    expect(reading.map((m) => Number(m[1]))).toEqual(
      [...reading.map((m) => Number(m[1]))].sort((a, b) => a - b),
    );
    expect(seen[seen.length - 1]).toBe("Đang viết…");
    await expect(win.getByTestId("studio-parts")).toContainText(
      `Tổng hợp từ ${total} phần`,
    );
  } finally {
    await app.close();
    server.close();
  }
});
