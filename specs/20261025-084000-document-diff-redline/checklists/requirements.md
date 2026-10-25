# Requirements Checklist: document-diff-redline

- [ ] FR-001: `documentDiff` trong `StudioKind`, `STUDIO_KINDS`, `STUDIO_ALL_KINDS`; không trong Free.
- [ ] FR-002: Migration v13 nới CHECK `studio_result.kind`, giữ đủ cột/dòng.
- [ ] FR-003: Đúng 2 nguồn khác nhau, ready, có chunk; `[0]` = gốc, `[1]` = sửa đổi; sai ⇒ `studioDiffNeedTwoSources` trước mọi gọi AI.
- [ ] FR-004: Prompt 4 mục, mục 4 là bảng GFM; mục rỗng nêu "không phát hiện" kèm `[n]`.
- [ ] FR-005: Quy tắc `[n]` theo mục (bổ sung ⇒ sửa đổi, loại bỏ ⇒ gốc, sửa ⇒ cả hai).
- [ ] FR-006: Ngữ cảnh theo thứ tự vai trò + khối `<pair>` đã trung hoà thẻ.
- [ ] FR-007: Map-reduce đóng lô theo nguồn, trích gần nguyên văn, nhãn vai trò.
- [ ] FR-008: Rủi ro chỉ từ câu chữ nguồn + ghi chú không thay tư vấn pháp lý.
- [ ] FR-009: Bộ chọn cặp (gốc / sửa đổi / hoán đổi), `documentDiff` trong `RESULT_KINDS`.
- [ ] FR-010: Gate IPC; Free thấy `UpgradePrompt`; không huy hiệu PRO riêng.
- [ ] FR-011: Xuất DOCX/PDF/tên file đúng, bảng có `[n]`.
- [ ] FR-012: `domainMode` không đổi prompt diff.
- [ ] NFR-001: Không egress, không log nội dung/tên/id.
- [ ] NFR-002: Không chuỗi cứng ngoài tệp dịch.
- [ ] NFR-003: Coverage ≥ 80% phần mã mới/đổi.
- [ ] NFR-004: Nâng cấp DB v12 → v13 không mất dữ liệu.
