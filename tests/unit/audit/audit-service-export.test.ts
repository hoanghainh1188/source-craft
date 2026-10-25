import { describe, expect, it } from "vitest";
import { harness } from "./service-harness";

// T020 (236) — export.saved (FR-015): tên sổ tay tra từ dep, chỉ basename, không bao giờ ném.

describe("AuditService.recordExport", () => {
  it("active ⇒ export.saved; notebookName tra từ dep; fileName chỉ basename", async () => {
    const h = harness();
    await h.service.start();
    await h.service.recordExport({
      format: "pdf",
      notebookId: "nb_7",
      studioKind: "summary",
      fileName: "/Users/an/Desktop/Bao cao.pdf",
    });
    expect(h.records().at(-1)).toMatchObject({
      type: "export.saved",
      osUser: "CORP\\nguyen.an",
      format: "pdf",
      notebookId: "nb_7",
      notebookName: "Hợp đồng 2026",
      studioKind: "summary",
      fileName: "Bao cao.pdf",
    });
  });

  it("Windows path ⇒ basename; notebookId/studioKind sai kiểu ⇒ null / bỏ trường", async () => {
    const h = harness();
    await h.service.start();
    await h.service.recordExport({
      format: "md",
      notebookId: 123,
      studioKind: "evil",
      fileName: "C:\\Users\\an\\Report.md",
    });
    const r = h.records().at(-1)!;
    expect(r).toMatchObject({
      notebookId: null,
      notebookName: null,
      fileName: "Report.md",
    });
    expect("studioKind" in r).toBe(false);
  });

  it("off ⇒ không ghi", async () => {
    const h = harness({ policy: { status: "notConfigured" } });
    await h.service.start();
    await h.service.recordExport({ format: "pdf", fileName: "a.pdf" });
    expect(h.fs.files.size).toBe(0);
  });

  it("ghi lỗi ⇒ không ném, status blocked", async () => {
    const h = harness();
    await h.service.start();
    h.fs.failAppend = { code: "ENOSPC" };
    await expect(
      h.service.recordExport({ format: "pdf", fileName: "a.pdf" }),
    ).resolves.toBeUndefined();
    expect(h.service.status().state).toBe("blocked");
  });

  it("format lạ / notebookId quá dài từ renderer ⇒ chuẩn hoá trước khi ký (review S4)", async () => {
    const h = harness();
    await h.service.start();
    await h.service.recordExport({
      format: "<script>",
      notebookId: "x".repeat(5000),
      fileName: "a",
    });
    const r = h.records().at(-1)!;
    expect(r).toMatchObject({ format: "md", notebookId: null });
  });
});
