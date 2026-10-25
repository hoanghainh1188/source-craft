# Quickstart — kiểm chứng Nhật ký kiểm toán (236)

Hướng dẫn chạy để chứng minh feature hoạt động đầu-cuối. Chi tiết định dạng: [contracts/audit-record.md](./contracts/audit-record.md); IPC/lỗi: [contracts/audit-ipc.md](./contracts/audit-ipc.md); CLI: [contracts/audit-cli.md](./contracts/audit-cli.md).

## Điều kiện

- Worktree `source-craft-236-audit`, `npm ci` đã chạy.
- Ollama cục bộ có model chat (kiểm tay) **hoặc** máy chủ Ollama giả của e2e (tự động).
- Bản quyền Enterprise: dev dùng `IV_E2E_LICENSE_TIER=enterprise` (chỉ bản chưa đóng gói).

## 1. Kiểm thử tự động

```bash
npm run test -- tests/unit/audit
```

Kỳ vọng: xanh, coverage `src/main/services/audit/**` ≥ 80% (ngưỡng chung trong `vitest.config.ts`). Bao gồm: chuỗi băm/chữ ký, mã hoá/giải mã câu hỏi, xoay vòng, sửa đuôi, máy trạng thái hiệu lực, đọc policy chỉ-hệ-thống, CLI verify/decrypt/keygen trên fixture can thiệp (SC-003), 10 000 bản ghi < 10 s (SC-004), seam e2e bị bỏ qua ở bản đóng gói.

```bash
npm run test:e2e -- tests/e2e/audit-log.spec.ts
```

Kỳ vọng: (a) policy bật + Enterprise ⇒ hỏi 1 câu + 1 lượt Studio ⇒ 2 cặp `interaction.start/end`; chỉ báo audit hiện; (b) tệp policy chỉ ở `userData` ⇒ không ghi, không chỉ báo (FR-005); (c) thư mục chỉ định không ghi được ⇒ lỗi `auditWriteFailed`, máy chủ Ollama giả **không nhận** request nào (FR-016); (d) tier free ⇒ Cài đặt báo "cần bản quyền Enterprise", AI vẫn chạy; (e) CLI `--audit-verify` trên thư mục vừa sinh ⇒ mã thoát 0; (f) thời gian tới token đầu chênh ≤ 50 ms (SC-005).

## 2. Kiểm tay (macOS / Windows)

1. Sinh khoá tổ chức:
   ```bash
   "<app>" --audit-keygen --out-dir ./org-keys
   ```
   Kỳ vọng: 2 tệp PEM + đoạn JSON `auditPublicKey`.
2. Đặt `enterprise-policy.json` **hệ thống** (`/Library/Application Support/SourceCraft/` hoặc `%ProgramData%\SourceCraft\`) với `enableAuditLogging: true`, `auditPublicKey` vừa sinh, kèm `.sclicense` Enterprise. Khởi động app.
   Kỳ vọng: chip "Đang ghi nhật ký kiểm toán" cạnh huy hiệu riêng tư; Cài đặt › Chính sách tổ chức hiển thị trạng thái và nhãn vị trí ("Mặc định" / "Do bộ phận IT chỉ định" — không hiện đường dẫn), không có nút tắt.
3. Hỏi 3 câu trong một sổ tay, 1 câu ở chế độ toàn cục, tạo 1 Studio `custom`, xuất Studio ra PDF, bấm Dừng giữa một câu trả lời.
   Kỳ vọng: thư mục `audit/` có các bản ghi tương ứng; `question` là bản mã; trích dẫn có tên nguồn/sổ tay; lượt dừng có `status: "cancelled"`; có `export.saved`.
4. Kiểm tra và giải mã:
   ```bash
   "<app>" --audit-verify "<thư mục audit>"
   ```
   ```bash
   "<app>" --audit-decrypt "<thư mục audit>" --org-key ./org-keys/sourcecraft-audit-org-private.pem --out ./decrypted.jsonl
   ```
   Kỳ vọng: `NGUYÊN VẸN`, mã thoát 0; `decrypted.jsonl` chứa đúng các câu đã hỏi.
5. Can thiệp: sửa 1 ký tự trong một dòng `interaction.start`, chạy lại `--audit-verify`.
   Kỳ vọng: `BỊ CAN THIỆP`, chỉ ra đúng `seq`, mã thoát 1.
6. Fail-closed: đổi `auditLogDirectory` sang thư mục chỉ-đọc, khởi động lại, hỏi 1 câu.
   Kỳ vọng: lỗi `auditWriteFailed` vi/en; không có request nào tới model (xem chỉ báo riêng tư không chuyển "đang gửi").
7. Khôi phục: trả quyền ghi, hỏi lại.
   Kỳ vọng: lượt chạy bình thường; nhật ký có `audit.recovered`.
8. Sao lưu rồi khôi phục vault; xoá lịch sử chat.
   Kỳ vọng: thư mục audit không đổi; `--audit-verify` vẫn nguyên vẹn (FR-021).
9. Windows: chạy bước 4 bằng `start /wait` và `--out`, kiểm `%ERRORLEVEL%`.
