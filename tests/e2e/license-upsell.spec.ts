import { test, expect, type ElectronApplication } from "@playwright/test";
import { join } from "node:path";
import { dismissOnboarding, launchFresh, sizedWindow } from "./helper";

// 237: gói Free chạm hạn mức 3 notebook ⇒ lời mời nâng cấp dưới câu lỗi; Cài đặt › Bản quyền có nút Mua.
// openExternal được thay bằng hàm ghi lại URL (không bật trình duyệt thật trong e2e).
// SC_SHOTS=<thư mục> ⇒ lưu ảnh chụp để duyệt giao diện bằng mắt.

const SHOTS = process.env["SC_SHOTS"];

let app: ElectronApplication;
test.beforeAll(async () => {
  app = await launchFresh({ IV_E2E_LICENSE_TIER: "free" });
});
test.afterAll(async () => {
  await app?.close();
});

async function shot(
  win: import("@playwright/test").Page,
  name: string,
): Promise<void> {
  if (SHOTS) await win.screenshot({ path: join(SHOTS, `${name}.png`) });
}

test("gói Free: notebook thứ 4 bị chặn kèm lời mời nâng cấp, Cài đặt có nút Mua", async () => {
  const win = await sizedWindow(app, 1280, 820);
  await dismissOnboarding(win);

  await app.evaluate(({ shell }) => {
    const opened: string[] = [];
    (globalThis as unknown as { __opened: string[] }).__opened = opened;
    shell.openExternal = async (url: string) => {
      opened.push(url);
    };
  });

  for (const name of ["Hồ sơ M&A", "Nghiên cứu Q3", "Hợp đồng thuê"]) {
    await win.evaluate(
      (n) => window.api.notebookCreate({ name: n, color: "#1E6B57" }),
      name,
    );
  }
  await win.reload();
  await expect(win.locator(".nb-card")).toHaveCount(3);

  await win.getByTestId("notebook-new").click();
  await win.getByTestId("notebook-name-input").fill("Notebook thứ 4");
  await win.getByTestId("notebook-submit").click();

  await expect(win.getByTestId("notebook-error")).toContainText("3");
  const prompt = win.getByTestId("upgrade-prompt");
  await expect(prompt).toBeVisible();
  await shot(win, "1-upgrade-prompt");

  await prompt.getByTestId("upgrade-prompt-buy").click();
  await expect
    .poll(() =>
      app.evaluate(
        () => (globalThis as unknown as { __opened: string[] }).__opened,
      ),
    )
    .toEqual(["https://github.com/hoanghainh1188/source-craft#pricing"]);

  await win.getByRole("button", { name: "Huỷ" }).click();
  await win.evaluate(() => {
    window.location.hash = "#/settings";
  });
  const buy = win.getByTestId("license-buy");
  await buy.scrollIntoViewIfNeeded();
  await expect(buy).toBeVisible();
  await expect(win.getByTestId("license-buy-btn")).toBeVisible();
  await win.getByTestId("settings-license").scrollIntoViewIfNeeded();
  await shot(win, "2-settings-buy");
});
