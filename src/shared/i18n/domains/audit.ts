import type { Widen } from "../translate";

// 236 — khoá dịch domain "audit" (nhật ký kiểm toán). PR B: chữ của chế độ dòng lệnh cho IT (--audit-verify / --audit-decrypt /
// --audit-keygen). PR C: chip header + mục Cài đặt (chỉ đọc). KHÔNG có nội dung câu hỏi hay đường dẫn trong bất kỳ chuỗi nào.

export const auditVi = {
  status: {
    chip: {
      active: "Đang ghi nhật ký kiểm toán",
      blocked: "Nhật ký kiểm toán lỗi — AI tạm khoá",
    },
    tooltip: {
      active:
        "Tổ chức của bạn bật ghi nhật ký kiểm toán: câu hỏi gửi AI, mô hình và tài liệu được trích dẫn được ghi lại trên máy này. Câu trả lời không được ghi.",
      blocked:
        "Không ghi được nhật ký kiểm toán nên tính năng AI tạm khoá theo chính sách của tổ chức. Hãy liên hệ bộ phận IT.",
    },
    section: {
      title: "Nhật ký kiểm toán",
      description:
        "Do bộ phận IT quản lý qua chính sách của tổ chức. Bạn không thể bật, tắt hay xem nội dung nhật ký từ ứng dụng.",
      state: "Trạng thái",
      reason: "Lý do",
      organization: "Tổ chức",
      directory: "Vị trí lưu",
      managed: "Do bộ phận IT quản lý",
    },
    state: {
      off: "Không bật",
      licenseInactive:
        "Chưa có hiệu lực — cần bản quyền Enterprise có tính năng chính sách IT",
      policyError: "Lỗi chính sách — AI tạm khoá",
      active: "Đang ghi",
      blocked: "Không ghi được — AI tạm khoá",
    },
    reason: {
      writeFailed: "Không ghi được vào thư mục nhật ký",
      keyUnavailable:
        "Không truy cập được khoá ký trong kho lưu khoá an toàn của hệ điều hành",
      unreadableSystemPolicy: "Không đọc được tệp chính sách hệ thống",
      invalidAuditPublicKey: "Khoá công khai của tổ chức không hợp lệ",
      invalidAuditLogDirectory: "Thư mục nhật ký trong chính sách không hợp lệ",
      unknown: "Lỗi không xác định",
    },
    directory: {
      default: "Mặc định (trong thư mục dữ liệu của ứng dụng)",
      custom: "Do bộ phận IT chỉ định",
    },
  },
  cli: {
    title: "SourceCraft — Kiểm tra nhật ký kiểm toán",
    dir: "Thư mục: {dir} ({files} tệp, {records} bản ghi, seq {first}–{last})",
    range: "Khoảng thời gian: {from} → {to}",
    keys: "Khoá máy: {ids}",
    intact: "KẾT QUẢ: NGUYÊN VẸN",
    intactWarnings: "KẾT QUẢ: NGUYÊN VẸN — {n} cảnh báo",
    tampered: "KẾT QUẢ: BỊ CAN THIỆP — {reason}",
    at: "  tại {file}, dòng {line}, seq {seq}",
    warningLine: "  • seq {seq}: {text}",
    warningDetail: "  • seq {seq}: {text} — {detail}",
    warning: {
      openInteraction: "tương tác chưa kết thúc",
      keyRotated: "đổi khoá ký",
      startsAfterZero: "bắt đầu sau seq 0 (tệp đầu đã được lưu trữ)",
      clockBackwards: "đồng hồ lùi",
      tailRepaired: "đuôi ghi dở đã được sửa",
      danglingTail:
        "đuôi ghi dở chưa sửa (phiên đang chạy hoặc ứng dụng dừng đột ngột)",
      orphanEnd:
        "kết thúc tương tác không có bản ghi bắt đầu (bắt đầu có thể nằm ở tệp đã lưu trữ)",
      openAtStop: "ứng dụng dừng khi còn tương tác mở",
    },
    failure: {
      malformedLine: "dòng không đọc được",
      badHash: "nội dung bản ghi đã bị sửa (sai mã băm)",
      badSignature: "chữ ký không hợp lệ",
      brokenChain: "chuỗi bị đứt",
      seqGap: "thiếu bản ghi",
      seqOrder: "sai thứ tự bản ghi",
      missingFile: "thiếu tệp nhật ký",
      unexpectedDeviceKey: "khoá máy khác khoá đã đăng ký",
    },
    decrypted: "Đã giải mã {n} câu hỏi → {out}",
    keygen:
      "Đã sinh cặp khoá tổ chức (orgKeyId {id}). Dán dòng dưới vào enterprise-policy.json:",
    keygenPublic: "Khoá công khai: {path}",
    keygenPrivate: "Khoá bí mật (GIỮ NGOÀI máy nhân viên): {path}",
    error: "Lỗi: {reason}",
    usage: {
      unexpectedArgument: "Tham số thừa: {detail}",
      duplicateOption: "Tuỳ chọn bị lặp: {detail}",
      missingValue: "Thiếu giá trị cho {detail}",
      unknownOption: "Tuỳ chọn không hợp lệ: {detail}",
      badLang: "--lang chỉ nhận vi hoặc en (nhận được: {detail})",
      oneCommand: "Cần đúng một lệnh --audit-*.",
      optionNotValid: "Tuỳ chọn không dùng được với lệnh này: {detail}",
      decryptNeedsKeyAndOut: "--audit-decrypt cần --org-key và --out",
      keygenNeedsOutDir: "--audit-keygen cần --out-dir",
    },
    reason: {
      exists: "Tệp đích đã tồn tại (không ghi đè): {detail}",
      outsideDir: "Tệp đích phải nằm NGOÀI thư mục nhật ký kiểm toán",
      badKey: "Khoá không hợp lệ hoặc sai loại",
      orgKeyMismatch: "Khoá tổ chức không khớp khoá đã mã hoá nhật ký",
      io: "Không đọc/ghi được tệp ({detail})",
    },
    windowsAcl:
      "Lưu ý (Windows): quyền tệp do ACL của thư mục quyết định — hãy để tệp này ở thư mục chỉ bạn đọc được.",
    help: {
      title:
        "SourceCraft — công cụ nhật ký kiểm toán cho IT (chạy không mở cửa sổ, không cần mạng)",
      verify:
        "  --audit-verify «thư mục» [--expect-device-key «tệp PEM | deviceKeyId»] [--json] [--out «tệp»]",
      decrypt:
        "  --audit-decrypt «thư mục» --org-key «khoá bí mật tổ chức .pem» --out «tệp»",
      keygen: "  --audit-keygen --out-dir «thư mục»",
      lang: "  --lang vi|en",
      exit: "Mã thoát: 0 nguyên vẹn / thành công · 1 bị can thiệp · 2 lỗi sử dụng · 3 lỗi I/O hoặc khoá.",
    },
  },
} as const;

