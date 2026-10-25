import { UserFacingError } from "@shared/codes/user-error";
import { createTranslator, type LanguageCode } from "@shared/i18n";

// 248 — lỗi chung khi bản build không có chức năng Pro (stub src/main/pro/ ở repo public). Nằm NGOÀI src/main/pro/
// vì thư mục đó bị chép đè lúc build release; cả stub lẫn bản Pro dùng chung lớp này.
// message = thẻ [[err:proUnavailable]] như mọi UserFacingError (renderer tự dịch theo ngôn ngữ đang dùng);
// `text` = câu đã dịch cho nơi không có renderer (CLI, nhật ký).

export class ProUnavailableError extends UserFacingError {
  readonly text: string;

  constructor(lang: LanguageCode) {
    super("proUnavailable");
    this.name = "ProUnavailableError";
    this.text = createTranslator(lang).t("errors.proUnavailable");
  }
}
