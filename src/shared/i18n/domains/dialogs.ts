import type { Widen } from "../translate";

// 123 — hộp thoại hệ thống do main mở (lỗi khởi động, thư mục dữ liệu, sao lưu/khôi phục, chọn lại tệp gốc, xuất).
// Main dịch theo ngôn ngữ hiệu lực (hộp thoại lỗi khởi động: theo locale OS vì cài đặt chưa sẵn).

export const dialogsVi = {
  schemaNewer: {
    title: "Cần cập nhật SourceCraft",
    detail:
      "Dữ liệu trên máy được tạo bởi một phiên bản SourceCraft mới hơn (schema v{dbVersion}), trong khi bản đang chạy chỉ hỗ trợ tới v{appVersion}.\n\nVui lòng cập nhật SourceCraft lên phiên bản mới nhất rồi mở lại. Dữ liệu của bạn vẫn an toàn — ứng dụng cố ý không hạ cấp để tránh mất dữ liệu.",
  },
  startupError: {
    title: "SourceCraft gặp lỗi khi khởi động",
    detail:
      "Ứng dụng không thể khởi động (loại lỗi: {errorType}).\n\nVui lòng mở lại ứng dụng. Nếu vẫn lỗi, hãy cập nhật lên phiên bản mới nhất.",
  },
  dataDir: {
    title: "Không tạo được thư mục dữ liệu",
    detail:
      "SourceCraft không thể tạo thư mục dữ liệu tại:\n{path}\n\nKiểm tra quyền truy cập hoặc dung lượng ổ đĩa rồi mở lại ứng dụng.",
  },
  backup: {
    title: "Sao lưu vault",
    filter: "Bản sao lưu SourceCraft",
  },
  restore: {
    title: "Khôi phục vault",
  },
  relink: {
    title: "Chọn lại tệp gốc",
    filter: "Tệp nguồn",
  },
  export: {
    filter: "Markdown",
    filterDocx: "Tài liệu Microsoft Word (.docx)",
    filterPdf: "Tài liệu PDF (.pdf)",
  },
} as const;

export const dialogsEn: Widen<typeof dialogsVi> = {
  schemaNewer: {
    title: "Please update SourceCraft",
    detail:
      "The data on this computer was created by a newer version of SourceCraft (schema v{dbVersion}), but this version only supports up to v{appVersion}.\n\nPlease update SourceCraft to the latest version and open it again. Your data is safe — the app deliberately doesn't downgrade to avoid data loss.",
  },
  startupError: {
    title: "SourceCraft failed to start",
    detail:
      "The app couldn't start (error type: {errorType}).\n\nPlease reopen the app. If the error persists, update to the latest version.",
  },
  dataDir: {
    title: "Couldn't create the data folder",
    detail:
      "SourceCraft couldn't create its data folder at:\n{path}\n\nCheck the folder permissions or free disk space, then reopen the app.",
  },
  backup: {
    title: "Back up vault",
    filter: "SourceCraft backup",
  },
  restore: {
    title: "Restore vault",
  },
  relink: {
    title: "Choose original file",
    filter: "Source files",
  },
  export: {
    filter: "Markdown",
    filterDocx: "Microsoft Word Document (.docx)",
    filterPdf: "PDF Document (.pdf)",
  },
};
