# Intake: document-diff-redline (Issue #233)

- **Issue**: #233 — `[feature] document-diff-redline: AI Studio tự động so sánh văn bản & hợp đồng phát hiện rủi ro (Pro/Enterprise)`
- **Loại**: Tính năng thương mại nâng cao (Paid Feature · Pro/Enterprise)
- **Ranh giới**: `src/main/services/studio/`, `src/renderer/features/studio/`, `src/shared/ipc/types.ts`
- **Mục tiêu**:
  - Bổ sung loại tổng hợp mới trong AI Studio: `"documentDiff"` (So sánh Văn bản & Hợp đồng / Redline).
  - So sánh đối chiếu có căn cứ (`[n]` citations) giữa ít nhất 2 tài liệu nguồn được chọn (ví dụ: Bản thảo 1 vs Bản thảo 2, hoặc Hợp đồng gốc vs Hợp đồng sửa đổi).
  - Trình bày cấu trúc rõ ràng: Tổng quan thay đổi, Điều khoản bổ sung, Điều khoản bị cắt giảm, Điều khoản sửa đổi kèm Phân tích rủi ro pháp lý/tài chính/vận hành.
  - Gated bởi bản quyền Pro/Enterprise (`studioPro` / `assertCanGenerateStudio`).
