import { test, expect } from "@playwright/test";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import { createServer, type Server } from "node:http";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import type { Page } from "@playwright/test";
import {
  launchFresh,
  dismissOnboarding,
  isProBuild,
  sizedWindow,
} from "./helper";

// 248 (đợt 2): Studio "custom" cần module Pro — repo public (stub) bỏ qua spec này; unit test core dùng module Pro giả.
test.skip(!isProBuild(), "Cần module Pro (src/main/pro/ là stub)");

// 178 (T048, US3): yêu cầu tuỳ chỉnh end-to-end với "Ollama" giả HTTP ghi lại messages — yêu cầu CHỈ ở tin user (khối
// <request>), không ở system; rỗng / 501 ký tự ⇒ không có request AI; yêu cầu B thay A đang chạy ⇒ chỉ B thành phiên bản;
// cửa sổ 900 px không tràn (vi + en).

interface Fake {
  server: Server;
  url: string;
  bodies: { role: string; content: string }[][];
  setDelay: (fn: (n: number) => number) => void;
}

async function fakeOllama(): Promise<Fake> {
  const bodies: { role: string; content: string }[][] = [];
  let delayFor = (_n: number): number => 30;
  const server = createServer((req, res) => {
    res.setHeader("content-type", "application/json");
    if (req.url === "/api/chat") {
      let body = "";
      req.on("data", (c) => (body += c));
      req.on("end", () => {
        const msgs = (
          JSON.parse(body) as { messages: { role: string; content: string }[] }
        ).messages;
        bodies.push(msgs);
        const n = bodies.length;
        const timer = setTimeout(
          () =>
            res.end(
              JSON.stringify({ message: { content: `Rủi ro lần ${n} [1].` } }),
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
    bodies,
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

async function typeRequest(win: Page, text: string): Promise<void> {
  await win.getByTestId("studio-custom-input").fill(text);
}

async function customCount(win: Page, nbId: string): Promise<number> {
  return win.evaluate(
    async (id) =>
      (await window.api.studioList(id)).filter((r) => r.kind === "custom")
        .length,
    nbId,
  );
}

test("178 — yêu cầu tuỳ chỉnh: chỉ ở tin user, kiểm độ dài, B thay A, không tràn", async ({}, testInfo) => {
  test.setTimeout(90_000);
  const fake = await fakeOllama();
  const app = await launchFresh({ OLLAMA_HOST: fake.url });
  try {
    const win = await sizedWindow(app, 900, 760);
    await dismissOnboarding(win);
    const nbId = await openNotebook(win, await smallDoc());
    await expect(win.getByTestId("studio-btn-summary")).toBeEnabled({
      timeout: 15_000,
    });
    const submit = win.getByTestId("studio-custom-submit");

    // (1) Hợp lệ ⇒ thẻ + chip + yêu cầu hiện lại; yêu cầu KHÔNG ở system, CÓ trong khối <request> của tin user.
    const REQ = "Liệt kê các rủi ro pháp lý";
    await typeRequest(win, REQ);
    await submit.click();
    const card = win.getByTestId("studio-card-custom");
    await expect(card).toContainText("Rủi ro lần 1", { timeout: 15_000 });
    await expect(card.locator(".cite").first()).toBeVisible();
    await expect(win.getByTestId("studio-request-custom")).toContainText(REQ);
    const msgs = fake.bodies[0];
    expect(
      msgs
        .filter((m) => m.role === "system")
        .every((m) => !m.content.includes(REQ)),
    ).toBe(true);
    const user = msgs.find((m) => m.role === "user")!;
    expect(user.content.startsWith(`<request>\n${REQ}\n</request>`)).toBe(true);

    const overflow = await win
      .getByTestId("studio-col")
      .evaluate((el) => el.scrollWidth - el.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    await win
      .getByTestId("studio-col")
      .screenshot({ path: testInfo.outputPath("studio-custom-vi.png") });

    // (2) Rỗng / 501 ký tự ⇒ nút khoá; gọi thẳng IPC ⇒ lỗi có mã, không có request AI mới.
    const before = fake.bodies.length;
    await typeRequest(win, "   ");
    await expect(submit).toBeDisabled();
    await typeRequest(win, "a".repeat(501));
    await expect(submit).toBeDisabled();
    await expect(win.getByTestId("studio-custom-toolong")).toBeVisible();
    const errs = await win.evaluate(async (id) => {
      const codes: string[] = [];
      for (const customPrompt of ["   ", "a".repeat(501)]) {
        await window.api
          .studioGenerate({ notebookId: id, kind: "custom", customPrompt })
          .catch((e: unknown) => codes.push(String(e)));
      }
      return codes;
    }, nbId);
    expect(errs[0]).toContain("studioCustomPromptEmpty");
    expect(errs[1]).toContain("studioCustomPromptTooLong");
    expect(fake.bodies.length).toBe(before);

    // (3) B gửi khi A đang chạy ⇒ A bị huỷ (supersede), chỉ B thành phiên bản.
    const base = await customCount(win, nbId);
    fake.setDelay((n) => (n === before + 1 ? 20_000 : 30));
    const outcome = await win.evaluate(async (id) => {
      const a = window.api
        .studioGenerate({
          notebookId: id,
          kind: "custom",
          customPrompt: "Yêu cầu A",
          generationId: "custom-a",
        })
        .then(
          () => "done",
          (e: unknown) => String(e),
        );
      await new Promise((r) => setTimeout(r, 500));
      const b = await window.api.studioGenerate({
        notebookId: id,
        kind: "custom",
        customPrompt: "Yêu cầu B",
        generationId: "custom-b",
      });
      return { a: await a, b: b.customPrompt };
    }, nbId);
    expect(outcome.a).toContain("studioCancelled");
    expect(outcome.b).toBe("Yêu cầu B");
    expect(await customCount(win, nbId)).toBe(base + 1);
  } finally {
    await app.close();
    fake.server.close();
  }
});

test("178 — yêu cầu tuỳ chỉnh (en): nhãn dịch, không tràn ở 900 px", async ({}, testInfo) => {
  const fake = await fakeOllama();
  const app = await launchFresh({ OLLAMA_HOST: fake.url, IV_UI_LANG: "en" });
  try {
    const win = await sizedWindow(app, 900, 760);
    await dismissOnboarding(win);
    await openNotebook(win, await smallDoc());
    await expect(win.getByTestId("studio-custom-submit")).toHaveText("Create");
    await typeRequest(win, "List the legal risks and the related clauses");
    await win.getByTestId("studio-custom-submit").click();
    await expect(win.getByTestId("studio-card-custom")).toBeVisible({
      timeout: 15_000,
    });
    const overflow = await win
      .getByTestId("studio-col")
      .evaluate((el) => el.scrollWidth - el.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    await win
      .getByTestId("studio-col")
      .screenshot({ path: testInfo.outputPath("studio-custom-en.png") });
  } finally {
    await app.close();
    fake.server.close();
  }
});
