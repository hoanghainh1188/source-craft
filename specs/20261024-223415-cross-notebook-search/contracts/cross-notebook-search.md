# Hợp đồng Giao tiếp IPC: Tìm kiếm Toàn cục Đa Sổ tay (`cross-notebook-search`)

## 1. Kênh IPC `rag:askStream` và `rag:ask`

### Input:
```typescript
{
  notebookId: "nb-1",
  question: "Có những quy định nào về bồi thường đất đai?",
  mode: "grounded",
  history: [],
  scope: "all" // Chế độ tìm kiếm toàn cục
}
```

### Xử lý Cổng Bản quyền tại Main Process:
- Nếu `scope === "all"`:
  - Kiểm tra `licenseService.gate.hasFeature("crossNotebookSearch")`.
  - Nếu không có quyền: ném `UserFacingError("licenseRequireProCrossSearch")`.

### Output (Thành công):
```typescript
{
  answer: "Theo quy định tại các tài liệu quản lý đất đai [1], việc bồi thường được thực hiện...",
  citations: [
    {
      n: 1,
      chunkId: "chk-100",
      sourceId: "src-10",
      sourceTitle: "Nghi_Dinh_43.pdf",
      locator: { page: 15, charStart: 0, charEnd: 350 },
      notebookId: "nb-phap-ly-2024",
      notebookName: "Pháp lý & Bất động sản"
    }
  ],
  notFound: false,
  modeUsed: "grounded"
}
```
