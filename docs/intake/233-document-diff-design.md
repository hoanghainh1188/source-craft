# Design Intake: Document Diff & Contract Redline (233)

## 1. Mục tiêu kiến trúc
Cung cấp khả năng phân tích so sánh đối chiếu văn bản tự động (Document Diff / Contract Redline) trong AI Studio của SourceCraft, phục vụ người dùng khối Pháp lý, Doanh nghiệp và Quản lý dự án.

## 2. Luồng xử lý (Workflow)

```mermaid
flowchart TD
    User["Người dùng chọn đúng 2 nguồn: [bản gốc, bản sửa đổi] & bấm So sánh"]
    UI["StudioColumn / StudioDiffPicker"]
    Gate["License FeatureGate (assertCanGenerateStudio)"]
    Service["StudioService (validate sourceIds.length === 2 && ready && chunks >= 1)"]
    Prompt["prompt.ts: task('documentDiff') + pair block"]
    MapReduce["MapReduce theo từng nguồn / BalancedContext"]
    LLM["LLM Chat (Local / Online)"]
    Postprocess["postprocessCitations & lưu StudioResult (migration v13)"]
    Card["StudioResultCard kèm Disclaimer pháp lý"]

    User --> UI
    UI --> Gate
    Gate -- "Gói Free" --> Upgrade["Hiện UpgradePrompt (licenseRequireProStudio)"]
    Gate -- "Pro / Enterprise" --> Service
    Service -- "Số nguồn != 2 hoặc 0 chunk" --> Error["Báo lỗi studioDiffNeedTwoSources"]
    Service -- "Hợp lệ" --> Prompt
    Prompt --> MapReduce
    MapReduce --> LLM
    LLM --> Postprocess
    Postprocess --> Card
```

## 3. Ràng buộc & Tiêu chuẩn
- Tuân thủ nguyên tắc **Local-first** và **Verifiable Citations (Constitution II)**: Mọi nhận định về thay đổi, điều khoản thêm/bớt đều phải mang chip trích dẫn `[n]` trỏ về chunk gốc tương ứng.
- Đúng 2 nguồn có vai trò rõ ràng: `sourceIds[0]` = bản gốc, `sourceIds[1]` = bản sửa đổi.
- Bảng Markdown GFM 4 cột ở mục 4 (sửa đổi & rủi ro).
- Hoàn toàn ngoại tuyến (Zero Network Egress khi chạy với Ollama/LAN AI).
- Gated bởi bản quyền Pro/Enterprise.
