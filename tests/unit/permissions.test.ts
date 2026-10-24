import { describe, it, expect } from "vitest";
import {
  decideMediaPermission,
  decidePermissionCheck,
  isAppOrigin,
} from "../../src/main/services/app-shell/permissions";

// 186 — chính sách quyền session (R11, A5): CHỈ micro (audio-only), cửa sổ chính, trong cổng 15 s sau hành động người
// dùng; mọi quyền khác vẫn từ chối như trước. Hàm thuần.

const FILE_URL =
  "file:///Applications/SourceCraft.app/Contents/Resources/app.asar/out/renderer/index.html#/workspace/nb1";
const PROD = { devUrl: undefined };
const base = {
  permission: "media",
  mediaTypes: ["audio"] as readonly string[],
  requestingUrl: FILE_URL,
  isMainFrame: true,
  isMainWindow: true,
  armedUntil: 10_000,
  now: 5_000,
  ...PROD,
};

describe("isAppOrigin", () => {
  it("bản đóng gói: file:// của app", () => {
    expect(isAppOrigin(FILE_URL, undefined)).toBe(true);
    expect(isAppOrigin("https://evil.example/", undefined)).toBe(false);
    expect(isAppOrigin("http://localhost:5173/", undefined)).toBe(false);
  });

  it("dev: đúng origin của ELECTRON_RENDERER_URL", () => {
    expect(
      isAppOrigin("http://localhost:5173/#/x", "http://localhost:5173"),
    ).toBe(true);
    expect(isAppOrigin("http://localhost:5174/", "http://localhost:5173")).toBe(
      false,
    );
    expect(
      isAppOrigin("http://localhost:5173.evil.com/", "http://localhost:5173"),
    ).toBe(false);
  });

  it("URL hỏng ⇒ false", () => {
    expect(isAppOrigin("not a url", undefined)).toBe(false);
  });
});

describe("decideMediaPermission", () => {
  it("cho phép: media audio-only, đúng origin, cửa sổ chính, main frame, trong cổng", () => {
    expect(decideMediaPermission(base)).toBe(true);
  });

  it.each([
    ["có video", { mediaTypes: ["audio", "video"] }],
    ["chỉ video", { mediaTypes: ["video"] }],
    ["mediaTypes rỗng", { mediaTypes: [] }],
    ["mediaTypes thiếu", { mediaTypes: undefined }],
    ["hết cổng", { now: 10_000 }],
    ["chưa mở cổng", { armedUntil: 0 }],
    ["không phải cửa sổ chính", { isMainWindow: false }],
    ["iframe", { isMainFrame: false }],
    ["origin lạ", { requestingUrl: "https://evil.example/" }],
  ])("từ chối khi %s", (_n, over) => {
    expect(decideMediaPermission({ ...base, ...over })).toBe(false);
  });

  it.each([
    "geolocation",
    "notifications",
    "clipboard-read",
    "midi",
    "openExternal",
    "fullscreen",
    "camera",
  ])("mọi quyền khác (%s) vẫn từ chối kể cả trong cổng", (permission) => {
    expect(decideMediaPermission({ ...base, permission })).toBe(false);
  });
});

describe("decidePermissionCheck", () => {
  const check = {
    permission: "media",
    mediaType: "audio",
    requestingUrl: FILE_URL,
    isMainWindow: true,
    devUrl: undefined,
  };

  it("media/audio từ cửa sổ chính của app ⇒ true", () => {
    expect(decidePermissionCheck(check)).toBe(true);
  });

  it.each([
    ["video", { mediaType: "video" }],
    ["không rõ loại", { mediaType: undefined }],
    ["quyền khác", { permission: "geolocation" }],
    ["cửa sổ khác", { isMainWindow: false }],
    ["origin lạ", { requestingUrl: "https://evil.example/" }],
  ])("từ chối khi %s", (_n, over) => {
    expect(decidePermissionCheck({ ...check, ...over })).toBe(false);
  });
});

describe("createMicGate", () => {
  it("mở cổng ARM_WINDOW_MS từ thời điểm arm; đóng thủ công được", async () => {
    const { createMicGate } =
      await import("../../src/main/services/app-shell/permissions");
    let t = 1000;
    const gate = createMicGate(() => t, 15_000);
    expect(gate.armedUntil()).toBe(0);
    gate.arm();
    expect(gate.armedUntil()).toBe(16_000);
    t = 5000;
    gate.arm();
    expect(gate.armedUntil()).toBe(20_000);
    gate.disarm();
    expect(gate.armedUntil()).toBe(0);
  });
});

describe("isAppOrigin — bản đóng gói chỉ nhận đúng index.html của app (review L1)", () => {
  const INDEX =
    "file:///Applications/SourceCraft.app/Contents/Resources/app.asar/out/renderer/index.html";
  it("đúng tệp index (bỏ qua hash/query) ⇒ true; tệp file:// khác ⇒ false", () => {
    expect(isAppOrigin(`${INDEX}#/workspace/nb1`, undefined, INDEX)).toBe(true);
    expect(isAppOrigin(`${INDEX}?x=1`, undefined, INDEX)).toBe(true);
    expect(isAppOrigin("file:///tmp/evil.html", undefined, INDEX)).toBe(false);
    expect(
      isAppOrigin(
        "file:///Applications/SourceCraft.app/Contents/Resources/app.asar/out/renderer/other.html",
        undefined,
        INDEX,
      ),
    ).toBe(false);
  });

  it("decideMediaPermission dùng appIndexUrl khi có", () => {
    expect(
      decideMediaPermission({
        ...base,
        appIndexUrl: INDEX,
        requestingUrl: "file:///tmp/evil.html",
      }),
    ).toBe(false);
    expect(
      decideMediaPermission({
        ...base,
        appIndexUrl: INDEX,
        requestingUrl: `${INDEX}#/workspace/nb1`,
      }),
    ).toBe(true);
  });
});
