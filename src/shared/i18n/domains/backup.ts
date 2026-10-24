import type { Widen } from "../translate";

// 123 — khoá dịch domain "backup" (sao lưu/khôi phục vault — 085). error.<code> theo VaultBackupErrorCode,
// step.<step> theo VaultBackupStep, busy.<reason> theo VaultBackupState.reason.

export const backupVi = {
  error: {
    busy: "Đang bận xử lý — thử lại khi xong.",
    passwordTooShort: "Mật khẩu cần tối thiểu 8 ký tự.",
    notBackup: "Không phải file sao lưu SourceCraft.",
    unsupportedFormat:
      "File sao lưu dùng định dạng mà phiên bản này chưa hỗ trợ — hãy cập nhật SourceCraft.",
    badPasswordOrCorrupt: "Sai mật khẩu hoặc file sao lưu bị hỏng.",
    passwordRequired: "File sao lưu này được bảo vệ bằng mật khẩu.",
    newerSchema:
      "Bản sao lưu được tạo từ phiên bản SourceCraft mới hơn — hãy cập nhật ứng dụng rồi thử lại.",
    diskFull: "Ổ đĩa không đủ dung lượng trống.",
    tokenInvalid: "Phiên khôi phục đã hết hạn — hãy chọn lại file.",
    ioError:
      "Không đọc/ghi được file. Kiểm tra quyền truy cập hoặc vị trí lưu.",
  },
  step: {
    snapshot: "Đang chụp dữ liệu…",
    pack: "Đang nén và ghi file…",
    decrypt: "Đang giải mã và giải nén…",
    verify: "Đang kiểm tra dữ liệu…",
    preBackup: "Đang sao lưu vault hiện tại…",
  },
  busy: {
    processing: "Đang xử lý nguồn…",
    reindexing: "Đang tái lập chỉ mục…",
    operation: "Đang sao lưu/khôi phục…",
  },
  panel: {
    title: "Sao lưu & khôi phục",
    desc: "Xuất toàn bộ vault ra một file để giữ an toàn hoặc chuyển sang máy khác. Khôi phục sẽ thay thế toàn bộ dữ liệu hiện tại.",
    backup: "Sao lưu…",
    restore: "Khôi phục…",
  },
  dialog: {
    title: "Sao lưu vault",
    descBefore:
      "Lưu toàn bộ notebook, nguồn đã xử lý, lịch sử chat, kết quả Studio và cấu hình vào một file",
    descAfter: ". Không gồm file gốc (PDF, audio, video, ảnh) và khoá API.",
    meetingsIncluded: "Gồm ghi âm cuộc họp: {size}.",
    protect: "Bảo vệ bằng mật khẩu",
    password: "Mật khẩu",
    passwordConfirm: "Nhập lại mật khẩu",
    pwTooShort: "Mật khẩu cần tối thiểu 8 ký tự.",
    pwMismatch: "Hai lần nhập chưa khớp.",
    noRecoveryStrong: "Không có cách lấy lại mật khẩu.",
    noRecoveryRest: "Quên mật khẩu đồng nghĩa không mở được bản sao lưu này.",
    unencryptedWarning:
      "File không mã hoá: ai có file đều đọc được nội dung tài liệu của bạn. Hãy cất ở nơi an toàn hoặc bật mật khẩu.",
    chooseLocation: "Chọn nơi lưu…",
    waitingLocation: "Đang chờ chọn nơi lưu…",
    doneBefore: "Đã sao lưu",
    doneSize: "({size}) vào",
    doneEnd: ".",
    finish: "Xong",
  },
  restore: {
    title: "Khôi phục vault",
    passwordProtected: "File sao lưu này được bảo vệ bằng mật khẩu.",
    unlock: "Mở bản sao lưu",
    reading: "Đang đọc bản sao lưu…",
    createdAt: "Ngày tạo",
    contents: "Nội dung",
    notebookCount: { one: "{count} notebook", other: "{count} notebook" },
    sourceCount: { one: "{count} nguồn", other: "{count} nguồn" },
    version: "Phiên bản",
    encryption: "Mã hoá",
    encrypted: "Có mật khẩu",
    notEncrypted: "Không",
    needsReindex:
      "Bản sao lưu dùng mô hình lập chỉ mục khác — sau khi khôi phục, app sẽ tái lập chỉ mục ở nền.",
    overwriteStrong: "Toàn bộ vault hiện tại sẽ bị thay thế",
    overwriteBefore:
      "bằng bản sao lưu này. Vault hiện tại sẽ được tự sao lưu (không mã hoá, nằm cùng thư mục dữ liệu) vào",
    overwriteAfter: " trước, sau đó app khởi động lại.",
    confirm: "Khôi phục và khởi động lại",
  },
  result: {
    okBefore: "Đã khôi phục vault từ bản sao lưu ngày",
    okEnd: ".",
    previousSavedAt: "Vault trước đó được lưu tại",
    failed: "Khôi phục không thành công — vault trước đó được giữ nguyên.",
  },
} as const;

