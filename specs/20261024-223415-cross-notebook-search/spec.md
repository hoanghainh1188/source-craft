---
title: "Tìm kiếm & Hỏi đáp RAG Ngữ nghĩa Toàn cục Xuyên suốt Mọi Sổ tay"
slug: cross-notebook-search
created_at: 2026-10-24T22:34:15+07:00
updated_at: 2026-10-24T22:34:15+07:00
status: planned
tags:
  - rag
  - search
  - pro-license
  - enterprise
---

# Đặc tả Kỹ thuật: Tìm kiếm & Hỏi đáp RAG Toàn cục (`cross-notebook-search`)

## 1. Tóm tắt

Cung cấp khả năng mở rộng phạm vi hỏi đáp RAG từ 1 sổ tay đơn lẻ ra toàn bộ kho tri thức của người dùng. Tính năng được bảo vệ bởi cổng kiểm soát bản quyền (`FeatureGate`), chỉ dành riêng cho bản quyền Pro và Enterprise.

## 2. Yêu cầu Chức năng

- **FR-01 (License Gate)**: Chế độ tìm kiếm toàn cục `scope: "all"` chỉ được phép thực thi khi bản quyền có cờ `crossNotebookSearch`. Người dùng bản Free khi chọn chế độ này sẽ nhận lỗi `licenseRequireProCrossSearch`.
- **FR-02 (Hybrid Cross-Notebook Search)**: Cả hai nhánh Vector (LanceDB) và BM25 (SQLite FTS5) phải hỗ trợ tham số `notebookId?: string | null` để truy xuất toàn bộ các đoạn trích trong mọi sổ tay.
- **FR-03 (Citation Notebook Context)**: Danh sách dẫn chứng `citations` trả về từ RAG phải mang theo thông tin `notebookId` và `notebookName` của từng trích dẫn.
- **FR-04 (Scope Selector UI)**: Giao diện Chat RAG cung cấp nút chuyển đổi phạm vi trực quan: "Sổ tay này" hoặc "Toàn bộ kho tri thức".

## 3. Ranh giới Bảo mật & Bất biến

- **Local-first 100% (Principle I)**: Tìm kiếm đa sổ tay diễn ra hoàn toàn trên cơ sở dữ liệu LanceDB và SQLite cục bộ của máy tính người dùng.
- **Verifiable Citations (Principle II)**: Mọi chip dẫn chứng [n] trong câu trả lời bắt buộc phải liên kết chính xác tới đoạn văn bản gốc và sổ tay tương ứng.
