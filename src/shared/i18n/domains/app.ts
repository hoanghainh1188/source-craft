import type { Widen } from "../translate";

// 123 — khoá dịch domain "app" (vỏ app: rail, header, onboarding, Lưu trữ cục bộ, nhật ký lỗi, màn lỗi,
// phím tắt, markdown). vi nguồn as const; en phải cùng cấu trúc + placeholder.

export const appVi = {
  nav: {
    main: "Điều hướng chính",
    notebooks: "Notebooks",
    workspace: "Workspace",
  },
  header: {
    tagline: "· Trợ lý tri thức cục bộ",
  },
  privacy: {
    local: "Chạy cục bộ",
    checking: "Đang kiểm tra trạng thái…",
    localFull: "Chạy cục bộ · dữ liệu không rời máy",
    onlineFull: "AI online đang bật · chỉ gửi khi bạn hỏi",
    sending: {
      ai: "Đang gửi dữ liệu tới AI online…",
      url: "Đang tải trang web…",
      model: "Đang tải mô hình (cần Internet lần đầu)…",
    },
  },
  onboarding: {
    title: "Chào mừng đến SourceCraft",
    bodyBefore: "Trợ lý tri thức ",
    bodyStrong: "chạy cục bộ",
    bodyAfter:
      " — dữ liệu của bạn không rời máy. Ở các bước tiếp theo, ứng dụng sẽ giúp bạn chuẩn bị runtime AI cục bộ và tạo notebook đầu tiên.",
    start: "Bắt đầu",
  },
  workspace: {
    title: "Workspace",
    hint: "Chọn một notebook để mở không gian 3 cột Nguồn / Chat / Studio.",
    pick: "Chọn notebook",
  },
  storage: {
    title: "Lưu trữ cục bộ",
    error: "Không đọc được thông tin lưu trữ.",
    loading: "Đang tính dung lượng…",
    path: "Thư mục dữ liệu:",
    used: "Đã dùng",
    free: "Còn trống",
  },
  logs: {
    title: "Nhật ký lỗi",
    desc: "Ghi sự kiện và lỗi để chẩn đoán — không chứa nội dung tài liệu, chỉ lưu trên máy này.",
    open: "Mở thư mục nhật ký",
    openFailed: "Không mở được thư mục nhật ký.",
    report: "Báo lỗi…",
  },
  errorFallback: {
    title: "Đã xảy ra lỗi ở phần này",
    bodyBefore:
      "Dữ liệu của bạn vẫn an toàn trên máy. Hãy thử lại; nếu lỗi lặp lại, mở thư mục nhật ký và gửi tệp ",
    bodyAfter: " khi báo lỗi — nhật ký không chứa nội dung tài liệu.",
    reload: "Tải lại ứng dụng",
  },
  shortcuts: {
    title: "Phím tắt",
    newNotebook: "Tạo notebook mới",
    searchNotebook: "Tìm kiếm notebook",
    send: "Gửi câu hỏi (khung Chat)",
    newLine: "Xuống dòng trong câu hỏi",
    close: "Đóng hộp thoại / trình xem nguồn",
    help: "Mở bảng phím tắt này",
  },
  markdown: {
    truncated: "(Nội dung dài đã được rút gọn khi hiển thị.)",
  },
} as const;

export const appEn: Widen<typeof appVi> = {
  nav: {
    main: "Main navigation",
    notebooks: "Notebooks",
    workspace: "Workspace",
  },
  header: {
    tagline: "· Local knowledge assistant",
  },
  privacy: {
    local: "Running locally",
    checking: "Checking status…",
    localFull: "Running locally · data stays on this device",
    onlineFull: "Online AI is on · sends only when you ask",
    sending: {
      ai: "Sending data to online AI…",
      url: "Loading web page…",
      model: "Downloading model (Internet needed the first time)…",
    },
  },
  onboarding: {
    title: "Welcome to SourceCraft",
    bodyBefore: "A knowledge assistant that ",
    bodyStrong: "runs locally",
    bodyAfter:
      " — your data never leaves your device. In the next steps, the app will help you set up the local AI runtime and create your first notebook.",
    start: "Get started",
  },
  workspace: {
    title: "Workspace",
    hint: "Choose a notebook to open the 3-column Sources / Chat / Studio workspace.",
    pick: "Choose a notebook",
  },
  storage: {
    title: "Local storage",
    error: "Couldn't read storage information.",
    loading: "Calculating disk usage…",
    path: "Data folder:",
    used: "Used",
    free: "Free",
  },
  logs: {
    title: "Error logs",
    desc: "Records events and errors for troubleshooting — contains no document content and stays on this device.",
    open: "Open logs folder",
    openFailed: "Couldn't open the logs folder.",
    report: "Report a problem…",
  },
  errorFallback: {
    title: "Something went wrong in this section",
    bodyBefore:
      "Your data is still safe on this device. Try again; if the problem persists, open the logs folder and attach the file ",
    bodyAfter:
      " when reporting the problem — logs contain no document content.",
    reload: "Reload app",
  },
  shortcuts: {
    title: "Keyboard shortcuts",
    newNotebook: "Create a new notebook",
    searchNotebook: "Search notebooks",
    send: "Send question (Chat panel)",
    newLine: "New line in question",
    close: "Close dialog / source viewer",
    help: "Open this shortcuts panel",
  },
  markdown: {
    truncated: "(Long content was shortened for display.)",
  },
};
