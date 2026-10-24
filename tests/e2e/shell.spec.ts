import { test, expect, type ElectronApplication } from "@playwright/test";
import { launchFresh } from "./helper";

// V1 (US1): mở app → header "SourceCraft" + privacy badge "Chạy cục bộ". Cần `npm run build` trước.
let app: ElectronApplication;
test.beforeAll(async () => {
  app = await launchFresh();
});
test.afterAll(async () => {
  await app?.close();
});

test("V1 — vỏ hiển thị tên app + privacy badge local", async () => {
  const win = await app.firstWindow();
  await expect(win.getByTestId("app-name")).toHaveText("SourceCraft");
  await expect(win.getByTestId("privacy-badge")).toContainText("cục bộ");
  await expect(win.getByTestId("privacy-badge")).not.toHaveClass(/online/);
});
