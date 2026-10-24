import { describe, it, expect } from "vitest";
import { buildAboutPanelOptions } from "../../src/main/services/app-shell/about-panel";
import { createTranslator } from "../../src/shared/i18n";

// 213: nội dung hộp "Giới thiệu" MẶC ĐỊNH của hệ điều hành (app.setAboutPanelOptions) — thuần, song ngữ, không đường dẫn.

const base = {
  version: "0.2.22",
  arch: "arm64",
  packaged: true,
  runtime: { electron: "43.1.0", chromium: "150.0.0", node: "24.0.0" },
  models: [
    {
      role: "embedding",
      name: "Xenova/multilingual-e5-small",
      version: "e5-small-384",
    },
    {
      role: "reranker",
      name: "cross-encoder/mmarco",
      version: "1427fd652930-qint8",
    },
    { role: "asrFinal", name: "Xenova/whisper-base", version: "q8" },
    { role: "asrFallback", name: "Xenova/whisper-tiny", version: "q8" },
  ] as const,
  libraries: [
    { name: "react", version: "18.3.1", license: "MIT" },
    { name: "mystery", version: "0.0.1", license: null },
  ],
  iconPath: "/Applications/SourceCraft.app/Contents/Resources/icon.png",
};

describe("buildAboutPanelOptions", () => {
  it("trường chuẩn: tên, phiên bản, kiến trúc (version), bản quyền, icon", () => {
    const o = buildAboutPanelOptions({ ...base, t: createTranslator("vi") });
    expect(o.applicationName).toBe("SourceCraft");
    expect(o.applicationVersion).toBe("0.2.22");
    expect(o.version).toBe("arm64");
    expect(o.copyright).toBe("© 2026 hoanghainh1188");
    expect(o.iconPath).toBe(base.iconPath);
  });

  it("credits tiếng Việt: riêng tư, giấy phép, build, model, thư viện", () => {
    const c = buildAboutPanelOptions({
      ...base,
      t: createTranslator("vi"),
    }).credits!;
    expect(c).toContain("_____");
    expect(c).toContain("không rời khỏi máy");
    expect(c).toContain("MIT");
    expect(c).toContain("hoanghainh1188");
    expect(c).toContain("Electron 43.1.0");
    expect(c).toContain("Chromium 150.0.0");
    expect(c).toContain("Node 24.0.0");
    expect(c).toContain("Bản đóng gói");
    expect(c).toContain("Xenova/multilingual-e5-small (e5-small-384)");
    expect(c).toContain("Xenova/whisper-tiny (q8)");
    expect(c).toContain("react 18.3.1 — MIT");
    expect(c).toContain("mystery 0.0.1 — không rõ");
  });

  it("credits tiếng Anh dùng nhãn English", () => {
    const c = buildAboutPanelOptions({
      ...base,
      t: createTranslator("en"),
    }).credits!;
    expect(c).toContain("does not leave this computer");
    expect(c).toContain("Packaged build");
    expect(c).toContain("mystery 0.0.1 — unknown");
  });

  it("bản phát triển ghi rõ; libraries null ⇒ báo không đọc được, các mục khác còn nguyên", () => {
    const c = buildAboutPanelOptions({
      ...base,
      packaged: false,
      libraries: null,
      t: createTranslator("en"),
    }).credits!;
    expect(c).toContain("Development build");
    expect(c).toContain("could not be read");
    expect(c).toContain("Xenova/whisper-base (q8)");
  });

  it("không đường dẫn người dùng trong credits (chỉ icon là đường dẫn app, ở trường riêng)", () => {
    const c = buildAboutPanelOptions({
      ...base,
      t: createTranslator("vi"),
    }).credits!;
    expect(c).not.toMatch(/\/Users\/|\/Applications\/|C:\\/);
  });
});
