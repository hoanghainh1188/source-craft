import { test, expect, type ElectronApplication } from "@playwright/test";
import { launchFresh, dismissOnboarding } from "./helper";

// V8 (Constitution I): 0 request mạng ra ngoài khi dùng shell (font self-host, CSP default-src 'self').
let app: ElectronApplication;
const external: string[] = [];

test.beforeAll(async () => {
  app = await launchFresh();
  const win = await app.firstWindow();
  win.on("request", (req) => {
    const url = req.url();
    // Chỉ tính request ra host ngoài (http/https tới domain thật), bỏ qua file:/data:/devtools.
    if (/^https?:\/\//i.test(url) && !url.startsWith("http://localhost"))
      external.push(url);
  });
  await dismissOnboarding(win);
  await win.getByTestId("nav-workspace").click();
  await win.getByTestId("nav-settings").click();
});
test.afterAll(async () => {
  await app?.close();
});

test("V8 — không có request mạng ra ngoài", () => {
  expect(external).toEqual([]);
});

// 236 (T050, SC-006): bật nhật ký kiểm toán vẫn 0 request mạng ra ngoài (nhật ký chỉ ghi tệp cục bộ).
test("236 — audit bật: không có request mạng ra ngoài", async () => {
  const { launchAudit, readyWindow } = await import("./helper");
  const run = await launchAudit({});
  const out: string[] = [];
  try {
    const win = await readyWindow(run.app);
    win.on("request", (req) => {
      const url = req.url();
      if (/^https?:\/\//i.test(url) && !url.startsWith("http://localhost"))
        out.push(url);
    });
    await dismissOnboarding(win);
    await win.getByTestId("nav-workspace").click();
    await win.getByTestId("nav-settings").click();
    expect(out).toEqual([]);
  } finally {
    await run.app.close();
  }
});
