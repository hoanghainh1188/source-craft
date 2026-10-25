# Requirements Checklist: document-diff-redline

- [x] FR-001: `documentDiff` trong `StudioKind`, `STUDIO_KINDS`, `STUDIO_ALL_KINDS`; không trong Free.
- [x] FR-002: Migration v13 nới CHECK `studio_result.kind`, giữ đủ cột/dòng.
- [x] FR-003: Đúng 2 nguồn khác nhau, ready, có chunk; `[0]` = gốc, `[1]` = sửa đổi; sai ⇒ `studioDiffNeedTwoSources` trước mọi gọi AI.
- [x] FR-004: Prompt 4 mục, mục 4 là bảng GFM; mục rỗng nêu "không phát hiện" kèm `[n]`.
- [x] FR-005: Quy tắc `[n]` theo mục (bổ sung ⇒ sửa đổi, loại bỏ ⇒ gốc, sửa ⇒ cả hai).
- [x] FR-006: Ngữ cảnh theo thứ tự vai trò + khối `<pair>` đã trung hoà thẻ.
- [x] FR-007: Map-reduce đóng lô theo nguồn, trích gần nguyên văn, nhãn vai trò.
- [x] FR-008: Rủi ro chỉ từ câu chữ nguồn + ghi chú không thay tư vấn pháp lý.
- [x] FR-009: Bộ chọn cặp (gốc / sửa đổi / hoán đổi), `documentDiff` trong `RESULT_KINDS`.
- [x] FR-010: Gate IPC; Free thấy `UpgradePrompt`; không huy hiệu PRO riêng.
- [x] FR-011: Xuất DOCX/PDF/tên file đúng, bảng có `[n]`.
- [x] FR-012: `domainMode` không đổi prompt diff.
- [x] NFR-001: Không egress, không log nội dung/tên/id.
- [x] NFR-002: Không chuỗi cứng ngoài tệp dịch.
- [x] NFR-003: Coverage ≥ 80% phần mã mới/đổi.
- [x] NFR-004: Nâng cấp DB v12 → v13 không mất dữ liệu.
