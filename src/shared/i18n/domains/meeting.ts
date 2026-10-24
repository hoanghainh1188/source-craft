import type { Widen } from "../translate";

// 186 — khoá dịch domain "meeting" (Ghi cuộc họp). error.<code> theo mã lỗi main trả về; phase.<phase> theo
// MeetingPhase; language.<mode> theo LanguageMode. Chuỗi UI bổ sung dần theo từng PR (A → B → C1 → C2).

export const meetingVi = {
  entry: {
    record: "Ghi cuộc họp",
  },
  start: {
    title: "Ghi cuộc họp",
    nameLabel: "Tên cuộc họp",
    defaultName: "Cuộc họp {date}, {time}",
    notebookLabel: "Notebook",
    micLabel: "Microphone",
    languageLabel: "Ngôn ngữ",
    privacy: "Âm thanh và transcript được xử lý trên máy này.",
    privacyOnline: "Hỏi đáp và Studio về cuộc họp sẽ dùng AI online đang bật.",
    modelMissing:
      "Lần đầu cần tải model nhận dạng (~{size} MB) — cần Internet.",
    noMic:
      "Không tìm thấy microphone nào. Hãy cắm hoặc bật microphone rồi thử lại.",
    diskLow:
      "Ổ đĩa chỉ đủ ghi khoảng {minutes} phút — hãy giải phóng dung lượng trước khi ghi.",
    begin: "Bắt đầu ghi",
    defaultMic: "Microphone mặc định",
    starting: "Đang mở microphone…",
  },
  language: {
    auto: "Tự động",
    vi: "Tiếng Việt",
    en: "English",
    multi: "Đa ngôn ngữ",
  },
  permission: {
    deniedMac:
      "SourceCraft chưa được phép dùng microphone. Mở Cài đặt hệ thống → Quyền riêng tư & Bảo mật → Microphone, bật SourceCraft rồi thử lại.",
    deniedWin:
      "SourceCraft chưa được phép dùng microphone. Mở Settings → Privacy & security → Microphone, cho phép ứng dụng dùng microphone rồi thử lại.",
  },
  recording: {
    recording: "Đang ghi",
    paused: "Đã tạm dừng — không thu âm",
    savedLocally: "Lưu trên máy",
    pause: "Tạm dừng",
    resume: "Tiếp tục",
    end: "Kết thúc ghi",
    endConfirmTitle: "Kết thúc ghi?",
    endConfirmBody:
      "Cuộc họp đã ghi {duration}. Sau khi kết thúc, app sẽ chốt transcript và lập chỉ mục.",
    endConfirmOk: "Kết thúc",
    backToRecording: "Quay lại",
    statusBar: "Đang ghi {duration}",
    statusBarPaused: "Đã tạm dừng {duration}",
    durationLabel: "Thời lượng đã ghi",
    controls: "Điều khiển ghi",
  },
  level: {
    label: "Mức âm thanh micro",
    weak: "Âm thanh yếu",
    ok: "Âm thanh tốt",
    clipping: "Âm thanh quá to",
  },
  draft: {
    title: "Transcript nháp",
    empty: "Transcript nháp sẽ hiện dần khi có người nói.",
    pending: "Đang nhận dạng",
    lagging: "Đang xử lý bản ghi — audio vẫn được lưu an toàn.",
    modelMissing:
      "Chưa có model nhận dạng — bản ghi vẫn được lưu. Tải model (~{size} MB, cần Internet) để xem transcript nháp.",
    download: "Tải model (~{size} MB)",
    downloading: "Đang tải model…",
    jumpToNow: "Quay về hiện tại",
    playAt: "Nghe lại từ {time}",
    stopPlayback: "Dừng nghe lại",
    pausedGap: "Tạm dừng {duration}",
    note: "Bản nháp — transcript chính xác hơn sẽ có sau khi kết thúc ghi.",
  },
  languageCtl: {
    label: "Ngôn ngữ nhận dạng",
    change: "Đổi ngôn ngữ",
    detecting: "Đang phát hiện ngôn ngữ…",
    auto: "{language} · Tự động",
    multi: "Đa ngôn ngữ — nhận dạng theo từng đoạn",
    lockTo: "Chuyển sang {language}",
    suggest:
      "Có vẻ cuộc họp đang dùng {language}. Chuyển transcript sang {language}?",
    accept: "Đồng ý",
    dismiss: "Không",
  },
  marker: {
    add: "Đánh dấu",
    menu: "Chọn nhãn đánh dấu",
    decision: "Quyết định",
    actionItem: "Việc cần làm",
    question: "Câu hỏi",
    selectionHint: "Đánh dấu đoạn đã chọn",
    list: "Các đánh dấu",
    item: "{kind} · {time}",
  },
  finalize: {
    status: "Đang chốt transcript và lập chỉ mục",
    duration: "Thời lượng: {duration}",
    backToNotebook: "Về notebook",
    openWhenDone: "Mở khi hoàn tất",
    readyToast: "Cuộc họp “{title}” đã sẵn sàng.",
    open: "Mở",
    ready: "Đã sẵn sàng",
    titleLabel: "Tiêu đề cuộc họp",
    incomplete:
      "Đã lưu audio — chưa có transcript. Bạn có thể nghe lại; transcript sẽ được tạo khi có model nhận dạng.",
    failed:
      "Chưa lập chỉ mục được cuộc họp. Audio vẫn an toàn — app sẽ thử lại khi mở lại.",
  },
  viewer: {
    transcript: "Transcript cuộc họp",
    empty: "Chưa có transcript chốt.",
    seekTo: "Phát từ {time}",
    searchLabel: "Tìm trong transcript",
    searchPlaceholder: "Tìm trong transcript…",
    resultCount: "{k}/{n}",
    resultA11y: "Kết quả {k} trên {n}",
    noResult: "Không thấy",
    prev: "Kết quả trước",
    next: "Kết quả sau",
    markers: "Đánh dấu",
    changeKind: "Đổi nhãn",
    deleteMarker: "Xoá đánh dấu",
    deleteConfirmTitle: "Xoá đánh dấu?",
    deleteConfirmBody: "Đánh dấu “{kind}” lúc {time} sẽ bị xoá.",
    deleteConfirmOk: "Xoá",
    copy: "Sao chép transcript",
    copied: "Đã sao chép transcript.",
    export: "Xuất Markdown",
    exported: "Đã lưu {path}.",
  },
  quality: {
    draft: "Transcript nháp",
  },
  recovery: {
    title: "Bản ghi bị gián đoạn",
    body: "“{title}” · đã ghi {duration}. Audio đã ghi vẫn an toàn.",
    finalize: "Hoàn tất transcript",
    keep: "Giữ như nguồn chưa hoàn thiện",
    discard: "Xoá bản ghi",
    discardConfirmTitle: "Xoá bản ghi?",
    discardConfirmBody:
      "Audio và mọi dữ liệu của “{title}” sẽ bị xoá vĩnh viễn khỏi máy này.",
    discardConfirmOk: "Xoá vĩnh viễn",
    badge: {
      one: "{count} bản ghi cần phục hồi",
      other: "{count} bản ghi cần phục hồi",
    },
    done: "Đã xử lý bản ghi bị gián đoạn.",
  },
  sourceBanner: {
    incomplete:
      "Chưa có transcript — audio vẫn nghe được. Bấm Hoàn tất transcript khi đã có model nhận dạng.",
    finalizeIncomplete: "Hoàn tất transcript",
    draft:
      "Transcript nháp — chưa dùng để hỏi đáp hay trích dẫn. Chốt lại để có transcript chính xác.",
    finalizeDraft: "Chốt lại",
    started: "Đang chốt transcript…",
  },
  deviceLost: {
    title: "Mất microphone — đã tạm dừng ghi",
    body: "Chọn thiết bị khác để tiếp tục cùng phiên, hoặc Kết thúc ghi.",
    resumeWith: "Tiếp tục với thiết bị này",
  },
  disk: {
    warn: "Ổ đĩa chỉ còn đủ ghi khoảng {minutes} phút.",
    urgent:
      "Ổ đĩa sắp đầy — còn khoảng {minutes} phút. App sẽ tự kết thúc ghi khi hết chỗ.",
  },
  shortcut: {
    hint: "Phím tắt: {keys}",
  },
  quit: {
    title: "Đang ghi cuộc họp",
    body: "Thoát bây giờ sẽ kết thúc ghi. Audio đã ghi được giữ nguyên và transcript sẽ được chốt ở lần mở app tiếp theo.",
    confirm: "Kết thúc ghi và thoát",
    cancel: "Tiếp tục ghi",
  },
  phase: {
    recording: "Đang ghi",
    paused: "Đã tạm dừng",
    stopping: "Đang hoàn tất",
    finalizing: "Đang hoàn tất",
    interrupted: "Bị gián đoạn",
    incomplete: "Chưa hoàn thiện",
    done: "Sẵn sàng",
  },
  capture: {
    failed: "Không ghi được âm thanh. Dữ liệu đã ghi vẫn được giữ.",
  },
  a11y: {
    started: "Đã bắt đầu ghi cuộc họp.",
    paused: "Đã tạm dừng ghi — không thu âm.",
    resumed: "Đã tiếp tục ghi.",
    ended: "Đã kết thúc ghi. Đang chốt transcript và lập chỉ mục.",
    ready: "Cuộc họp “{title}” đã sẵn sàng.",
    deviceLost: "Mất microphone — đã tạm dừng ghi.",
    languageDetected: "Ngôn ngữ nhận dạng: {language}.",
    languageSuggest: "Có vẻ cuộc họp đang dùng {language}.",
    lagging: "Transcript nháp đang chậm — audio vẫn được lưu.",
    marked: "Đã đánh dấu {kind}.",
  },
  export: {
    date: "Ngày",
    duration: "Thời lượng",
    language: "Ngôn ngữ",
    markers: "Đánh dấu",
    transcript: "Transcript",
    noTranscript: "Chưa có transcript.",
    gap: {
      user: "Tạm dừng {duration}",
      deviceLost: "Mất microphone {duration}",
      interrupted: "Gián đoạn {duration}",
    },
  },
  ended: {
    diskFull:
      "Ổ đĩa sắp đầy — đã tự kết thúc ghi. Audio đã ghi được giữ nguyên.",
    noAudio:
      "Không còn nhận được âm thanh — đã kết thúc ghi. Audio đã ghi được giữ nguyên.",
    rendererGone:
      "Cửa sổ ghi gặp sự cố — đã kết thúc ghi. Audio đã ghi được giữ nguyên.",
    crash:
      "Không ghi được tệp âm thanh — đã kết thúc ghi. Audio đã ghi được giữ nguyên.",
  },
} as const;

