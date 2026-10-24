## SourceCraft 1.0.0 — Official First Release

**English** · [Tiếng Việt](#tiếng-việt)

**Welcome to SourceCraft 1.0.0!** This milestone release marks the official launch of **SourceCraft** — your private, local-first AI knowledge assistant for deep document research, meeting synthesis, and verifiable note-taking.

### ✨ What's new in 1.0.0

- **Official Launch: SourceCraft.** The application is now officially named **SourceCraft**. Window titles, menus, native About dialogs, backup archives (`SourceCraft-….ivbackup`), and installers now reflect the new identity.
- **Seamless Data Continuity.** All your existing notebooks, indexed sources, chat conversations, Studio outputs, audio transcripts, and OS keychain API keys are preserved automatically. Backward-compatible migration ensures previous data directories and `.ivbackup` archives load seamlessly.
- **Brand-New In-App About Modal & Vibrant ASCII Banner.** Introducing a dedicated in-app About modal featuring a sleek, ultra-readable **Slant ALL-CAPS** ASCII banner, runtime version diagnostics, privacy state indicator, and third-party notices.
- **User-Centric Documentation Showcase.** Complete restructuring of both English and Vietnamese READMEs, featuring clear value propositions, direct comparisons with cloud-based AI tools (e.g. NotebookLM), feature breakdowns, and quick-start guides.
- **Verified Local-First Engine.** Document parsing (PDF, Word, TXT, Web), local audio transcription (Whisper), OCR (Tesseract), hybrid retrieval (LanceDB vector store + SQLite FTS5), and streaming chat with verifiable highlighted citations — running 100% on your machine.
- **Distribution-Friendly Licensing.** Licensed under MIT with zero copyleft/GPL contamination. Video audio extraction utilizes our custom-built, minimal LGPL FFmpeg 7.1.1 binary.

### ⚠️ Installing & Platform Notes (unsigned builds)

- **macOS (Apple Silicon):** If blocked by Gatekeeper → right-click `SourceCraft.app` → **Open**, or run `xattr -dr com.apple.quarantine /Applications/SourceCraft.app`.
- **Windows (x64):** If prompted by Windows SmartScreen → click **More info** → **Run anyway**.
- **Ollama Local AI:** Ensure [Ollama](https://ollama.com) is running locally with your desired model (e.g. `ollama run qwen2.5:7b` or `llama3.1:8b`).

---

### Tiếng Việt

**Chào mừng bạn đến với SourceCraft 1.0.0!** Phiên bản đánh dấu cột mốc phát hành chính thức đầu tiên của **SourceCraft** — trợ lý tri thức AI cục bộ (local-first) cho nghiên cứu tài liệu chuyên sâu, biên bản cuộc họp và ghi chú với trích dẫn kiểm chứng được.

#### ✨ Có gì mới ở phiên bản 1.0.0

- **Phát hành chính thức thương hiệu SourceCraft.** Ứng dụng chính thức mang tên **SourceCraft**. Tiêu đề cửa sổ, menu, hộp thoại Giới thiệu, tệp sao lưu (`SourceCraft-….ivbackup`) và các gói cài đặt đều mang nhận diện mới.
- **Bảo lưu dữ liệu người dùng tuyệt đối.** Toàn bộ notebook, tài liệu đã nạp, lịch sử hội thoại, bản thảo Studio, dữ liệu ghi âm và khóa API lưu trong OS Keychain đều được giữ nguyên vẹn. Cơ chế tương thích ngược tự động nhận diện và nạp dữ liệu cũ từ các phiên bản trước.
- **Hộp thoại Giới thiệu (About) In-App & Banner ASCII Mới.** Bổ sung hộp thoại About trực tiếp trong giao diện ứng dụng với banner ASCII phong cách **Slant ALL-CAPS** sắc nét, tương phản màu Cyan/Magenta cùng thông số runtime chi tiết.
- **Tài liệu README tái cấu trúc toàn diện.** README (song ngữ Anh - Việt) được làm mới hoàn toàn theo chuẩn sản phẩm: nêu bật giá trị cốt lõi, bảng so sánh trực quan với AI Cloud (NotebookLM), hướng dẫn cài đặt và các tính năng trọng tâm.
- **Động cơ RAG cục bộ ổn định.** Trích xuất đa định dạng (PDF, Docx, Ảnh, Audio, Video, URL), chuyển giọng nói thành văn bản cục bộ với Whisper, tìm kiếm kết hợp (Vector LanceDB + Full-text SQLite FTS5) và phản hồi kèm trích dẫn chính xác từng đoạn văn.
- **Bộ giấy phép sạch, sẵn sàng mở rộng.** Mã nguồn SourceCraft phát hành theo giấy phép MIT; tách audio từ video qua bản build LGPL tối giản của FFmpeg 7.1.1, hoàn toàn không dính mã GPL.

#### ⚠️ Lưu ý cài đặt (bản dựng chưa ký số thương mại)

- **macOS:** Nếu hệ điều hành cảnh báo ứng dụng chưa xác minh → chuột phải vào `SourceCraft.app` → chọn **Open** (hoặc mở Cài đặt → Privacy & Security → Open Anyway).
- **Windows:** Khi gặp SmartScreen → bấm **More info** → chọn **Run anyway**.
- **Ollama AI Cục bộ:** Khởi động Ollama trên máy với model mong muốn (ví dụ `ollama pull qwen2.5:7b` hoặc `llama3.1:8b`).

**Full changelog:** https://github.com/hoanghainh1188/source-craft/compare/v0.3.0...v1.0.0
