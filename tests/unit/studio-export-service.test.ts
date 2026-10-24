import { describe, it, expect, vi } from "vitest";
import { exportFormattedDocument } from "../../src/main/services/studio/export";
import { createTranslator } from "../../src/shared/i18n";

const mockTranslator = createTranslator("vi");

describe("exportFormattedDocument (232 studio export)", () => {
  it("saves markdown file when format is md", async () => {
    const writtenFiles: Record<string, string | Buffer> = {};
    const res = await exportFormattedDocument(
      null,
      {
        content: "# Markdown content",
        suggestedName: "Báo cáo tổng hợp",
        format: "md",
      },
      mockTranslator,
      {
        showSaveDialog: async () => ({
          canceled: false,
          filePath: "/path/to/report.md",
        }),
        writeFile: async (path, data) => {
          writtenFiles[path] = data;
        },
      },
    );

    expect(res.saved).toBe(true);
    expect(res.path).toBe("/path/to/report.md");
    expect(writtenFiles["/path/to/report.md"]).toBe("# Markdown content");
  });

  it("saves docx file when format is docx", async () => {
    const writtenFiles: Record<string, string | Buffer> = {};
    const res = await exportFormattedDocument(
      null,
      {
        content: "# DOCX content",
        suggestedName: "Báo cáo Word",
        format: "docx",
        options: {
          title: "Báo Cáo Word",
          organization: "Công Ty ABC",
        },
      },
      mockTranslator,
      {
        showSaveDialog: async () => ({
          canceled: false,
          filePath: "/path/to/report.docx",
        }),
        writeFile: async (path, data) => {
          writtenFiles[path] = data;
        },
      },
    );

    expect(res.saved).toBe(true);
    expect(res.path).toBe("/path/to/report.docx");
    const buf = writtenFiles["/path/to/report.docx"] as Buffer;
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.length).toBeGreaterThan(100);
  });

  it("saves pdf file when format is pdf", async () => {
    const writtenFiles: Record<string, string | Buffer> = {};
    const fakePdf = Buffer.from("%PDF-1.4 mock content");
    const res = await exportFormattedDocument(
      null,
      {
        content: "# PDF content",
        suggestedName: "Báo cáo PDF",
        format: "pdf",
      },
      mockTranslator,
      {
        showSaveDialog: async () => ({
          canceled: false,
          filePath: "/path/to/report.pdf",
        }),
        generatePdf: async () => fakePdf,
        writeFile: async (path, data) => {
          writtenFiles[path] = data;
        },
      },
    );

    expect(res.saved).toBe(true);
    expect(res.path).toBe("/path/to/report.pdf");
    expect(writtenFiles["/path/to/report.pdf"]).toEqual(fakePdf);
  });

  it("returns saved: false when user cancels save dialog", async () => {
    const writeFileSpy = vi.fn();
    const res = await exportFormattedDocument(
      null,
      {
        content: "Nội dung",
        suggestedName: "Báo cáo",
        format: "md",
      },
      mockTranslator,
      {
        showSaveDialog: async () => ({ canceled: true }),
        writeFile: writeFileSpy,
      },
    );

    expect(res.saved).toBe(false);
    expect(writeFileSpy).not.toHaveBeenCalled();
  });

  it("throws error when content or suggestedName is invalid", async () => {
    await expect(
      exportFormattedDocument(
        null,
        { content: 123 as unknown as string, suggestedName: "Test" },
        mockTranslator,
      ),
    ).rejects.toThrow("Invalid export request.");
  });
});
