# Intake — 229-shared-team-notebooks

- Issue: #229 — "[feature] shared-team-notebooks: Đóng gói và chia sẻ Sổ tay Tri thức nhóm (.scnb) cho bản quyền Pro/Enterprise"
- Slug: `shared-team-notebooks` (branch `229-shared-team-notebooks`)
- Ngày intake: 2026-10-24
- Loại: tính năng NÂNG CAO (Pha 3 của lộ trình B2B Enterprise Edition). Yêu cầu bản quyền **Pro** hoặc **Enterprise** (`sharedNotebooks`).
- Chạm các tầng: `src/main/services/notebooks/package/` (đóng gói/giải nén `.scnb`, quản lý manifest, import và mount), `src/main/services/license/feature-gate.ts` (mở cờ `sharedNotebooks` cho gói Pro), `src/shared/` (IPC types, channels, user-error codes, i18n vi/en), `src/preload/`, và `src/renderer/` (nút Xuất/Nhập gói trên danh sách Notebook, huy hiệu Shared Read-only).

## Input sources

- [`docs/01-basic-design/shared-team-notebooks/basic-design.md`](../01-basic-design/shared-team-notebooks/basic-design.md) — **nguồn chính** (định dạng `.scnb`, hai chế độ Import Copy & Mount Read-Only, luồng dữ liệu).
- [`docs/01-basic-design/enterprise-license/basic-design.md`](../01-basic-design/enterprise-license/basic-design.md) — kế thừa `FeatureGate`, cờ bản quyền `sharedNotebooks`.
- [`.specify/memory/constitution.md`](../../.specify/memory/constitution.md) — I (Local-first & No Default Egress), III (Desktop Security Boundary), IV (TDD & coverage ≥ 80%).

## Prompt for /speckit-specify

Xây dựng hệ thống **Đóng gói và Chia sẻ Sổ tay Tri thức Nhóm (`shared-team-notebooks`)** cho ứng dụng SourceCraft:

1. **Phân tầng bản quyền (Tính năng Nâng cao / Pro License):**
   - Tính năng chỉ khả dụng cho người dùng kích hoạt bản quyền **Pro** hoặc **Enterprise** (cờ tính năng `sharedNotebooks`).
   - Gói Cộng đồng (Free) khi bấm xuất hoặc nhập gói tri thức sẽ hiển thị hộp thoại yêu cầu nâng cấp Pro (`licenseRequireProSharedNotebooks`).

2. **Định dạng Gói Tri thức `.scnb` (SourceCraft Notebook Package):**
   - Đóng gói toàn bộ tài liệu nguồn, các đoạn trích (`chunks`) và vector nhúng sẵn của notebook.
   - Khi nhập vào máy khác, người dùng có thể tra cứu và hỏi đáp RAG ngay mà không cần tốn thời gian tính toán vector lại từ đầu.

3. **Chế độ Sử dụng:**
   - **Nhập bản sao độc lập (Import)**: Tạo một notebook mới trong máy người dùng từ tệp `.scnb`.
   - **Gắn kết chỉ đọc (Mount Read-Only)**: Phục vụ chia sẻ kho tri thức chuẩn trong mạng nội bộ công ty (NAS / SMB).

## Ambiguities to raise in /speckit-clarify

0 ambiguities — phạm vi yêu cầu bản quyền Pro/Enterprise, cấu trúc tệp `.scnb` và hành vi chỉ đọc đã được xác định rõ ràng.

## Thuật ngữ mới (append vào glossary)

| Tiếng Việt | English (dùng trong code) | Ghi chú |
| --- | --- | --- |
| Gói sổ tay tri thức | `NotebookPackage` / `.scnb` | Tệp lưu trữ đóng gói toàn bộ notebook (manifest, nguồn, chunk, vector) — 229 |
| Sổ tay dùng chung chỉ đọc | `SharedNotebook` / `mounted` | Notebook gắn kết từ ổ mạng/gói dùng chung với quyền chỉ đọc — 229 |
