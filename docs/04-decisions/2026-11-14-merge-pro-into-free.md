# Gộp toàn bộ chức năng Pro vào bản Free, bỏ mô hình 2 repo

- Ngày: 2026-11-14
- Feature liên quan: `261-merge-pro-into-free` (issue #261). **Thay thế** ADR [`2026-10-25-pro-repo-split.md`](2026-10-25-pro-repo-split.md).
- Trạng thái: **Đã chấp nhận** — chủ dự án (Harry Nguyen) chọn qua bảng câu hỏi ngày 2026-11-14:
  "Mở khóa + gộp mã" và "Giữ khung bản quyền, mở hết cờ".

## Quyết định

1. **Gộp mã:** mã ở repo private `source-craft-pro` (prompt Studio Pro, chỉ dẫn chế độ chuyên gia, `pickDiffBatches` + test)
   chép về `src/main/pro/` dưới **MIT**. Đây là công bố không thu hồi được. Repo `source-craft-pro` được **archive**.
2. **Bỏ máy móc tách repo:** xoá stub, `api-types.test.ts`, `deps.json`, `scripts/pro-overlay.mjs`, `scripts/pro-chunk.ts`
   (chunk minify riêng), job `pro` + deploy key `SOURCECRAFT_PRO_DEPLOY_KEY` trong `release.yml`, bước `check-stub` trong
   `ci.yml`. Module `src/main/pro/` giữ nguyên API (`available()` luôn `true`) để mã gọi không phải đổi.
3. **Gói Free có mọi chức năng:** cờ `FREEMIUM_ENABLED = false` (`src/shared/license-mode.ts`). Khi tắt:
   `entitlementsFor("free")` không hạn mức notebook/nguồn/cuộc họp, mọi loại nguồn và loại Studio, mọi `LicenseFeature`
   (kể cả `lanAi`, `itPolicy`); audit log bật được bằng policy hệ thống không cần bản quyền; ẩn mục Cài đặt › Bản quyền
   (nút Mua, kích hoạt).
4. **Giữ khung bản quyền** (verifier, khoá công khai, `feature-gate.ts`, UI nâng cấp, `LicenseFeature`) để có thể bật lại
   freemium bằng cách đổi cờ thành `true`. Test khung freemium mock cờ thành `true`; e2e upsell bỏ qua khi cờ tắt.

## Hệ quả

- README "Free forever, open-source (MIT), unlimited local usage" khớp lại với sản phẩm.
- Tài liệu `docs/pro-repo-split-plan.md` và ADR 2026-10-25 chỉ còn giá trị lịch sử.
- Mục glossary "Module Pro / Stub Pro / Bản Pro" cần sửa — theo rule 5 làm ở PR riêng cho steward duyệt.
