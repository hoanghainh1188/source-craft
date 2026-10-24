import { describe, it, expect } from "vitest";
import {
  buildAppInfo,
  APP_NAME,
} from "../../src/main/services/app-shell/app-info";

describe("app-info", () => {
  it("tên app là SourceCraft", () => {
    expect(buildAppInfo("1.2.3").name).toBe(APP_NAME);
    expect(APP_NAME).toBe("SourceCraft");
  });

  it("version truyền qua nguyên vẹn", () => {
    expect(buildAppInfo("0.1.0").version).toBe("0.1.0");
  });
});
