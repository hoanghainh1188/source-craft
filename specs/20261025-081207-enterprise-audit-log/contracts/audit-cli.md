# Contract — Chế độ dòng lệnh cho IT (236, C4)

Gọi chính tệp chạy của ứng dụng đã cài:

- macOS: `"/Applications/SourceCraft.app/Contents/MacOS/SourceCraft" <lệnh> …`
- Windows: `"%LOCALAPPDATA%\Programs\SourceCraft\SourceCraft.exe" <lệnh> …` (đường dẫn theo bản cài NSIS)

Rẽ nhánh ở đầu `main/index.ts`, **trước** single-instance lock và mọi truy cập `userData`; không mở cửa sổ, không nạp DB/model, không mạng. Chạy được khi app đang mở.

## Lệnh

| Lệnh                    | Tham số                                                                                                                          | Hành vi                                                                                                                                                                                                                                                                                           |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--audit-verify <dir>`  | `[--expect-device-key <danh sách tệp PEM \| deviceKeyId, cách nhau bằng dấu phẩy>]` `[--json]` `[--out <tệp>]` `[--lang vi\|en]` | Đọc mọi `audit-*.jsonl` trong `<dir>`, kiểm tra theo [audit-record.md](./audit-record.md), in báo cáo (chữ hoặc JSON `AuditVerifyReport` — [data-model.md](../data-model.md) §7). `--expect-device-key`: khoá máy đầu chuỗi hoặc khoá sau xoay KHÔNG nằm trong danh sách ⇒ `unexpectedDeviceKey`. |
| `--audit-decrypt <dir>` | `--org-key <tệp PEM khoá bí mật X25519>` `--out <tệp>` `[--lang vi\|en]`                                                         | Kiểm tra trước (như verify); `tampered` ⇒ vẫn giải mã nhưng ghi cảnh báo đầu tệp. Ghi JSONL: mỗi `interaction.start` có `question` kèm thêm `questionText`. **Bắt buộc `--out`**; không in câu hỏi ra stdout. Khoá bí mật chỉ đọc vào bộ nhớ, không lưu.                                          |
| `--audit-keygen`        | `--out-dir <thư mục>` `[--lang vi\|en]`                                                                                          | Sinh cặp X25519 tổ chức: `sourcecraft-audit-org-private.pem` (quyền 0600 trên macOS) và `sourcecraft-audit-org-public.pem`; in đoạn JSON `"auditPublicKey": "…"` để dán vào policy và `orgKeyId`. Từ chối ghi đè tệp đã có.                                                                       |
| `--help-audit`          | —                                                                                                                                | In hướng dẫn ngắn (vi/en theo `--lang` hoặc locale OS).                                                                                                                                                                                                                                           |

Không có lệnh nào sửa, xoá, ký lại hay ghi vào thư mục nhật ký (FR-020b).

## Mã thoát

| Mã  | Ý nghĩa                                                                                                                              |
| --- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `0` | Nguyên vẹn (có thể kèm cảnh báo: tương tác chưa kết thúc, đổi khoá, bắt đầu sau `seq 0`, đồng hồ lùi, đuôi đã sửa) / lệnh thành công |
| `1` | Bị can thiệp (`firstFailure` có mặt)                                                                                                 |
| `2` | Lỗi sử dụng (thiếu/thừa tham số, tệp đích đã tồn tại)                                                                                |
| `3` | Lỗi I/O hoặc khoá (không đọc được thư mục, khoá sai định dạng, `orgKeyId` không khớp)                                                |

## Báo cáo chữ (vi, minh hoạ)

```text
SourceCraft — Kiểm tra nhật ký kiểm toán
Thư mục: D:\AuditLogs\SourceCraft (3 tệp, 9 214 bản ghi, seq 0–9213)
Khoảng thời gian: 2026-10-25 02:10:11Z → 2026-11-02 09:44:03Z
Khoá máy: 9f2c… (1 lần đổi khoá lúc seq 5120 — keyMissing)
KẾT QUẢ: NGUYÊN VẸN — 2 cảnh báo
  • seq 7731: tương tác 01JC… chưa kết thúc (phiên đang chạy)
  • seq 5120: đổi khoá ký (keyMissing)
```

## Windows

Ứng dụng GUI không gắn vào console: dùng `--out <tệp>` hoặc chuyển hướng `> report.txt`, và `start /wait "" SourceCraft.exe --audit-verify … --out r.json` rồi `echo %ERRORLEVEL%` để lấy mã thoát. Ghi trong `docs/enterprise-deployment-guide.md`.
