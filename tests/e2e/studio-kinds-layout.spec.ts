import { test, expect, type Page } from "@playwright/test";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import { createServer, type Server } from "node:http";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import {
  launchFresh,
  dismissOnboarding,
  isProBuild,
  sizedWindow,
} from "./helper";

// 178 (T033, FR-014, SC-008): 8 nút loại (lưới 2×4) ở cửa sổ 900 px — vi và en — không tràn / cuộn ngang; tạo một loại mới
// với "Ollama" giả ⇒ thẻ kết quả có chip [n].

interface Fake {
  server: Server;
  url: string;
  stats: { requests: number };
  setDelay: (fn: (n: number) => number) => void;
}

async function fakeOllama(): Promise<Fake> {
  const stats = { requests: 0 };
  let delayFor = (_n: number): number => 30;
  const server = createServer((req, res) => {
    res.setHeader("content-type", "application/json");
    if (req.url === "/api/chat") {
      stats.requests += 1;
      const n = stats.requests;
      req.on("data", () => undefined);
      req.on("end", () => {
        const timer = setTimeout(
          () =>
            res.end(
              JSON.stringify({
                message: { content: `Kết quả lần ${n} [1].` },
              }),
            ),
          delayFor(n),
        );
        res.on("close", () => clearTimeout(timer));
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

async function smallDoc(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "iv-178-"));
  const file = join(dir, "ngan.txt");
  await writeFile(
    file,
    "Phở là món ăn truyền thống của Việt Nam. Nước dùng hầm xương nhiều giờ.",
  );
  return file;
}

async function openNotebook(win: Page, file: string): Promise<string> {
  const nbId = await win.evaluate(async (f) => {
    await window.api.aiSetSelectedModels({
      chatModel: "fake:1b",
      embeddingModel: null,
    });
    const nb = await window.api.notebookCreate({
      name: "Phiên bản",
      color: "#1E6B57",
    });
    await window.api.sourceAdd({ notebookId: nb.id, kind: "txt", filePath: f });
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
  return nbId;
}

for (const lang of ["vi", "en"] as const) {
  test(`178 — 8 loại Studio vừa cột ở 900 px (${lang}); tạo Dòng thời gian (stub: báo không có Pro)`, async ({}, testInfo) => {
    const fake = await fakeOllama();
    const app = await launchFresh({ OLLAMA_HOST: fake.url, IV_UI_LANG: lang });
    try {
      const win = await sizedWindow(app, 900, 760);
      await dismissOnboarding(win);
      await openNotebook(win, await smallDoc());

      const col = win.getByTestId("studio-col");
      const btns = col.locator(".studio-actions .studio-btn");
      await expect(btns).toHaveCount(8);
      await expect(win.getByTestId("studio-btn-keyTerms")).toBeEnabled({
        timeout: 15_000,
      });
      await expect(win.getByTestId("studio-btn-keyTerms")).toHaveText(
        lang === "vi" ? "Bảng thuật ngữ" : "Glossary",
      );
      // Cửa sổ 900 px ép cột Studio ≤ 262 px (thường hẹp hơn — trường hợp xấu nhất của FR-014).
      expect((await col.boundingBox())!.width).toBeLessThanOrEqual(262);
      const overflow = await col.evaluate(
        (el) => el.scrollWidth - el.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(1);
      // Không nút nào bị cắt chữ (nhãn English dài hơn).
      const clipped = await btns.evaluateAll((els) =>
        els
          .filter((e) => e.scrollWidth > e.clientWidth + 1)
          .map((e) => e.textContent),
      );
      expect(clipped).toEqual([]);
      // Lưới 2 cột: 8 nút ⇒ 2 giá trị x khác nhau, 4 hàng.
      const boxes = await btns.evaluateAll((els) =>
        els.map((e) => {
          const r = e.getBoundingClientRect();
          return { x: Math.round(r.x), y: Math.round(r.y) };
        }),
      );
      expect(new Set(boxes.map((b) => b.x)).size).toBe(2);
      expect(new Set(boxes.map((b) => b.y)).size).toBe(4);
      await col.screenshot({
        path: testInfo.outputPath(`studio-kinds-${lang}.png`),
      });

      await win.getByTestId("studio-btn-timeline").click();
      if (isProBuild()) {
        const card = win.getByTestId("studio-card-timeline");
        await expect(card).toBeVisible({ timeout: 15_000 });
        await expect(card.locator(".cite").first()).toBeVisible();
      } else {
        // 248 (đợt 2): bản stub ⇒ loại Pro báo "không có chức năng Pro" theo ngôn ngữ giao diện, không có kết quả.
        await expect(win.getByTestId("studio-error-timeline")).toContainText(
          lang === "vi"
            ? "Bản này không có chức năng Pro"
            : "This build does not include Pro features",
          { timeout: 15_000 },
        );
        await expect(win.getByTestId("studio-card-timeline")).toHaveCount(0);
      }
    } finally {
      await app.close();
      fake.server.close();
    }
  });
}
