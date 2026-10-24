import {
  _electron as electron,
  test,
  expect,
  type ElectronApplication,
} from "@playwright/test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MAIN, dismissOnboarding } from "./helper";

// 093 — báo lỗi opt-in trên app thật: phiên bị buộc dừng (SIGKILL) ⇒ lần mở sau hiện dải mời gửi báo cáo; hộp
// thoại Báo lỗi hiện bản nháp đã làm sạch để người dùng xem/sửa. KHÔNG bấm "Mở GitHub" (sẽ mở trình duyệt thật).
// Cần `npm run build` trước.

let userData: string;

function launch(): Promise<ElectronApplication> {
  return electron.launch({
    args: [MAIN, `--user-data-dir=${userData}`],
    env: {
      ...process.env,
      IV_EMBED_FAKE: "1",
      IV_RERANK_FAKE: "1",
      IV_UI_LANG: "vi",
    } as Record<string, string>,
  });
}

test.beforeAll(async () => {
  userData = await mkdtemp(join(tmpdir(), "iv-e2e-crash-"));
});

test("phiên bị buộc dừng ⇒ lần mở sau mời gửi báo cáo; Bỏ qua thì không hỏi lại", async () => {
  // Phiên 1: mở rồi bị giết (không thoát sạch ⇒ tệp đánh dấu phiên còn sót).
  const app1 = await launch();
  const win1 = await app1.firstWindow();
  await dismissOnboarding(win1);
  await expect(win1.getByTestId("crash-notice")).toHaveCount(0);
  app1.process().kill("SIGKILL");
  await new Promise<void>((r) => app1.process().once("exit", () => r()));

  // Phiên 2: thấy dải thông báo → Bỏ qua → đóng sạch.
  const app2 = await launch();
  const win2 = await app2.firstWindow();
  const notice = win2.getByTestId("crash-notice");
  await expect(notice).toContainText("đóng bất thường");
  await win2.getByTestId("crash-notice-dismiss").click();
  await expect(notice).toHaveCount(0);
  await app2.close();

  // Phiên 3: lần trước thoát sạch ⇒ không còn thông báo.
  const app3 = await launch();
  const win3 = await app3.firstWindow();
  await win3.getByTestId("app-name").waitFor();
  await expect(win3.getByTestId("crash-notice")).toHaveCount(0);
  await app3.close();
});

test("Cài đặt → Báo lỗi… hiện bản nháp đã làm sạch, sửa được; window.api không mở URL tuỳ ý", async () => {
  const app = await launch();
  const win = await app.firstWindow();
  await dismissOnboarding(win);
  await win.getByTestId("nav-settings").click();
  await win.getByTestId("crash-report-open").click();
  const dialog = win.getByTestId("crash-dialog");
  await expect(dialog).toBeVisible();
  const text = win.getByTestId("crash-text");
  await expect(text).toHaveValue(/SourceCraft \d+\.\d+\.\d+ · Electron/);
  await expect(text).toHaveValue(/Native crashes/); // 123: khung báo cáo English cố định
  await expect(text).not.toHaveValue(/iv-e2e-crash-/); // không lộ đường dẫn userData
  await text.fill("Đã sửa bởi người dùng");
  await expect(text).toHaveValue("Đã sửa bởi người dùng");
  await expect(win.getByTestId("crash-send")).toBeEnabled();
  await win.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);

  const keys = await win.evaluate(() => Object.keys(window.api));
  expect(keys).toEqual(
    expect.arrayContaining([
      "crashGetReport",
      "crashOpenIssue",
      "crashGetNotice",
      "crashDismissNotice",
    ]),
  );
  expect(keys).not.toContain("openExternal");
  await app.close();
});
