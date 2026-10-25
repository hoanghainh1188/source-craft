# Specification: document-diff-redline

## 1. Bối cảnh & Mục tiêu
Khi làm việc với các phiên bản hợp đồng hoặc tài liệu quy phạm (phụ lục, thỏa thuận sửa đổi, văn bản chính sách), người dùng chuyên nghiệp (luật sư, kế toán, chuyên viên thu mua) tốn hàng giờ đọc thủ công từng câu chữ để phát hiện bên kia đã sửa điều khoản gì và rủi ro phát sinh là gì. Tính năng `documentDiff` tự động hóa việc đối chiếu này với độ chính xác cao dựa trên nguồn tài liệu đã nạp.

## 2. Yêu cầu chức năng (FR)
- **FR-001**: Bổ sung `documentDiff` vào tập hợp các loại tổng hợp `StudioKind` trong `src/shared/ipc/types.ts`.
- **FR-002**: Lời nhắc chuyên sâu `task("documentDiff")` cấu trúc output gồm:
  1. Tổng quan thay đổi (Summary of Changes).
  2. Điều khoản mới bổ sung (New Clauses / Additions).
  3. Điều khoản bị loại bỏ (Removed Clauses / Omissions).
  4. Điều khoản chỉnh sửa & Phân tích rủi ro (Modified Terms & Risk Analysis).
- **FR-003**: Kiểm tra điều kiện đầu vào: `documentDiff` yêu cầu ít nhất 2 tài liệu nguồn ready. Nếu số nguồn < 2, ném `UserFacingError("studioDiffNeedTwoSources")`.
- **FR-004**: Bản quyền: Gated qua `assertCanGenerateStudio("documentDiff")`, chỉ mở khóa cho Pro và Enterprise. Gói Free hiển thị huy hiệu PRO và mở `UpgradePrompt`.
- **FR-005**: Trích dẫn: Mọi kết luận so sánh phải mang trích dẫn `[n]` tới tài liệu nguồn tương ứng.

## 3. Ràng buộc phi chức năng (NFR)
- **NFR-001**: 100% Offline capability, không egress dữ liệu.
- **NFR-002**: Tuân thủ tiêu chuẩn i18n không hardcode chuỗi tiếng Việt ngoài tệp dịch.
- **NFR-003**: TDD Coverage ≥ 80%.
