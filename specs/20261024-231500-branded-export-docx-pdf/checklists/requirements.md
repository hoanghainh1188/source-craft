# Requirements Checklist: branded-export-docx-pdf

- [x] License feature `brandedExport` được định nghĩa trong `LicenseFeature`.
- [x] `brandedExport` mặc định có trong `DEFAULT_PRO_FEATURES` và `DEFAULT_ENTERPRISE_FEATURES`.
- [x] `scripts/issue-license.mjs` và `license-verifier.ts` công nhận `brandedExport`.
- [x] Gated tại IPC biên: chặn `format === "docx" | "pdf"` đối với gói Free với lỗi `licenseRequireProExport`.
- [x] Bộ sinh `.docx` tạo file zip chuẩn Word XML với header, footer, số trang và style văn bản.
- [x] Bộ sinh `.pdf` sinh PDF chuẩn A4 với styling sắc nét.
- [x] UI `StudioResultCard` cho phép lựa chọn định dạng xuất kèm huy hiệu PRO.
- [x] Hộp thoại lưu file sử dụng đúng phần mở rộng và bộ lọc file phù hợp.
