import { describe, it, expect } from "vitest";
import type { MenuItemConstructorOptions } from "electron";
import { appMenuTemplate } from "../../src/main/services/ui-language/app-menu";
import { createTranslator } from "../../src/shared/i18n";

// 145: menu ứng dụng theo ngôn ngữ giao diện (vi/en) — hàm THUẦN dựng template; main build + dựng lại khi đổi ngôn ngữ.

type Item = MenuItemConstructorOptions;
const flat = (items: Item[]): Item[] =>
  items.flatMap((i) => [i, ...flat((i.submenu as Item[] | undefined) ?? [])]);
const labels = (items: Item[]) =>
  flat(items)
    .filter((i) => i.type !== "separator")
    .map((i) => i.label);
const roles = (items: Item[]) =>
  flat(items)
    .map((i) => i.role)
    .filter(Boolean);

describe("appMenuTemplate", () => {
  const vi = createTranslator("vi");
  const en = createTranslator("en");

  it("mọi mục (trừ phân cách) có nhãn; nhãn theo ngôn ngữ", () => {
    for (const platform of ["darwin", "win32"] as const) {
      const tv = appMenuTemplate(vi, {
        platform,
        isPackaged: true,
        appName: "SourceCraft",
      });
      const te = appMenuTemplate(en, {
        platform,
        isPackaged: true,
        appName: "SourceCraft",
      });
      expect(
        labels(tv).every((l) => typeof l === "string" && l.length > 0),
      ).toBe(true);
      expect(
        labels(te).every((l) => typeof l === "string" && l.length > 0),
      ).toBe(true);
    }
    const viTop = appMenuTemplate(vi, {
      platform: "win32",
      isPackaged: true,
      appName: "SourceCraft",
    }).map((i) => i.label);
    const enTop = appMenuTemplate(en, {
      platform: "win32",
      isPackaged: true,
      appName: "SourceCraft",
    }).map((i) => i.label);
    expect(enTop).toEqual(["File", "Edit", "View", "Window", "Help"]);
    expect(viTop).toEqual(["Tệp", "Sửa", "Xem", "Cửa sổ", "Trợ giúp"]);
  });

  it("giữ role chuẩn để phím tắt hệ điều hành hoạt động", () => {
    const r = roles(
      appMenuTemplate(en, {
        platform: "darwin",
        isPackaged: true,
        appName: "SourceCraft",
      }),
    );
    for (const role of [
      "undo",
      "redo",
      "cut",
      "copy",
      "paste",
      "selectAll",
      "quit",
      "minimize",
      "resetZoom",
      "zoomIn",
      "zoomOut",
      "togglefullscreen",
    ]) {
      expect(r, role).toContain(role);
    }
  });

  it("macOS có menu ứng dụng (About/Hide/Quit) mang tên app; Windows có Giới thiệu trong menu Trợ giúp", () => {
    const mac = appMenuTemplate(en, {
      platform: "darwin",
      isPackaged: true,
      appName: "SourceCraft",
    });
    expect(mac[0].label).toBe("SourceCraft");
    expect(roles([mac[0]])).toEqual(
      expect.arrayContaining(["about", "hide", "quit"]),
    );
    const win = appMenuTemplate(en, {
      platform: "win32",
      isPackaged: true,
      appName: "SourceCraft",
    });
    // 213: Windows chưa có mục Giới thiệu nào — thêm vào Trợ giúp (role chuẩn ⇒ hộp mặc định của hệ điều hành).
    expect(win.at(-1)?.label).toBe("Help");
    expect(roles([win.at(-1)!])).toEqual(["about"]);
    expect(roles(win)).toContain("quit");
  });

  it("DevTools/Reload chỉ ở bản chưa đóng gói; không còn mục 'Learn More' trỏ ra ngoài", () => {
    const prod = roles(
      appMenuTemplate(en, {
        platform: "darwin",
        isPackaged: true,
        appName: "SourceCraft",
      }),
    );
    expect(prod).not.toContain("toggleDevTools");
    expect(prod).not.toContain("reload");
    const dev = roles(
      appMenuTemplate(en, {
        platform: "darwin",
        isPackaged: false,
        appName: "SourceCraft",
      }),
    );
    expect(dev).toContain("toggleDevTools");
    const all = flat(
      appMenuTemplate(en, {
        platform: "darwin",
        isPackaged: true,
        appName: "SourceCraft",
      }),
    );
    expect(all.some((i) => typeof i.click === "function")).toBe(false);
  });
});