export const auditEn: Widen<typeof auditVi> = {
  status: {
    chip: {
      active: "Audit logging on",
      blocked: "Audit log error — AI paused",
    },
    tooltip: {
      active:
        "Your organization has turned on audit logging: questions sent to AI, the model, and the cited documents are recorded on this computer. Answers are not recorded.",
      blocked:
        "The audit log cannot be written, so AI features are paused under your organization's policy. Please contact IT.",
    },
    section: {
      title: "Audit log",
      description:
        "Managed by IT through your organization's policy. You cannot turn it on or off, or view the log, from the app.",
      state: "Status",
      reason: "Reason",
      organization: "Organization",
      directory: "Location",
      managed: "Managed by IT",
    },
    state: {
      off: "Off",
      licenseInactive:
        "Not in effect — requires an Enterprise license with the IT policy feature",
      policyError: "Policy error — AI paused",
      active: "Recording",
      blocked: "Cannot write — AI paused",
    },
    reason: {
      writeFailed: "Cannot write to the audit log folder",
      keyUnavailable:
        "Cannot access the signing key in the operating system's secure key store",
      unreadableSystemPolicy: "Cannot read the system policy file",
      invalidAuditPublicKey: "The organization public key is invalid",
      invalidAuditLogDirectory: "The audit log folder in the policy is invalid",
      unknown: "Unknown error",
    },
    directory: {
      default: "Default (inside the app data folder)",
      custom: "Set by IT",
    },
  },
  cli: {
    title: "SourceCraft — Audit log verification",
    dir: "Directory: {dir} ({files} files, {records} records, seq {first}–{last})",
    range: "Time range: {from} → {to}",
    keys: "Device keys: {ids}",
    intact: "RESULT: INTACT",
    intactWarnings: "RESULT: INTACT — {n} warnings",
    tampered: "RESULT: TAMPERED — {reason}",
    at: "  at {file}, line {line}, seq {seq}",
    warningLine: "  • seq {seq}: {text}",
    warningDetail: "  • seq {seq}: {text} — {detail}",
    warning: {
      openInteraction: "interaction not finished",
      keyRotated: "signing key rotated",
      startsAfterZero: "starts after seq 0 (first file archived)",
      clockBackwards: "clock went backwards",
      tailRepaired: "partially written tail repaired",
      danglingTail:
        "partially written tail not yet repaired (session running or app stopped abruptly)",
      orphanEnd:
        "interaction end without a start record (the start may be in an archived file)",
      openAtStop: "app stopped while an interaction was still open",
    },
    failure: {
      malformedLine: "unreadable line",
      badHash: "record content modified (hash mismatch)",
      badSignature: "invalid signature",
      brokenChain: "chain broken",
      seqGap: "missing record",
      seqOrder: "records out of order",
      missingFile: "missing log file",
      unexpectedDeviceKey: "device key differs from the registered key",
    },
    decrypted: "Decrypted {n} questions → {out}",
    keygen:
      "Generated organization key pair (orgKeyId {id}). Paste this line into enterprise-policy.json:",
    keygenPublic: "Public key: {path}",
    keygenPrivate: "Private key (KEEP OFF employee machines): {path}",
    error: "Error: {reason}",
    usage: {
      unexpectedArgument: "Unexpected argument: {detail}",
      duplicateOption: "Duplicate option: {detail}",
      missingValue: "Missing value for {detail}",
      unknownOption: "Unknown option: {detail}",
      badLang: "--lang must be vi or en (got: {detail})",
      oneCommand: "Use exactly one --audit-* command.",
      optionNotValid: "Option not valid for this command: {detail}",
      decryptNeedsKeyAndOut: "--audit-decrypt requires --org-key and --out",
      keygenNeedsOutDir: "--audit-keygen requires --out-dir",
    },
    reason: {
      exists: "Output file already exists (not overwritten): {detail}",
      outsideDir: "Output must be OUTSIDE the audit log directory",
      badKey: "Invalid key or wrong key type",
      orgKeyMismatch:
        "Organization key does not match the key used to encrypt the log",
      io: "Could not read/write file ({detail})",
    },
    windowsAcl:
      "Note (Windows): file permissions come from the folder ACL — keep this file in a folder only you can read.",
    help: {
      title: "SourceCraft — audit log tools for IT (headless, no network)",
      verify:
        "  --audit-verify «dir» [--expect-device-key «PEM file | deviceKeyId»] [--json] [--out «file»]",
      decrypt:
        "  --audit-decrypt «dir» --org-key «organization private key .pem» --out «file»",
      keygen: "  --audit-keygen --out-dir «dir»",
      lang: "  --lang vi|en",
      exit: "Exit codes: 0 intact / success · 1 tampered · 2 usage error · 3 I/O or key error.",
    },
  },
};
