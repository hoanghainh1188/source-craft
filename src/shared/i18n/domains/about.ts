import type { Widen } from "../translate";

// 213 — nội dung hộp "Giới thiệu" mặc định của hệ điều hành (credits): riêng tư, giấy phép, bản dựng, model AI, thư viện mã nguồn mở.

export const aboutVi = {
  dialogTitle: "Giới thiệu SourceCraft",
  privacy:
    "Dữ liệu của bạn không rời khỏi máy ở chế độ mặc định. SourceCraft chạy đầy đủ khi không có Internet; AI online chỉ dùng khi bạn tự bật, bằng khoá API của bạn.",
  license: "Giấy phép {license} · Tác giả {author}",
  build: "Bản dựng",
  packaged: "Bản đóng gói",
  development: "Bản phát triển",
  models: "Model AI đang dùng",
  role: {
    embedding: "Nhúng văn bản",
    reranker: "Chấm độ liên quan",
    asrFinal: "Nhận dạng giọng nói (bản chốt)",
    asrFallback: "Nhận dạng giọng nói (dự phòng)",
  },
  libraries: "Thư viện mã nguồn mở",
  licenseUnknown: "không rõ",
  librariesUnavailable: "Không đọc được danh sách thư viện.",
} as const;

export const aboutEn: Widen<typeof aboutVi> = {
  dialogTitle: "About SourceCraft",
  privacy:
    "Your data does not leave this computer by default. SourceCraft works fully offline; online AI is used only when you turn it on, with your own API key.",
  license: "{license} license · Author {author}",
  build: "Build",
  packaged: "Packaged build",
  development: "Development build",
  models: "AI models in use",
  role: {
    embedding: "Text embedding",
    reranker: "Relevance scoring",
    asrFinal: "Speech recognition (final)",
    asrFallback: "Speech recognition (fallback)",
  },
  libraries: "Open-source libraries",
  licenseUnknown: "unknown",
  librariesUnavailable: "The library list could not be read.",
};
