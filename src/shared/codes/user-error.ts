// 123 (FR-008, contracts/codes.md §2): lỗi người-dùng-thấy ném ở main đi qua IPC dưới dạng MÃ + tham số.
// Electron invoke() chỉ giữ message ⇒ gắn thẻ "[[err:<code>|<base64url JSON>]]" (cùng ý tưởng thẻ online 098);
// renderer tách thẻ (parseIpcError) rồi dịch theo ngôn ngữ hiện tại. Thuần, dùng chung (không Buffer — renderer sandbox).

export const USER_ERROR_CODES = [
  "vaultLocked",
  "notebookNameEmpty",
  "notebookNameTooLong",
  "notebookNotFound",
  "questionEmpty",
  "questionTooLong",
  "historyTooLong",
  "sourceNotFound",
  "sourcePathMissing",
  "sourcePathNotLocal",
  "sourceRetryNotError",
  "unsupportedFormat",
  "reprocessNotPdf",
  "reprocessBusy",
  "reprocessBadStatus",
  "studioSourceNotReady",
  "studioNoReadySources",
  "studioEmptyOutput",
  "studioNoNotes",
  "studioSaveFailed",
  "studioCancelled", // 149: kết cục huỷ — renderer KHÔNG hiện như lỗi
  "studioCustomPromptEmpty", // 178: yêu cầu tuỳ chỉnh
  "studioCustomPromptTooLong",
  "studioCustomPromptInvalid",
  "studioSourcesInvalid", // 178 (PR 4): phạm vi nhiều nguồn sai
  "studioDiffNeedTwoSources", // 233: documentDiff cần đúng 2 nguồn khác nhau, ready và có nội dung
  "chatModelNotSelected",
  "embeddingModelNotSelected",
  "ollamaHttp",
  "apiKeyMissing",
  "modelNotSelected",
  "apiKeyInvalidInput",
  // 186 — Ghi cuộc họp
  "meetingRecording",
  "meetingAlreadyRecording",
  "meetingDiskLow",
  "meetingNotSupported",
  "meetingNotFound",
  "meetingInvalidInput",
  "meetingRecoverFailed", // 186 PR C1: giữ bản ghi chưa hoàn thiện không lập được nguồn — thẻ phục hồi vẫn còn để thử lại
  "meetingModelDownloadFailed", // 186 PR B: tải model nhận dạng không được (thường do không có Internet)
  // 226 — Enterprise License & Feature Gate
  "licenseLimitNotebooks",
  "licenseLimitSources",
  "licenseRequireProFormat",
  "licenseRequireProStudio",
  // 228 — LAN AI Server & Enterprise IT Policy
  "lanAiInvalidHost",
  "lanAiRequireEnterprise",
  "policyCloudDisabled",
  // 229 — Shared Team Notebooks (.scnb)
  "licenseRequireProSharedNotebooks",
  "licenseRequireProCrossSearch",
  "licenseRequireProExport",
  "licenseRequireProSpecialistModes",
  "packageCorrupted",
  "notebookReadOnly",
] as const;

export type UserErrorCode = (typeof USER_ERROR_CODES)[number];
export type UserErrorParams = Readonly<Record<string, string | number>>;

const MAX_PARAM_LEN = 200;

export function isUserErrorCode(v: unknown): v is UserErrorCode {
  return (
    typeof v === "string" && (USER_ERROR_CODES as readonly string[]).includes(v)
  );
}

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(data: string): string {
  const b64 = data.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

/** "<code> [[err:<code>|<params>]]" — chỉ ASCII. */
export function encodeUserError(
  code: UserErrorCode,
  params?: UserErrorParams,
): string {
  // Cắt chuỗi quá dài (giải mã bỏ giá trị > MAX_PARAM_LEN ⇒ tránh mất tham số) — review 123.
  const safe = params
    ? Object.fromEntries(
        Object.entries(params).map(([k, v]) => [
          k,
          typeof v === "string" ? v.slice(0, MAX_PARAM_LEN) : v,
        ]),
      )
    : undefined;
  const payload =
    safe && Object.keys(safe).length > 0
      ? `|${toBase64Url(JSON.stringify(safe))}`
      : "";
  return `${code} [[err:${code}${payload}]]`;
}

/** Giải mã tham số an toàn: chỉ object phẳng string/number, mỗi giá trị ≤ 200 ký tự; sai ⇒ undefined. */
export function decodeUserErrorParams(
  data: string | undefined,
): UserErrorParams | undefined {
  if (!data) return undefined;
  try {
    const obj: unknown = JSON.parse(fromBase64Url(data));
    if (typeof obj !== "object" || obj === null || Array.isArray(obj)) {
      return undefined;
    }
    const out: Record<string, string | number> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
      else if (typeof v === "string" && v.length <= MAX_PARAM_LEN) out[k] = v;
      else return undefined;
    }
    return out;
  } catch {
    return undefined;
  }
}

export class UserFacingError extends Error {
  readonly code: UserErrorCode;
  readonly params?: UserErrorParams;

  constructor(code: UserErrorCode, params?: UserErrorParams) {
    super(encodeUserError(code, params));
    this.name = "UserFacingError";
    this.code = code;
    this.params = params;
  }
}