export const meetingEn: Widen<typeof meetingVi> = {
  entry: {
    record: "Record meeting",
  },
  start: {
    title: "Record meeting",
    nameLabel: "Meeting name",
    defaultName: "Meeting {date}, {time}",
    notebookLabel: "Notebook",
    micLabel: "Microphone",
    languageLabel: "Language",
    privacy: "Audio and transcript are processed on this computer.",
    privacyOnline:
      "Q&A and Studio about the meeting will use the online AI that is turned on.",
    modelMissing:
      "The first time, the speech recognition model (~{size} MB) must be downloaded — Internet required.",
    noMic:
      "No microphone found. Connect or turn on a microphone and try again.",
    diskLow:
      "The disk only has room for about {minutes} minutes of recording — free up space before recording.",
    begin: "Start recording",
    defaultMic: "Default microphone",
    starting: "Opening the microphone…",
  },
  language: {
    auto: "Automatic",
    vi: "Vietnamese",
    en: "English",
    multi: "Multilingual",
  },
  permission: {
    deniedMac:
      "SourceCraft is not allowed to use the microphone. Open System Settings → Privacy & Security → Microphone, turn on SourceCraft, then try again.",
    deniedWin:
      "SourceCraft is not allowed to use the microphone. Open Settings → Privacy & security → Microphone, allow apps to use the microphone, then try again.",
  },
  recording: {
    recording: "Recording",
    paused: "Paused — not recording",
    savedLocally: "Saved on this computer",
    pause: "Pause",
    resume: "Resume",
    end: "End recording",
    endConfirmTitle: "End recording?",
    endConfirmBody:
      "The meeting has been recorded for {duration}. After ending, the app will finalize the transcript and index it.",
    endConfirmOk: "End",
    backToRecording: "Back",
    statusBar: "Recording {duration}",
    statusBarPaused: "Paused {duration}",
    durationLabel: "Recorded duration",
    controls: "Recording controls",
  },
  level: {
    label: "Microphone level",
    weak: "Weak audio",
    ok: "Good audio",
    clipping: "Audio too loud",
  },
  draft: {
    title: "Draft transcript",
    empty: "The draft transcript appears as people speak.",
    pending: "Recognizing",
    lagging: "Processing the recording — the audio is still saved safely.",
    modelMissing:
      "No speech model yet — the recording is still saved. Download the model (~{size} MB, needs Internet) to see the draft transcript.",
    download: "Download model (~{size} MB)",
    downloading: "Downloading model…",
    jumpToNow: "Back to now",
    playAt: "Play from {time}",
    stopPlayback: "Stop playback",
    pausedGap: "Paused {duration}",
    note: "Draft — a more accurate transcript is created after the recording ends.",
  },
  languageCtl: {
    label: "Recognition language",
    change: "Change language",
    detecting: "Detecting language…",
    auto: "{language} · Auto",
    multi: "Multilingual — recognized per passage",
    lockTo: "Switch to {language}",
    suggest:
      "The meeting seems to be in {language}. Switch the transcript to {language}?",
    accept: "Switch",
    dismiss: "No",
  },
  marker: {
    add: "Mark",
    menu: "Choose a marker label",
    decision: "Decision",
    actionItem: "Action item",
    question: "Question",
    selectionHint: "Mark selected passage",
    list: "Markers",
    item: "{kind} · {time}",
  },
  finalize: {
    status: "Finalizing transcript and indexing",
    duration: "Duration: {duration}",
    backToNotebook: "Back to notebook",
    openWhenDone: "Open when done",
    readyToast: "Meeting “{title}” is ready.",
    open: "Open",
    ready: "Ready",
    titleLabel: "Meeting title",
    incomplete:
      "Audio saved — no transcript yet. You can listen to it; the transcript will be created once the speech model is available.",
    failed:
      "The meeting could not be indexed yet. The audio is safe — the app will try again next time it starts.",
  },
  viewer: {
    transcript: "Meeting transcript",
    empty: "No final transcript yet.",
    seekTo: "Play from {time}",
    searchLabel: "Search the transcript",
    searchPlaceholder: "Search the transcript…",
    resultCount: "{k}/{n}",
    resultA11y: "Result {k} of {n}",
    noResult: "No matches",
    prev: "Previous result",
    next: "Next result",
    markers: "Markers",
    changeKind: "Change label",
    deleteMarker: "Delete marker",
    deleteConfirmTitle: "Delete marker?",
    deleteConfirmBody: "The “{kind}” marker at {time} will be deleted.",
    deleteConfirmOk: "Delete",
    copy: "Copy transcript",
    copied: "Transcript copied.",
    export: "Export Markdown",
    exported: "Saved {path}.",
  },
  quality: {
    draft: "Draft transcript",
  },
  recovery: {
    title: "Recording interrupted",
    body: "“{title}” · {duration} recorded. The recorded audio is safe.",
    finalize: "Finalize transcript",
    keep: "Keep as incomplete source",
    discard: "Delete recording",
    discardConfirmTitle: "Delete recording?",
    discardConfirmBody:
      "The audio and all data of “{title}” will be permanently deleted from this computer.",
    discardConfirmOk: "Delete permanently",
    badge: {
      one: "{count} recording needs recovery",
      other: "{count} recordings need recovery",
    },
    done: "The interrupted recording was handled.",
  },
  sourceBanner: {
    incomplete:
      "No transcript yet — the audio can still be played. Click Finalize transcript once the speech model is available.",
    finalizeIncomplete: "Finalize transcript",
    draft:
      "Draft transcript — not used for answers or citations. Re-finalize to get an accurate transcript.",
    finalizeDraft: "Re-finalize",
    started: "Finalizing the transcript…",
  },
  deviceLost: {
    title: "Microphone lost — recording paused",
    body: "Choose another device to continue the same session, or end the recording.",
    resumeWith: "Continue with this device",
  },
  disk: {
    warn: "The disk only has room for about {minutes} more minutes.",
    urgent:
      "The disk is almost full — about {minutes} minutes left. Recording ends automatically when it runs out.",
  },
  shortcut: {
    hint: "Shortcut: {keys}",
  },
  quit: {
    title: "A meeting is being recorded",
    body: "Quitting now ends the recording. The audio recorded so far is kept and the transcript is finalized next time the app opens.",
    confirm: "End recording and quit",
    cancel: "Keep recording",
  },
  phase: {
    recording: "Recording",
    paused: "Paused",
    stopping: "Finalizing",
    finalizing: "Finalizing",
    interrupted: "Interrupted",
    incomplete: "Incomplete",
    done: "Ready",
  },
  capture: {
    failed: "Audio could not be recorded. The audio recorded so far is kept.",
  },
  a11y: {
    started: "Meeting recording started.",
    paused: "Recording paused — not recording audio.",
    resumed: "Recording resumed.",
    ended: "Recording ended. Finalizing the transcript and indexing.",
    ready: "Meeting “{title}” is ready.",
    deviceLost: "Microphone lost — recording paused.",
    languageDetected: "Recognition language: {language}.",
    languageSuggest: "The meeting seems to be in {language}.",
    lagging: "The draft transcript is behind — the audio is still saved.",
    marked: "Marked {kind}.",
  },
  export: {
    date: "Date",
    duration: "Duration",
    language: "Language",
    markers: "Markers",
    transcript: "Transcript",
    noTranscript: "No transcript yet.",
    gap: {
      user: "Paused {duration}",
      deviceLost: "Microphone lost {duration}",
      interrupted: "Interrupted {duration}",
    },
  },
  ended: {
    diskFull:
      "The disk is almost full — recording ended automatically. The audio recorded so far is kept.",
    noAudio:
      "Audio stopped arriving — recording ended. The audio recorded so far is kept.",
    rendererGone:
      "The recording window crashed — recording ended. The audio recorded so far is kept.",
    crash:
      "The audio file could not be written — recording ended. The audio recorded so far is kept.",
  },
};
