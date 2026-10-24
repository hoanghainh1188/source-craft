## SourceCraft 1.0.1 — Ollama reasoning-model fix

**English** · [Tiếng Việt](#tiếng-việt)

### 🐛 Fixed

- **Better answers with local reasoning models (Qwen 3.5, gpt-oss, …).** Ollama models that support "thinking" spent most of their output budget on hidden reasoning, leading to slow, truncated or empty answers in chat, summaries and Studio. SourceCraft now detects each model's capabilities via Ollama's `/api/show` and sends `think: false` to models that advertise `thinking`, so they answer directly. Models without thinking support are unaffected (#224, #225).

### ⚠️ Installing & Platform Notes (unsigned builds)

- **macOS (Apple Silicon):** If blocked by Gatekeeper → right-click `SourceCraft.app` → **Open**, or run `xattr -dr com.apple.quarantine /Applications/SourceCraft.app`.
- **Windows (x64):** If prompted by Windows SmartScreen → click **More info** → **Run anyway**.

---

### Tiếng Việt

#### 🐛 Sửa lỗi

- **Trả lời tốt hơn với model suy luận chạy local (Qwen 3.5, gpt-oss, …).** Các model Ollama hỗ trợ "thinking" trước đây dồn phần lớn ngân sách token vào phần suy luận ẩn, khiến câu trả lời chậm, bị cắt hoặc rỗng ở chat, tóm tắt và Studio. SourceCraft giờ dò khả năng của từng model qua `/api/show` của Ollama và gửi `think: false` cho model có `thinking`, để model trả lời trực tiếp. Model không hỗ trợ thinking không bị ảnh hưởng (#224, #225).

#### ⚠️ Lưu ý cài đặt (bản dựng chưa ký số thương mại)

- **macOS:** Nếu bị chặn → chuột phải vào `SourceCraft.app` → chọn **Open** (hoặc Cài đặt → Privacy & Security → Open Anyway).
- **Windows:** Khi gặp SmartScreen → bấm **More info** → chọn **Run anyway**.

**Full changelog:** https://github.com/hoanghainh1188/source-craft/compare/v1.0.0...v1.0.1
