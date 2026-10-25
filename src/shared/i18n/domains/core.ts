import type { Widen } from "../translate";

// 123 — khoá dùng chung: nút chung, lỗi người-dùng-thấy (mã UserErrorCode), lỗi AI online (098), thời gian, Cài đặt.

export const coreVi = {
  common: {
    cancel: "Huỷ",
    close: "Đóng",
    save: "Lưu",
    retry: "Thử lại",
    delete: "Xoá",
    copy: "Sao chép",
    copied: "Đã sao chép",
  },
  time: {
    justNow: "vừa xong",
    minutesAgo: { one: "{count} phút trước", other: "{count} phút trước" },
    hoursAgo: { one: "{count} giờ trước", other: "{count} giờ trước" },
    yesterday: "hôm qua",
    daysAgo: { one: "{count} ngày trước", other: "{count} ngày trước" },
    lastWeek: "tuần trước",
  },
  errors: {
    unexpected: "Đã có lỗi xảy ra. Vui lòng thử lại.",
    vaultLocked: "Đang sao lưu/khôi phục — thử lại sau giây lát.",
    notebookNameEmpty: "Tên notebook không được để trống.",
    notebookNameTooLong: "Tên notebook tối đa {max} ký tự.",
    notebookNotFound: "Notebook không tồn tại.",
    questionEmpty: "Câu hỏi không được để trống.",
    questionTooLong: "Câu hỏi quá dài (tối đa {max} ký tự).",
    historyTooLong: "Lịch sử hội thoại quá dài.",
    sourceNotFound: "Nguồn không tồn tại.",
    sourcePathMissing: "Nguồn thiếu đường dẫn tệp hoặc URL.",
    sourcePathNotLocal: "Đường dẫn tệp phải là tệp cục bộ (không phải URL).",
    sourceRetryNotError: "Chỉ thử lại nguồn đang lỗi.",
    unsupportedFormat: "Định dạng tệp không hỗ trợ: .{ext}",
    reprocessNotPdf: "Chỉ xử lý lại nguồn PDF.",
    reprocessBusy: "Nguồn đang được xử lý.",
    reprocessBadStatus: "Chỉ xử lý lại nguồn sẵn sàng hoặc lỗi.",
    studioSourceNotReady:
      "Nguồn đã chọn chưa sẵn sàng. Chờ lập chỉ mục xong rồi thử lại.",
    studioNoReadySources:
      "Chưa có nguồn sẵn sàng để tạo Studio. Hãy nạp nguồn trước.",
    studioEmptyOutput: "Mô hình không tạo được nội dung. Vui lòng thử lại.",
    studioNoNotes:
      "Mô hình không trích được ghi chú kèm trích dẫn từ tài liệu. Vui lòng thử lại hoặc chọn mô hình khác.",
    studioSaveFailed: "Lưu kết quả Studio thất bại.",
    studioCancelled: "Đã huỷ tạo kết quả Studio.",
    studioCustomPromptEmpty: "Hãy nhập yêu cầu trước khi tạo.",
    studioCustomPromptTooLong: "Yêu cầu quá dài (tối đa {max} ký tự).",
    studioCustomPromptInvalid: "Yêu cầu không hợp lệ.",
    studioSourcesInvalid:
      "Phạm vi nguồn không hợp lệ (tối đa {max} nguồn của notebook này).",
    studioDiffNeedTwoSources:
      "So sánh văn bản cần chọn đúng 2 tài liệu khác nhau (bản gốc và bản sửa đổi) đã sẵn sàng và có nội dung.",
    chatModelNotSelected: "Chưa chọn mô hình trả lời (chat model).",
    embeddingModelNotSelected: "Chưa chọn mô hình embedding.",
    ollamaHttp: "Ollama trả lỗi {status}.",
    apiKeyMissing: "{provider}: chưa nhập khóa API.",
    modelNotSelected: "{provider}: chưa chọn mô hình.",
    apiKeyInvalidInput: "Khóa API hoặc nhà cung cấp không hợp lệ.",
    meetingRecording:
      "Notebook này đang ghi cuộc họp — hãy kết thúc ghi trước.",
    meetingAlreadyRecording:
      "Đang có một cuộc họp được ghi. Hãy kết thúc ghi trước khi bắt đầu cuộc họp mới.",
    meetingDiskLow: "Ổ đĩa không đủ dung lượng để ghi.",
    meetingNotSupported: "Thao tác này không áp dụng cho nguồn cuộc họp.",
    meetingNotFound: "Phiên ghi không còn tồn tại.",
    meetingInvalidInput: "Thông tin phiên ghi không hợp lệ.",
    meetingRecoverFailed:
      "Chưa xử lý được bản ghi bị gián đoạn. Audio vẫn an toàn — hãy thử lại.",
    meetingModelDownloadFailed:
      "Không tải được model nhận dạng. Kiểm tra kết nối Internet rồi thử lại — bản ghi vẫn được lưu.",
    licenseLimitNotebooks:
      "Gói Cộng đồng (Free) giới hạn tối đa {max} sổ tay. Vui lòng kích hoạt bản quyền Pro hoặc Enterprise trong Cài đặt để tạo không giới hạn.",
    licenseLimitSources:
      "Gói Cộng đồng (Free) giới hạn tối đa {max} nguồn mỗi sổ tay. Vui lòng nâng cấp bản quyền Pro hoặc Enterprise để thêm nguồn.",
    licenseRequireProFormat:
      "Định dạng nguồn ({kind}) yêu cầu bản quyền Pro hoặc Enterprise. Vui lòng kích hoạt tệp .sclicense trong Cài đặt.",
    licenseRequireProStudio:
      "Chế độ tổng hợp Studio ({kind}) yêu cầu bản quyền Pro hoặc Enterprise. Vui lòng kích hoạt tệp .sclicense trong Cài đặt.",
    lanAiInvalidHost:
      "Địa chỉ máy chủ AI ({url}) không thuộc dải mạng nội bộ hợp lệ (RFC1918) hoặc tên miền nội bộ được phép.",
    lanAiRequireEnterprise:
      "Tính năng kết nối Máy chủ AI Mạng nội bộ (LAN) yêu cầu bản quyền Enterprise. Vui lòng nâng cấp bản quyền.",
    lanAiUnreachable:
      "Không kết nối được tới máy chủ AI nội bộ (LAN). Kiểm tra mạng nội bộ hoặc liên hệ quản trị viên.",
    lanAiTimeout:
      "Máy chủ AI nội bộ (LAN) phản hồi quá lâu (hết thời gian chờ).",
    lanAiHttp: "Máy chủ AI nội bộ (LAN) báo lỗi (mã {status}).",
    policyCloudDisabled:
      "Tính năng AI Đám mây công cộng đã bị khoá bởi Chính sách Quản trị IT của Tổ chức ({org}).",
    licenseRequireProSharedNotebooks:
      "Tính năng Đóng gói và Chia sẻ Sổ tay (.scnb) yêu cầu bản quyền Pro hoặc Enterprise. Vui lòng kích hoạt bản quyền trong Cài đặt.",
    licenseRequireProCrossSearch:
      "Tính năng Tìm kiếm & Hỏi đáp RAG Toàn bộ kho tri thức yêu cầu bản quyền Pro hoặc Enterprise. Vui lòng kích hoạt bản quyền trong Cài đặt.",
    licenseRequireProExport:
      "Tính năng Xuất báo cáo Word (.docx) & PDF chuyên nghiệp yêu cầu bản quyền Pro hoặc Enterprise. Vui lòng kích hoạt bản quyền trong Cài đặt.",
    licenseRequireProSpecialistModes:
      "Chế độ AI Chuyên gia (Pháp lý & Y tế) yêu cầu bản quyền Pro hoặc Enterprise. Vui lòng kích hoạt bản quyền trong Cài đặt.",
    packageCorrupted:
      "Tệp gói sổ tay (.scnb) bị hỏng hoặc không khớp mã kiểm tra SHA-256.",
    notebookReadOnly:
      "Sổ tay này đang ở chế độ dùng chung (Chỉ đọc). Bạn không thể thay đổi hoặc thêm/xoá nguồn.",
    auditWriteFailed:
      "Không ghi được nhật ký kiểm toán theo chính sách của tổ chức, nên AI tạm thời bị khoá. Hãy giải phóng dung lượng đĩa hoặc liên hệ bộ phận IT.",
    auditPolicyInvalid:
      "Chính sách nhật ký kiểm toán của tổ chức bị cấu hình sai, nên AI tạm thời bị khoá. Hãy liên hệ bộ phận IT.",
    auditKeyUnavailable:
      "Không truy cập được khoá ký nhật ký kiểm toán trong kho khoá của hệ điều hành, nên AI tạm thời bị khoá. Hãy liên hệ bộ phận IT.",
    proUnavailable:
      "Bản này không có chức năng Pro — hãy dùng bản phát hành chính thức của SourceCraft.",
  },
  online: {
    auth: "Khóa API không hợp lệ hoặc đã hết hạn.",
    "rate-limit": "Nhà cung cấp đang giới hạn tốc độ, vui lòng thử lại sau.",
    timeout: "Máy chủ AI online phản hồi quá lâu (hết thời gian chờ).",
    network: "Không kết nối được tới máy chủ AI online (kiểm tra mạng).",
    server: "Máy chủ AI online gặp lỗi, vui lòng thử lại.",
    unknown: "Gọi AI online thất bại.",
  },
  settings: {
    title: "Cài đặt",
    language: {
      title: "Ngôn ngữ",
      description:
        "Ngôn ngữ của giao diện. Câu trả lời trong Chat theo ngôn ngữ câu hỏi; Studio theo ngôn ngữ giao diện.",
      auto: "Tự động (theo hệ điều hành)",
      saveFailed: "Không đổi được ngôn ngữ. Vui lòng thử lại.",
    },
    license: {
      title: "Bản quyền & Gói dịch vụ",
      description:
        "Xác thực chữ ký số Ed25519 hoàn toàn ngoại tuyến (không kết nối Internet).",
      tierFree: "Cộng đồng (Free)",
      tierPro: "Chuyên nghiệp (Pro)",
      tierEnterprise: "Doanh nghiệp (Enterprise)",
      badgeEnterprise: "Enterprise · {org}",
      badgePro: "Pro",
      orgLabel: "Tổ chức",
      seatsLabel: "Số lượng chỗ (seats)",
      expiresLabel: "Thời hạn",
      perpetual: "Vĩnh viễn",
      daysRemaining: "Còn {days} ngày ({date})",
      expiredBadge: "Đã hết hạn ({date}) — đang áp dụng giới hạn gói Free",
      clockTamperedBadge:
        "Phát hiện đồng hồ hệ thống bị lùi bất thường — đang tạm khoá về gói Free",
      invalidBadge: "Tệp bản quyền không hợp lệ — đang áp dụng gói Free",
      freeLimitsHint:
        "Gói Free: tối đa 3 sổ tay · 10 nguồn/sổ tay · PDF/DOCX/TXT/MD/URL · 15 phút ghi họp · 2 mẫu Studio cơ bản.",
      proUnlockedHint:
        "Đã mở khoá không giới hạn sổ tay/nguồn, nạp âm thanh/video/hình ảnh, ghi họp dài và toàn bộ 9 mẫu Studio.",
      activateBtn: "Kích hoạt tệp .sclicense…",
      activatingBtn: "Đang kiểm tra…",
      deactivateBtn: "Gỡ bản quyền",
      activatedSuccess: "Đã kích hoạt bản quyền thành công.",
      deactivatedSuccess: "Đã gỡ bản quyền và chuyển về gói Cộng đồng (Free).",
      errInvalidFormat: "Tệp .sclicense không đúng định dạng hoặc bị hỏng.",
      errInvalidSignature:
        "Chữ ký số Ed25519 không hợp lệ (tệp đã bị chỉnh sửa hoặc không do SourceCraft phát hành).",
      errExpired: "Tệp bản quyền này đã hết hạn.",
      errClockTampered:
        "Đồng hồ hệ thống đang lùi hơn 24 giờ so với lần kiểm tra trước. Vui lòng chỉnh lại giờ hệ thống.",
      errIo: "Không đọc được tệp bản quyền (tối đa 64 KB).",
      // 237 — mua / nâng cấp
      buyBtn: "Mua bản quyền Pro / Enterprise",
      buyHint:
        "Mở trang mua trong trình duyệt. Sau khi mua, bạn nhận tệp .sclicense để kích hoạt tại đây.",
      upsellText:
        "Nâng cấp lên Pro hoặc Enterprise để bỏ giới hạn này. Dữ liệu hiện có vẫn giữ nguyên.",
      upsellBtn: "Xem các gói nâng cấp",
      purchaseOpenFailed:
        "Không mở được trình duyệt. Hãy truy cập trang dự án SourceCraft trên GitHub để mua bản quyền.",
    },
    lanAi: {
      title: "Máy chủ AI Mạng nội bộ (LAN)",
      description:
        "Kết nối cụm GPU nội bộ của tổ chức (Ollama hoặc vLLM/OpenAI-compatible) hoàn toàn bảo mật trong mạng LAN.",
      requireEnterpriseBadge: "Chỉ dành cho gói Enterprise",
      enabledLabel: "Bật kết nối Máy chủ AI Mạng nội bộ",
      providerLabel: "Chuẩn giao thức",
      providerOllama: "Ollama Nội bộ (cổng 11434)",
      providerOpenAi: "OpenAI-compatible (vLLM / LiteLLM / LocalAI)",
      baseUrlLabel: "Địa chỉ máy chủ (URL)",
      baseUrlPlaceholder:
        "http://192.168.1.100:11434 hoặc http://ai.corp.local:8000",
      tokenLabel: "Mã token / API key (tuỳ chọn)",
      tokenPlaceholder: "Để trống nếu không yêu cầu xác thực",
      tokenSavedPlaceholder: "•••••••• (Đã lưu token bí mật)",
      modelLabel: "Tên mô hình Chat",
      modelPlaceholder: "qwen2.5:14b hoặc meta-llama/Llama-3.1-8B-Instruct",
      testBtn: "Kiểm tra kết nối",
      testingBtn: "Đang kiểm tra…",
      testSuccess: "Kết nối thành công! Tìm thấy {modelCount} mô hình.",
      testFailed: "Kết nối thất bại: {error}",
      saveBtn: "Lưu cấu hình",
      savedSuccess: "Đã lưu cấu hình Máy chủ AI Mạng nội bộ.",
      policyLocked:
        "Cấu hình này đang được quản trị bởi Chính sách IT của Tổ chức.",
    },
  },
} as const;