export const backupEn: Widen<typeof backupVi> = {
  error: {
    busy: "Busy processing — try again when it's done.",
    passwordTooShort: "The password must be at least 8 characters.",
    notBackup: "This isn't a SourceCraft backup file.",
    unsupportedFormat:
      "This backup file uses a format this version doesn't support yet — please update SourceCraft.",
    badPasswordOrCorrupt: "Wrong password, or the backup file is damaged.",
    passwordRequired: "This backup file is password-protected.",
    newerSchema:
      "This backup was created by a newer version of SourceCraft — update the app, then try again.",
    diskFull: "Not enough free disk space.",
    tokenInvalid:
      "The restore session has expired — please choose the file again.",
    ioError:
      "Couldn't read or write the file. Check access permissions or the save location.",
  },
  step: {
    snapshot: "Taking a snapshot of your data…",
    pack: "Compressing and writing the file…",
    decrypt: "Decrypting and extracting…",
    verify: "Verifying data…",
    preBackup: "Backing up the current vault…",
  },
  busy: {
    processing: "Processing sources…",
    reindexing: "Reindexing…",
    operation: "Backing up/restoring…",
  },
  panel: {
    title: "Backup & restore",
    desc: "Export your entire vault to a file to keep it safe or move it to another computer. Restoring replaces all current data.",
    backup: "Back up…",
    restore: "Restore…",
  },
  dialog: {
    title: "Back up vault",
    descBefore:
      "Saves all notebooks, processed sources, chat history, Studio results and settings to a single",
    descAfter:
      " file. Original files (PDF, audio, video, images) and API keys are not included.",
    meetingsIncluded: "Includes meeting recordings: {size}.",
    protect: "Protect with a password",
    password: "Password",
    passwordConfirm: "Re-enter password",
    pwTooShort: "The password must be at least 8 characters.",
    pwMismatch: "The two entries don't match.",
    noRecoveryStrong: "There is no way to recover the password.",
    noRecoveryRest: "If you forget it, this backup can't be opened.",
    unencryptedWarning:
      "The file isn't encrypted: anyone who has it can read your documents. Keep it somewhere safe or set a password.",
    chooseLocation: "Choose location…",
    waitingLocation: "Waiting for you to choose a location…",
    doneBefore: "Backed up",
    doneSize: "({size}) to",
    doneEnd: ".",
    finish: "Done",
  },
  restore: {
    title: "Restore vault",
    passwordProtected: "This backup file is password-protected.",
    unlock: "Open backup",
    reading: "Reading backup…",
    createdAt: "Created",
    contents: "Contents",
    notebookCount: { one: "{count} notebook", other: "{count} notebooks" },
    sourceCount: { one: "{count} source", other: "{count} sources" },
    version: "Version",
    encryption: "Encryption",
    encrypted: "Password-protected",
    notEncrypted: "None",
    needsReindex:
      "This backup uses a different embedding model — after restoring, the app will reindex in the background.",
    overwriteStrong: "Your entire current vault will be replaced",
    overwriteBefore:
      "by this backup. The current vault will first be backed up automatically (unencrypted, in the same data folder) to",
    overwriteAfter: ", then the app will restart.",
    confirm: "Restore and restart",
  },
  result: {
    okBefore: "Vault restored from the backup created on",
    okEnd: ".",
    previousSavedAt: "Your previous vault was saved to",
    failed: "Restore failed — your previous vault was kept unchanged.",
  },
};
