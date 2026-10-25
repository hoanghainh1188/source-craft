import type { Widen } from "../translate";

// 123 — khoá dịch domain "studio" (vi nguồn as const; en phải cùng cấu trúc + placeholder).

export const studioVi = {
  title: "Studio",
  hint: "Tạo nhanh bản tổng hợp từ nguồn của notebook.",
  blockModel: "Mô hình AI chưa sẵn sàng. Kiểm tra Cài đặt để chọn mô hình.",
  blockNoSources: "Nạp nguồn để tạo Studio.",
  // 178 (PR 4): bộ chọn phạm vi nhiều nguồn (disclosure + checkbox) + phạm vi của phiên bản trên thẻ
  scope: {
    toggleAll: "Phạm vi: Tất cả nguồn",
    toggleCount: {
      one: "Phạm vi: {count} nguồn",
      other: "Phạm vi: {count} nguồn",
    },
    listLabel: "Chọn nguồn để tổng hợp",
    all: "Tất cả nguồn",
    limit: "Tối đa {max} nguồn.",
    changed: "Phạm vi nguồn đã đổi: có nguồn đã chọn không còn sẵn sàng.",
    versionCount: {
      one: "Phạm vi: {count} nguồn",
      other: "Phạm vi: {count} nguồn",
    },
    deletedSource: {
      one: "{count} nguồn đã xoá",
      other: "{count} nguồn đã xoá",
    },
  },
  creating: "Đang tạo…",
  regenerate: "Tạo lại",
  kind: {
    summary: "Tóm tắt tài liệu",
    keyPoints: "Ý chính",
    faq: "FAQ",
    outline: "Dàn ý",
    // 178: 4 loại mới (keyTerms = bảng thuật ngữ rút từ nguồn, khác glossary dự án)
    studyGuide: "Hướng dẫn học",
    briefing: "Bản tóm lược",
    timeline: "Dòng thời gian",
    keyTerms: "Bảng thuật ngữ",
    custom: "Yêu cầu tuỳ chỉnh", // 178 PR 3
    documentDiff: "So sánh văn bản", // 233: so sánh bản gốc ↔ bản sửa đổi
  },
  // 178 (PR 3): ô yêu cầu tuỳ chỉnh dưới lưới nút
  custom: {
    label: "Yêu cầu tuỳ chỉnh",
    placeholder: "VD: Liệt kê các rủi ro pháp lý và điều khoản liên quan",
    counter: "{n}/{max}",
    tooLong: "Tối đa {max} ký tự.",
    submit: "Tạo",
    submitAria: "Tạo theo yêu cầu tuỳ chỉnh",
    requestHeading: "Yêu cầu",
  },
  // 233: bộ chọn so sánh văn bản & hợp đồng đối chiếu rủi ro
  diff: {
    base: "Bản gốc",
    revised: "Bản sửa đổi",
    swap: "Hoán đổi",
    run: "So sánh",
    pick: "Chọn tài liệu…",
    disclaimer:
      "Phân tích dựa trên nội dung tài liệu, không thay thế tư vấn pháp lý.",
  },
  localRetry: "Tạo bằng AI cục bộ",
  localRetryAria: "Tạo {kind} bằng AI cục bộ",
  retryAria: "Thử lại {kind}",
  localBadge: "AI cục bộ",
  localBadgeTitle:
    "Kết quả này được tạo bằng AI cục bộ (Ollama) vì AI online gặp lỗi.",
  parts: {
    one: "Tổng hợp từ {count} phần của tài liệu — mỗi trích dẫn [n] vẫn trỏ đúng đoạn nguồn.",
    other:
      "Tổng hợp từ {count} phần của tài liệu — mỗi trích dẫn [n] vẫn trỏ đúng đoạn nguồn.",
  },
  truncated:
    "Tài liệu quá dài nên phần cuối chưa được tổng hợp — hãy lọc theo từng nguồn để tổng hợp đầy đủ.",
  exportName: "{kind} — {date}",
  exportFormats: {
    md: "Markdown (.md)",
    docx: "Word (.docx)",
    pdf: "PDF (.pdf)",
    proBadge: "PRO",
  },
  // 149: Huỷ (nhãn hiển thị dùng common.cancel)
  cancelAria: "Huỷ tạo {kind}",
  cancelling: "Đang huỷ…",
  // 178: lịch sử phiên bản trên thẻ kết quả
  versions: {
    labelAria: "Phiên bản {kind}",
    option: "Bản {n}/{total} · {time}",
    delete: "Xoá phiên bản",
    deleteAria: "Xoá phiên bản đang xem của {kind}",
    confirmLabel: "Xác nhận xoá phiên bản {kind}",
    confirmBody: "Xoá phiên bản này? Không thể hoàn tác.",
    deleteFailed: "Không xoá được phiên bản. Hãy thử lại.",
  },
  // 146 (clarify #11): tiến độ khi tạo
  progress: {
    reading: "Đang đọc phần {i}/{n}…",
    readingNoCount: "Đang đọc tài liệu…",
    condensing: "Đang rút gọn ghi chú…",
    writing: "Đang viết…",
    label: "Tiến độ tạo {kind}",
  },
} as const;

