# Contract — Tệp nhật ký kiểm toán (định dạng trên đĩa, v1)

Người dùng hợp đồng: trình kiểm tra/giải mã (CLI, R13), SIEM/công cụ của IT. Trường và kiểu: [data-model.md](../data-model.md) §3–§5.

## Tệp

- Thư mục: `auditLogDirectory` (policy hệ thống) hoặc `<userData>/audit/`.
- Tên: `audit-<seq bản ghi đầu tệp, 12 chữ số, đệm 0>.jsonl` — ví dụ `audit-000000000000.jsonl`, `audit-000000004812.jsonl`.
- Mã hoá UTF-8, mỗi bản ghi một dòng kết thúc `\n`, không BOM. Tệp hiện hành xoay khi vượt 5 MB (5 242 880 byte).
- Tệp đầu tiên của máy bắt đầu bằng `audit.chainStarted` (`seq 0`); mọi tệp sau bắt đầu bằng `audit.fileStarted`.

## Tính `hash` và `sig`

1. Lấy object bản ghi, bỏ hai khoá `hash` và `sig`.
2. Tuần tự hoá bằng JSON chuẩn hoá (khoá sắp theo thứ tự code unit tăng dần ở mọi cấp, không khoảng trắng, số theo `JSON.stringify`) — cùng thuật toán `src/main/services/license/canonical-json.ts`.
3. `hash` = SHA-256 của byte UTF-8 kết quả, hex chữ thường (64 ký tự).
4. `sig` = Ed25519 bằng khoá ký của máy trên byte UTF-8 của chuỗi `hash`, base64 chuẩn (có `=`).
5. Dòng ghi ra đĩa = JSON chuẩn hoá của bản ghi **có** `hash` và `sig`.

Bất biến kiểm tra (theo thứ tự `seq`, xuyên tệp):

- `seq(i) = seq(i-1) + 1`; `prevHash(i) = hash(i-1)`; `seq 0` có `prevHash = "0"×64` và `type = "audit.chainStarted"`.
- `hash` tính lại khớp; `sig` hợp lệ với khoá công khai máy **đang hiệu lực** (khoá của `audit.chainStarted` gần nhất hoặc `audit.keyRotated` gần nhất; bản ghi `audit.keyRotated` tự ký bằng khoá **mới** nó công bố).
- `interaction.end.interactionId` phải khớp một `interaction.start` trước đó; `start` không có `end` và không nằm trong `audit.sessionAborted` ⇒ cảnh báo `openInteraction` (chỉ hợp lệ cho phiên hiện hành).
- `audit.stopped` không được đứng sau `interaction.start` còn mở của cùng phiên: `stop()` ghi `interaction.end{status:"cancelled"}` cho từng tương tác mở trước khi ghi `audit.stopped`.
- Dòng không parse được chỉ hợp lệ nếu ngay sau nó là `audit.tailRepaired` với `danglingBytes` = độ dài byte dòng đó.

## Ví dụ (rút gọn, giá trị minh hoạ)

```jsonl
{"devicePublicKey":"-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEA…\n-----END PUBLIC KEY-----\n","deviceKeyId":"9f2c…","hash":"5b1e…","orgKeyId":"a41d…","prevHash":"0000…0000","seq":0,"sig":"q3Lw…==","ts":"2026-10-25T02:10:11.512Z","type":"audit.chainStarted","v":1}
{"appVersion":"0.3.0","deviceKeyId":"9f2c…","hash":"c07a…","host":"BANK-LT-0142","organization":"Ngân hàng X","orgKeyId":"a41d…","osUser":"CORP\\nguyen.an","policyId":"pol-2026-10","prevHash":"5b1e…","seq":1,"sig":"…","ts":"2026-10-25T02:10:11.530Z","type":"audit.started","v":1}
{"channel":"rag","hash":"…","host":"BANK-LT-0142","interactionId":"01JB…","model":{"category":"local","model":"qwen2.5:7b","providerId":"ollama"},"osUser":"CORP\\nguyen.an","prevHash":"c07a…","question":{"alg":"x25519-hkdf-sha256-aes256gcm","ct":"…","epk":"…","len":58,"nonce":"…","orgKeyId":"a41d…","tag":"…"},"scope":{"kind":"notebook","notebookId":"nb_7","notebookName":"Hợp đồng 2026"},"seq":2,"sig":"…","ts":"2026-10-25T02:11:40.004Z","type":"interaction.start","v":1}
{"citations":[{"chunkId":"ch_88","locator":{"page":4,"char_start":120,"char_end":410},"n":1,"notebookId":"nb_7","notebookName":"Hợp đồng 2026","sourceId":"src_3","sourceTitle":"HĐ cung ứng A.pdf"}],"hash":"…","interactionId":"01JB…","model":{"category":"local","model":"qwen2.5:7b","providerId":"ollama"},"prevHash":"…","seq":3,"sig":"…","status":"completed","ts":"2026-10-25T02:11:52.871Z","type":"interaction.end","v":1}
```

## Giải mã `question` (chỉ IT, offline)

1. `shared = X25519(orgPrivateKey, epk)`.
2. `key = HKDF-SHA256(ikm = shared, salt = DER(epk), info = "sourcecraft-audit-v1", L = 32)`.
3. `plaintext = AES-256-GCM-Decrypt(key, nonce, ct, tag, aad = UTF-8("<seq>|<interactionId>"))`.
4. `orgKeyId` không khớp khoá IT đang giữ ⇒ báo "khoá tổ chức khác", không thử giải mã.

## Tương thích

- Thêm trường mới vào bản ghi là thay đổi tương thích (trình kiểm tra băm toàn bộ object, không cần biết trường). Đổi thuật toán băm/ký/mã hoá ⇒ tăng `v` và `alg`.
