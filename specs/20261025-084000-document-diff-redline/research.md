# Research: Document Diff & Contract Redline

## 1. Cơ chế đối chiếu ngữ cảnh của LLM
- Trong `citationBlock`:
  `[n] (Source: <sourceTitle>, page <pageLabel>)\n<chunkText>`
  Tên nguồn tài liệu được ghi rõ trong từng đoạn ngữ cảnh. Khi người dùng nạp `HopDong_Goc.pdf` và `HopDong_SuaDoi.pdf`, LLM phân biệt được nội dung thuộc về từng bản thảo.
- Với tài liệu dài vượt ngân sách ngữ cảnh:
  Hệ thống `MapReduce` (`runMapReduce`) trong Studio đã có sẵn cơ chế gom nhóm theo nguồn (`groups: ScoredChunk[][]`), chia đều ngân sách giữa các tài liệu (`buildBalancedContext`) giúp bản so sánh không bị lệch về một văn bản.

## 2. Kiểm soát bản quyền
- `assertCanGenerateStudio` trong `src/main/services/license/feature-gate.ts`:
  Gói Free chỉ cho phép `summary` và `keyPoints`.
  Khi thêm `documentDiff`, nó tự động thuộc nhóm tính năng nâng cao yêu cầu `allStudioKinds` (Pro & Enterprise).
