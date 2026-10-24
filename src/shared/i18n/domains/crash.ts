import type { Widen } from "../translate";

// 123 — khoá dịch domain "crash" (hộp thoại Báo lỗi + dải thông báo phiên trước đóng bất thường — 093).

export const crashVi = {
  dialog: {
    title: "Báo lỗi cho nhà phát triển",
    loading: "Đang soạn báo cáo từ nhật ký…",
    loadFailed:
      "Không soạn được báo cáo. Bạn vẫn có thể mở thư mục nhật ký ở Cài đặt → Lưu trữ và gửi tệp main.log.",
    descBefore:
      "Nội dung dưới đây được soạn từ nhật ký trên máy — không chứa nội dung tài liệu, câu hỏi hay câu trả lời. Bạn có thể sửa trước khi gửi. SourceCraft",
    descStrong: "không tự gửi",
    descAfter:
      ": bấm “Mở GitHub” để mở trình duyệt với báo cáo điền sẵn rồi tự bấm gửi ở đó.",
    titleLabel: "Tiêu đề",
    textLabel: "Nội dung báo cáo",
    sending: "Đang mở…",
    send: "Mở GitHub để gửi",
    sent: "Đã mở trình duyệt với báo cáo điền sẵn. Hoàn tất bằng nút “Submit new issue” trên GitHub (cần tài khoản GitHub). Cảm ơn bạn!",
  },
  problem: {
    browser:
      "Không mở được trình duyệt. Hãy bấm “Sao chép” rồi dán vào email hoặc trang GitHub của dự án.",
    throttled: "Vừa mở trình duyệt — đợi vài giây rồi thử lại.",
    copy: "Không sao chép được. Hãy chọn nội dung trong ô và sao chép thủ công.",
  },
  notice: {
    abnormal: "Lần trước SourceCraft đóng bất thường.",
    crashes: {
      one: "SourceCraft đã gặp sự cố {count} lần.",
      other: "SourceCraft đã gặp sự cố {count} lần.",
    },
    abnormalWithCrashes: {
      one: "Lần trước SourceCraft đóng bất thường (SourceCraft đã gặp sự cố {count} lần).",
      other:
        "Lần trước SourceCraft đóng bất thường (SourceCraft đã gặp sự cố {count} lần).",
    },
    invite:
      "Bạn có muốn gửi báo cáo lỗi (không chứa nội dung tài liệu) để giúp sửa không?",
    open: "Xem & gửi báo cáo",
    dismiss: "Bỏ qua",
  },
} as const;

export const crashEn: Widen<typeof crashVi> = {
  dialog: {
    title: "Report a problem to the developers",
    loading: "Preparing the report from logs…",
    loadFailed:
      "Couldn't prepare the report. You can still open the log folder in Settings → Storage and send the main.log file.",
    descBefore:
      "The content below is prepared from the logs on this computer — it contains no document content, questions or answers. You can edit it before sending. SourceCraft",
    descStrong: "does not send anything by itself",
    descAfter:
      ": click “Open GitHub” to open your browser with the report pre-filled, then submit it there yourself.",
    titleLabel: "Title",
    textLabel: "Report content",
    sending: "Opening…",
    send: "Open GitHub to send",
    sent: "Your browser has opened with the report pre-filled. Finish by clicking “Submit new issue” on GitHub (a GitHub account is required). Thank you!",
  },
  problem: {
    browser:
      "Couldn't open the browser. Click “Copy”, then paste it into an email or the project's GitHub page.",
    throttled:
      "The browser was just opened — wait a few seconds and try again.",
    copy: "Couldn't copy. Select the content in the box and copy it manually.",
  },
  notice: {
    abnormal: "SourceCraft closed unexpectedly last time.",
    crashes: {
      one: "SourceCraft crashed {count} time.",
      other: "SourceCraft crashed {count} times.",
    },
    abnormalWithCrashes: {
      one: "SourceCraft closed unexpectedly last time (it crashed {count} time).",
      other:
        "SourceCraft closed unexpectedly last time (it crashed {count} times).",
    },
    invite:
      "Would you like to send an error report (with no document content) to help fix it?",
    open: "View & send report",
    dismiss: "Dismiss",
  },
};