export const coreEn: Widen<typeof coreVi> = {
  common: {
    cancel: "Cancel",
    close: "Close",
    save: "Save",
    retry: "Retry",
    delete: "Delete",
    copy: "Copy",
    copied: "Copied",
  },
  time: {
    justNow: "just now",
    minutesAgo: { one: "{count} minute ago", other: "{count} minutes ago" },
    hoursAgo: { one: "{count} hour ago", other: "{count} hours ago" },
    yesterday: "yesterday",
    daysAgo: { one: "{count} day ago", other: "{count} days ago" },
    lastWeek: "last week",
  },
  errors: {
    unexpected: "Something went wrong. Please try again.",
    vaultLocked: "A backup or restore is in progress — try again in a moment.",
    notebookNameEmpty: "Notebook name can't be empty.",
    notebookNameTooLong: "Notebook name can be at most {max} characters.",
    notebookNotFound: "Notebook not found.",
    questionEmpty: "Question can't be empty.",
    questionTooLong: "Question is too long (max {max} characters).",
    historyTooLong: "Conversation history is too long.",
    sourceNotFound: "Source not found.",
    sourcePathMissing: "Source is missing a file path or URL.",
    sourcePathNotLocal: "File path must be a local file (not a URL).",
    sourceRetryNotError: "Only failed sources can be retried.",
    unsupportedFormat: "Unsupported file type: .{ext}",
    reprocessNotPdf: "Only PDF sources can be reprocessed.",
    reprocessBusy: "This source is being processed.",
    reprocessBadStatus: "Only ready or failed sources can be reprocessed.",
    studioSourceNotReady:
      "The selected source isn't ready yet. Wait for indexing to finish, then try again.",
    studioNoReadySources:
      "No sources are ready for Studio yet. Add a source first.",
    studioEmptyOutput:
      "The model didn't produce any content. Please try again.",
    studioNoNotes:
      "The model couldn't extract cited notes from the documents. Try again or choose another model.",
    studioSaveFailed: "Couldn't save the Studio result.",
    studioCancelled: "Studio generation was cancelled.",
    studioCustomPromptEmpty: "Enter a request before creating.",
    studioCustomPromptTooLong:
      "The request is too long (max {max} characters).",
    studioCustomPromptInvalid: "The request is not valid.",
    studioSourcesInvalid:
      "The source selection isn't valid (up to {max} sources from this notebook).",
    studioDiffNeedTwoSources:
      "Document comparison needs exactly 2 different ready sources with content (original and revised).",
    chatModelNotSelected: "No answer model selected.",
    embeddingModelNotSelected: "No embedding model selected.",
    ollamaHttp: "Ollama returned error {status}.",
    apiKeyMissing: "{provider}: no API key entered.",
    modelNotSelected: "{provider}: no model selected.",
    apiKeyInvalidInput: "Invalid API key or provider.",
    meetingRecording:
      "This notebook is recording a meeting — end the recording first.",
    meetingAlreadyRecording:
      "A meeting is already being recorded. End that recording before starting a new one.",
    meetingDiskLow: "Not enough disk space to record.",
    meetingNotSupported: "This action does not apply to meeting sources.",
    meetingNotFound: "The recording session no longer exists.",
    meetingInvalidInput: "Invalid recording session details.",
    meetingRecoverFailed:
      "The interrupted recording couldn't be processed yet. The audio is safe — please try again.",
    meetingModelDownloadFailed:
      "Couldn't download the speech recognition model. Check your Internet connection and try again — the recording is still saved.",
    licenseLimitNotebooks:
      "The Community (Free) plan is limited to {max} notebooks. Activate a Pro or Enterprise license in Settings for unlimited notebooks.",
    licenseLimitSources:
      "The Community (Free) plan is limited to {max} sources per notebook. Upgrade to Pro or Enterprise to add more sources.",
    licenseRequireProFormat:
      "Source format ({kind}) requires a Pro or Enterprise license. Please activate a .sclicense file in Settings.",
    licenseRequireProStudio:
      "Studio synthesis format ({kind}) requires a Pro or Enterprise license. Please activate a .sclicense file in Settings.",
    lanAiInvalidHost:
      "The AI server address ({url}) is not a valid private network (RFC1918) or allowed internal domain.",
    lanAiRequireEnterprise:
      "Connecting to a Local Area Network (LAN) AI Server requires an Enterprise license. Please upgrade your license.",
    lanAiUnreachable:
      "Couldn't reach the internal (LAN) AI server. Check your internal network or contact your administrator.",
    lanAiTimeout:
      "The internal (LAN) AI server took too long to respond (timed out).",
    lanAiHttp:
      "The internal (LAN) AI server returned an error (code {status}).",
    policyCloudDisabled:
      "Public Cloud AI features have been disabled by your Organization's IT Policy ({org}).",
    licenseRequireProSharedNotebooks:
      "Packaging and Sharing Notebooks (.scnb) requires a Pro or Enterprise license. Please activate a license in Settings.",
    licenseRequireProCrossSearch:
      "Cross-Notebook Search & RAG across all notebooks requires a Pro or Enterprise license. Please activate a license in Settings.",
    licenseRequireProExport:
      "Professional Word (.docx) and PDF export requires a Pro or Enterprise license. Please activate a license in Settings.",
    licenseRequireProSpecialistModes:
      "Specialist AI Modes (Legal & Medical) require a Pro or Enterprise license. Please activate a license in Settings.",
    packageCorrupted:
      "The notebook package (.scnb) file is corrupted or failed SHA-256 verification.",
    notebookReadOnly:
      "This notebook is in Shared (Read-Only) mode. You cannot modify, add, or remove sources.",
    auditWriteFailed:
      "The audit log required by your organization could not be written, so AI is temporarily locked. Free up disk space or contact your IT department.",
    auditPolicyInvalid:
      "Your organization's audit log policy is misconfigured, so AI is temporarily locked. Please contact your IT department.",
    auditKeyUnavailable:
      "The audit log signing key in the operating system keychain could not be accessed, so AI is temporarily locked. Please contact your IT department.",
    proUnavailable:
      "This build does not include Pro features — please use an official SourceCraft release.",
  },
  online: {
    auth: "The API key is invalid or has expired.",
    "rate-limit":
      "The provider is rate-limiting requests. Please try again later.",
    timeout: "The online AI server took too long to respond (timed out).",
    network: "Couldn't reach the online AI server (check your network).",
    server: "The online AI server returned an error. Please try again.",
    unknown: "The online AI request failed.",
  },
  settings: {
    title: "Settings",
    language: {
      title: "Language",
      description:
        "Interface language. Chat answers follow the language of your question; Studio follows the interface language.",
      auto: "Automatic (system language)",
      saveFailed: "Couldn't change the language. Please try again.",
    },
    license: {
      title: "License & Plan",
      description:
        "100% offline Ed25519 digital signature verification (zero network egress).",
      tierFree: "Community (Free)",
      tierPro: "Professional (Pro)",
      tierEnterprise: "Enterprise",
      badgeEnterprise: "Enterprise · {org}",
      badgePro: "Pro",
      orgLabel: "Organization",
      seatsLabel: "Licensed seats",
      expiresLabel: "Validity",
      perpetual: "Perpetual",
      daysRemaining: "{days} days remaining ({date})",
      expiredBadge: "Expired ({date}) — Free tier limits applied",
      clockTamperedBadge:
        "System clock rollback detected — temporarily restricted to Free tier",
      invalidBadge: "Invalid license file — Free tier limits applied",
      freeLimitsHint:
        "Free plan: up to 3 notebooks · 10 sources/notebook · PDF/DOCX/TXT/MD/URL · 15m meeting capture · 2 basic Studio formats.",
      proUnlockedHint:
        "Unlocked unlimited notebooks/sources, audio/video/image ingestion, long meeting capture, and all 9 Studio formats.",
      activateBtn: "Activate .sclicense file…",
      activatingBtn: "Verifying…",
      deactivateBtn: "Deactivate license",
      activatedSuccess: "License activated successfully.",
      deactivatedSuccess:
        "License removed and reverted to Community (Free) plan.",
      errInvalidFormat: "The .sclicense file is malformed or corrupted.",
      errInvalidSignature:
        "Invalid Ed25519 digital signature (file was tampered with or not issued by SourceCraft).",
      errExpired: "This license file has expired.",
      errClockTampered:
        "System clock is more than 24 hours behind the last recorded timestamp. Please correct your system clock.",
      errIo: "Could not read license file (max 64 KB).",
      // 237 — purchase / upgrade
      buyBtn: "Buy a Pro / Enterprise license",
      buyHint:
        "Opens the purchase page in your browser. After buying, you receive a .sclicense file to activate here.",
      upsellText:
        "Upgrade to Pro or Enterprise to remove this limit. Your existing data stays as it is.",
      upsellBtn: "See upgrade plans",
      purchaseOpenFailed:
        "Couldn't open the browser. Visit the SourceCraft project page on GitHub to buy a license.",
    },
    lanAi: {
      title: "LAN AI Server",
      description:
        "Connect to your organization's internal GPU server (Ollama or vLLM/OpenAI-compatible) securely within your LAN.",
      requireEnterpriseBadge: "Enterprise Plan Only",
      enabledLabel: "Enable LAN AI Server connection",
      providerLabel: "Protocol format",
      providerOllama: "Internal Ollama (port 11434)",
      providerOpenAi: "OpenAI-compatible (vLLM / LiteLLM / LocalAI)",
      baseUrlLabel: "Server address (URL)",
      baseUrlPlaceholder:
        "http://192.168.1.100:11434 or http://ai.corp.local:8000",
      tokenLabel: "Bearer token / API key (optional)",
      tokenPlaceholder: "Leave empty if no auth is required",
      tokenSavedPlaceholder: "•••••••• (Secret token saved)",
      modelLabel: "Chat model name",
      modelPlaceholder: "qwen2.5:14b or meta-llama/Llama-3.1-8B-Instruct",
      testBtn: "Test connection",
      testingBtn: "Testing…",
      testSuccess: "Connection successful! Found {modelCount} models.",
      testFailed: "Connection failed: {error}",
      saveBtn: "Save configuration",
      savedSuccess: "LAN AI Server configuration saved.",
      policyLocked:
        "This configuration is managed by your Organization's IT Policy.",
    },
  },
};
