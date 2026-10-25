import type { Widen } from "../translate";

// 123 — khoá dịch domain "chat" (vi nguồn as const; en phải cùng cấu trúc + placeholder).

export const chatVi = {
  title: "Hỏi đáp",
  clear: "Xoá hội thoại",
  threadLabel: "Hội thoại",
  empty: "Đặt câu hỏi về các nguồn trong notebook này.",
  blockRuntime:
    "AI cục bộ (Ollama) chưa sẵn sàng. Mở Cài đặt để bật/chọn mô hình.",
  blockNoSources: "Nạp nguồn để bắt đầu hỏi đáp.",
  localRetry: "Trả lời bằng AI cục bộ",
  placeholder: "Nhập câu hỏi…",
  modelChip: "Local · {model}",
  modelNone: "chưa chọn",
  modelChipTitle: "Mô hình đang dùng — đổi ở mục Cài đặt",
  send: "Gửi",
  stop: "Dừng",
  you: "Bạn",
  mode: {
    groupLabel: "Chế độ trả lời",
    grounded: "Theo nguồn",
    open: "Mở rộng",
    groundedHint: "Theo nguồn: chỉ trả lời từ tài liệu đã nạp, không bịa.",
    openHint:
      "Mở rộng: dùng thêm kiến thức chung, phần ngoài nguồn được gắn nhãn.",
  },
  scope: {
    groupLabel: "Phạm vi tìm kiếm",
    current: "Sổ tay này",
    all: "Toàn bộ kho tri thức",
    proBadge: "PRO",
    proTooltip: "Tìm kiếm toàn cục đa sổ tay (Bản quyền Pro/Enterprise)",
    lockedTooltip:
      "Tìm kiếm toàn cục đa sổ tay yêu cầu bản quyền Pro hoặc Enterprise",
  },
  domain: {
    groupLabel: "Chuyên ngành",
    general: "Chung",
    legal: "Pháp lý & Hợp đồng",
    medical: "Y tế & Lâm sàng",
    proBadge: "PRO",
    proTooltip: "Chế độ chuyên gia (Bản quyền Pro/Enterprise)",
    lockedTooltip: "Chế độ chuyên gia yêu cầu bản quyền Pro hoặc Enterprise",
    disclaimerMedical:
      "Thông tin trên chỉ mang tính chất tham khảo y khoa từ tài liệu nạp, không thay thế chẩn đoán hoặc chỉ định trực tiếp từ bác sĩ chuyên khoa.",
  },
  ungroundedBadge: "Mở rộng · có thể ngoài nguồn",
  ungroundedTitle:
    "Câu trả lời ở chế độ Mở rộng có thể chứa kiến thức ngoài tài liệu nguồn.",
  localBadge: "AI cục bộ",
  localBadgeTitle:
    "Lượt này được trả lời bằng AI cục bộ (Ollama) vì AI online gặp lỗi.",
  sourcesLabel: "Nguồn:",
  page: "trang {page}",
  actions: {
    export: "Xuất",
    exported: "Đã xuất tệp.",
    exportFailed: "Không xuất được tệp.",
    copyFailed: "Không sao chép được.",
  },
  exportName: "Câu trả lời — {date}",
  errors: {
    clearFailed: "Không xoá được hội thoại.",
    notSent: "Chưa gửi được — kiểm tra AI trong Cài đặt rồi thử lại.",
  },
  notFound: "Không tìm thấy trong nguồn.",
  notFoundHint:
    "Thử hỏi cụ thể hơn, hoặc chuyển sang chế độ Mở rộng nếu chấp nhận nội dung ngoài tài liệu.",
  reindexing:
    "Đang tái lập chỉ mục nguồn (cập nhật công cụ tìm kiếm cục bộ). Vui lòng thử lại sau giây lát.",
} as const;

export const chatEn: Widen<typeof chatVi> = {
  title: "Chat",
  clear: "Clear conversation",
  threadLabel: "Conversation",
  empty: "Ask a question about the sources in this notebook.",
  blockRuntime:
    "Local AI (Ollama) is not ready. Open Settings to turn it on or choose a model.",
  blockNoSources: "Add sources to start asking questions.",
  localRetry: "Answer with local AI",
  placeholder: "Type a question…",
  modelChip: "Local · {model}",
  modelNone: "not selected",
  modelChipTitle: "Model in use — change it in Settings",
  send: "Send",
  stop: "Stop",
  you: "You",
  mode: {
    groupLabel: "Answer mode",
    grounded: "Sources only",
    open: "Extended",
    groundedHint:
      "Sources only: answers only from your added documents, no making things up.",
    openHint:
      "Extended: also uses general knowledge; content beyond your sources is labeled.",
  },
  scope: {
    groupLabel: "Search scope",
    current: "Current notebook",
    all: "All notebooks",
    proBadge: "PRO",
    proTooltip:
      "Cross-notebook search across all notebooks (Pro/Enterprise license)",
    lockedTooltip: "Cross-notebook search requires a Pro or Enterprise license",
  },
  domain: {
    groupLabel: "Domain",
    general: "General",
    legal: "Legal & Contracts",
    medical: "Medical & Clinical",
    proBadge: "PRO",
    proTooltip: "Specialist mode (Pro/Enterprise license)",
    lockedTooltip: "Specialist mode requires a Pro or Enterprise license",
    disclaimerMedical:
      "The information provided is for medical reference from ingested documents only and does not replace professional clinical diagnosis or medical advice.",
  },
  ungroundedBadge: "Extended · may go beyond sources",
  ungroundedTitle:
    "Answers in Extended mode may contain knowledge from outside your source documents.",
  localBadge: "Local AI",
  localBadgeTitle:
    "This turn was answered with local AI (Ollama) because the online AI failed.",
  sourcesLabel: "Sources:",
  page: "page {page}",
  actions: {
    export: "Export",
    exported: "File exported.",
    exportFailed: "Couldn't export the file.",
    copyFailed: "Couldn't copy.",
  },
  exportName: "Answer — {date}",
  errors: {
    clearFailed: "Couldn't clear the conversation.",
    notSent: "Couldn't send — check AI in Settings and try again.",
  },
  notFound: "Not found in the sources.",
  notFoundHint:
    "Try asking more specifically, or switch to Extended mode if you accept content beyond your documents.",
  reindexing:
    "Reindexing sources (updating the local search engine). Please try again in a moment.",
};
