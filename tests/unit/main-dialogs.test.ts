import { describe, it, expect } from "vitest";
import {
  backupDialogTexts,
  exportDialogFilters,
  relinkDialogTexts,
} from "../../src/main/services/ui-language/dialog-texts";
import { trEn, trVi } from "./helpers/t-vi";

// 123 (FR-008, T055): hộp thoại hệ thống do main mở — tiêu đề + tên bộ lọc theo ngôn ngữ giao diện.

describe("dialog texts", () => {
  it("sao lưu / khôi phục", () => {
    expect(backupDialogTexts(trVi)).toEqual({
      saveTitle: "Sao lưu vault",
      openTitle: "Khôi phục vault",
      filters: [{ name: "Bản sao lưu SourceCraft", extensions: ["ivbackup"] }],
    });
    expect(backupDialogTexts(trEn).saveTitle).toBe("Back up vault");
    expect(backupDialogTexts(trEn).filters[0].name).toBe("SourceCraft backup");
  });

  it("chọn lại tệp gốc giữ đuôi tệp truyền vào", () => {
    expect(relinkDialogTexts(trEn, ["pdf"])).toEqual({
      title: "Choose original file",
      filters: [{ name: "Source files", extensions: ["pdf"] }],
    });
    expect(relinkDialogTexts(trVi, ["mp3"]).title).toBe("Chọn lại tệp gốc");
  });

  it("xuất Markdown", () => {
    expect(exportDialogFilters(trEn)).toEqual([
      { name: "Markdown", extensions: ["md"] },
    ]);
  });
});