export const studioEn: Widen<typeof studioVi> = {
  title: "Studio",
  hint: "Quickly create summaries from this notebook's sources.",
  blockModel: "The AI model is not ready. Check Settings to choose a model.",
  blockNoSources: "Add sources to use Studio.",
  scope: {
    toggleAll: "Scope: All sources",
    toggleCount: {
      one: "Scope: {count} source",
      other: "Scope: {count} sources",
    },
    listLabel: "Choose sources to synthesize",
    all: "All sources",
    limit: "Up to {max} sources.",
    changed: "Source scope changed: a selected source is no longer ready.",
    versionCount: {
      one: "Scope: {count} source",
      other: "Scope: {count} sources",
    },
    deletedSource: {
      one: "{count} deleted source",
      other: "{count} deleted sources",
    },
  },
  creating: "Creating…",
  regenerate: "Regenerate",
  kind: {
    summary: "Document summary",
    keyPoints: "Key points",
    faq: "FAQ",
    outline: "Outline",
    studyGuide: "Study guide",
    briefing: "Briefing",
    timeline: "Timeline",
    keyTerms: "Glossary",
    custom: "Custom request",
    documentDiff: "Compare documents",
  },
  custom: {
    label: "Custom request",
    placeholder: "e.g. List the legal risks and related clauses",
    counter: "{n}/{max}",
    tooLong: "Up to {max} characters.",
    submit: "Create",
    submitAria: "Create from custom request",
    requestHeading: "Request",
  },
  diff: {
    base: "Original",
    revised: "Revised",
    swap: "Swap",
    run: "Compare",
    pick: "Choose a document…",
    disclaimer: "Based on the documents' text only — not legal advice.",
  },
  localRetry: "Create with local AI",
  localRetryAria: "Create {kind} with local AI",
  retryAria: "Retry {kind}",
  localBadge: "Local AI",
  localBadgeTitle:
    "This result was created with local AI (Ollama) because the online AI failed.",
  parts: {
    one: "Combined from {count} part of the document — each [n] citation still points to the right source passage.",
    other:
      "Combined from {count} parts of the document — each [n] citation still points to the right source passage.",
  },
  truncated:
    "The document is too long, so the last part wasn't summarized — filter by individual source for a complete summary.",
  exportName: "{kind} — {date}",
  exportFormats: {
    md: "Markdown (.md)",
    docx: "Word (.docx)",
    pdf: "PDF (.pdf)",
    proBadge: "PRO",
  },
  cancelAria: "Cancel creating {kind}",
  cancelling: "Cancelling…",
  versions: {
    labelAria: "{kind} version",
    option: "Version {n}/{total} · {time}",
    delete: "Delete version",
    deleteAria: "Delete the shown version of {kind}",
    confirmLabel: "Confirm deleting {kind} version",
    confirmBody: "Delete this version? This can't be undone.",
    deleteFailed: "Couldn't delete the version. Please try again.",
  },
  progress: {
    reading: "Reading part {i} of {n}…",
    readingNoCount: "Reading the document…",
    condensing: "Condensing notes…",
    writing: "Writing…",
    label: "{kind} progress",
  },
};
