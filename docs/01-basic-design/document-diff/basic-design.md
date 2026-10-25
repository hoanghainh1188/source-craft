# Basic Design: Document Diff & Contract Redline

## 1. Mục tiêu kiến trúc
Cung cấp khả năng phân tích so sánh đối chiếu văn bản tự động (Document Diff / Contract Redline) trong AI Studio của SourceCraft, phục vụ người dùng khối Pháp lý, Doanh nghiệp và Quản lý dự án.

## 2. Luồng xử lý (Workflow)

```mermaid
flowchart TD
    User["Người dùng chọn ≥ 2 tài liệu nguồn & bấm 'So sánh văn bản'"]
    UI["StudioColumn / StudioScopePicker"]
    Gate["License FeatureGate (assertCanGenerateStudio)"]
    Service["StudioService (validate source count ≥ 2)"]
    Prompt["prompt.ts: task('documentDiff')"]
    Balanced["buildBalancedContext / runMapReduce"]
    LLM["LLM Chat (Local / Online)"]
    Postprocess["postprocessCitations & lưu StudioResult"]

    User --> UI
    UI --> Gate
    Gate -- "Gói Free" --> Upgrade["Hiện UpgradePrompt (licenseRequireProStudio)"]
    Gate -- "Pro / Enterprise" --> Service
    Service -- "Số nguồn < 2" --> Error["Báo lỗi studioDiffNeedTwoSources"]
    Service -- "Hợp lệ" --> Prompt
    Prompt --> Balanced
    Balanced --> LLM
    LLM --> Postprocess
    Postprocess --> UI
```

## 3. Ràng buộc & Tiêu chuẩn
- Tuân thủ nguyên tắc **Local-first** và **Verifiable Citations (Constitution II)**: Mọi nhận định về thay đổi, điều khoản thêm/bớt đều phải mang chip trích dẫn `[n]` trỏ về chunk gốc tương ứng.
- Hoàn toàn ngoại tuyến (Zero Network Egress khi chạy với Ollama/LAN AI).
- Gated bởi bản quyền Pro/Enterprise.
