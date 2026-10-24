```ansi
[1;36m   _____ ____  __  ______  ____________  [1;35m__________  ___    ____________ [0m
[1;36m  / ___// __ \/ / / / __ \/ ____/ ____/ [1;35m/ ____/ __ \/   |  / ____/_  __/ [0m
[1;36m  \__ \/ / / / / / / /_/ / /   / __/   [1;35m/ /   / /_/ / /| | / /_    / /    [0m
[1;36m ___/ / /_/ / /_/ / _, _/ /___/ /___  [1;35m/ /___/ _, _/ ___ |/ __/   / /     [0m
[1;36m/____/\____/\____/_/ |_|\____/_____/  [1;35m\____/_/ |_/_/  |_/_/     /_/      [0m
```

# SourceCraft — Trợ lý Tri thức Cục bộ & Bảo mật Cao với AI

<p align="center">
  <strong>Biến tài liệu, tệp ghi âm và cuộc họp thành kho tri thức có thể kiểm chứng — chạy 100% trên máy tính của bạn.</strong>
</p>

<p align="center">
  <a href="https://github.com/hoanghainh1188/source-craft/releases/latest"><img src="https://img.shields.io/badge/N%E1%BB%81n%20t%E1%BA%A3ng-macOS%20%7C%20Windows-blue?style=flat-square" alt="Nền tảng" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/Gi%E1%BA%A5y%20ph%C3%A9p-MIT-green?style=flat-square" alt="Giấy phép MIT" /></a>
  <img src="https://img.shields.io/badge/Ri%C3%AAng%20t%C6%B0-100%25%20Local--First-brightgreen?style=flat-square" alt="Local First" />
  <img src="https://img.shields.io/badge/Thu%20th%E1%BA%ADp%20d%E1%BB%AF%20li%E1%BB%87u-Kh%C3%B4ng%20g%E1%BB%ADi%20ra%20ngo%C3%A0i-blueviolet?style=flat-square" alt="Zero Telemetry" />
  <a href="https://github.com/hoanghainh1188/source-craft/releases/latest"><img src="https://img.shields.io/github/v/release/hoanghainh1188/source-craft?style=flat-square&color=orange" alt="Phiên bản phát hành" /></a>
</p>

<p align="center">
  <a href="README.md">English</a> · <strong>Tiếng Việt</strong>
</p>

---

## ⚡ SourceCraft là gì?

**SourceCraft** là ứng dụng desktop nguồn mở (macOS và Windows) hỗ trợ nghiên cứu, hỏi đáp và tổng hợp tài liệu chuyên sâu bằng trí tuệ nhân tạo. Tương tự như **Google NotebookLM**, nhưng **chạy hoàn toàn cục bộ trên máy tính của bạn** mà không gửi bất kỳ dữ liệu nào lên đám mây.

Bạn chỉ cần đưa tài liệu PDF, Word, bài viết web, tệp âm thanh, video, hình ảnh hoặc ghi âm cuộc họp trực tiếp từ micro vào notebook. SourceCraft sẽ tự động bóc tách, lập chỉ mục và trả lời câu hỏi kèm **trích dẫn kiểm chứng được**: bấm vào chip `[n]` là tài liệu gốc sẽ mở ra đúng trang, đoạn văn hoặc thời điểm phát âm thanh được tô sáng.

> **Thiết kế dành cho những ai coi trọng bảo mật dữ liệu:** Nhà nghiên cứu, luật sư, chuyên gia pháp lý, nhà báo, kỹ sư và sinh viên làm việc với các tài liệu nội bộ, hợp đồng, hồ sơ mật không được phép tải lên dịch vụ của bên thứ ba.

---

## 🌟 Vì sao chọn SourceCraft?

| Tiêu chí so sánh | AI Đám mây (NotebookLM / Chat Web) | **SourceCraft** |
| :--- | :--- | :--- |
| **Bảo mật dữ liệu** | Tải lên máy chủ công ty bên thứ ba | 🔒 **100% cục bộ; dữ liệu không rời ổ cứng máy tính** |
| **Trích dẫn nguồn** | Dễ bịa trích dẫn (ảo giác), chung chung | 🎯 **Chip trích dẫn `[n]` mở thẳng đoạn văn bản hoặc giây phát âm thanh** |
| **Khả năng Offline** | Bắt buộc phải có mạng Internet liên tục | ✈️ **Chạy mượt mà offline khi đi máy bay, tàu xe, nơi không có mạng** |
| **Ghi âm cuộc họp** | Gửi tệp âm thanh lên API bên ngoài | 🎙️ **Thu âm trực tiếp + bóc băng chữ bằng Whisper chạy trên máy** |
| **Chi phí sử dụng** | Thu phí thuê bao tháng, giới hạn token | 💡 **Miễn phí trọn đời, mã nguồn mở (MIT), dùng không giới hạn** |
| **Tuỳ biến mô hình** | Bị khoá trong mô hình của nhà cung cấp | 🧩 **Tự do chọn model Ollama (Qwen, Llama, Mistral) hoặc dùng API key riêng** |

---

## ✨ Tính năng nổi bật

### 🎯 1. Hỏi đáp có trích dẫn chính xác tuyệt đối
- **Nói không với bịa đặt nguồn:** Mọi câu trả lời đều gắn kèm trích dẫn tới đúng vị trí trong tài liệu gốc. Nhấp vào chip `[n]`, tài liệu tương ứng sẽ mở ra ngay đoạn văn, bảng dữ liệu hoặc thời gian âm thanh được tô sáng.
- **Chế độ theo nguồn nghiêm ngặt:** Nếu tài liệu không chứa câu trả lời, SourceCraft sẽ thẳng thắn thông báo *"Không tìm thấy trong nguồn"* thay vì tự đoán mò.
- **Truy xuất lai (Hybrid Search):** Kết hợp tìm kiếm ngữ nghĩa bằng vector (LanceDB) cùng tìm kiếm từ khoá toàn văn (SQLite FTS5) để mang lại độ chính xác cao nhất.
- **Bộ chấm độ liên quan (Reranker):** Mô hình Cross-Encoder chạy cục bộ kiểm định lại độ liên quan của các đoạn văn bản trước khi đưa vào câu trả lời.

### 📚 2. Nạp tri thức đa định dạng
- **Văn bản & Tài liệu:** PDF (giữ nguyên thứ tự đọc, nhận diện bảng số liệu, trang nhiều cột, trang xoay ngang), `.docx`, `.txt`, `.md`.
- **Trang web:** Trích xuất nội dung bài viết sạch sẽ trực tiếp từ đường link URL.
- **Âm thanh & Video:** `.wav`, `.mp3`, `.flac`, `.ogg`, `.m4a`, `.aac`, `.mp4`, `.mov`, `.webm`, `.mkv` — bóc băng tự động bằng Whisper (tự động nhận diện Tiếng Việt và Tiếng Anh).
- **Hình ảnh:** `.png`, `.jpg`, `.webp`, `.bmp`, `.tiff` — OCR chữ tiếng Việt và tiếng Anh bằng Tesseract.

### 🎙️ 3. Ghi âm & Bóc băng cuộc họp *(Thử nghiệm)*
- Ghi âm trực tiếp từ micro thẳng vào notebook đang làm việc.
- Hiển thị transcript nháp thời gian thực kèm mốc thời gian và thước đo âm lượng lúc đang thu âm.
- Đánh dấu nhanh các mốc quan trọng trong cuộc họp: **Quyết định**, **Việc cần làm**, **Câu hỏi** (`⌘/Ctrl+M`).
- Trình phát lại sau cuộc họp: bấm vào bất kỳ câu nào để tua âm thanh tới đúng giây đó, tìm kiếm văn bản và xuất Markdown.
- Cơ chế khôi phục thông minh: nếu máy tính bị sập nguồn hoặc app tắt đột ngột, bản ghi sẽ tự động được phục hồi khi mở lại.

### 💡 4. AI Studio — 8 mẫu tổng hợp chuyên sâu
Biến kho tài liệu của notebook thành các sản phẩm hoàn chỉnh chỉ với 1 cú click:
- 📝 **Tóm tắt tổng quan** & 📌 **Các ý chính cốt lõi**
- ❓ **Bộ câu hỏi thường gặp (FAQ)** & 📖 **Tài liệu hướng dẫn học tập**
- 🗂️ **Dàn ý chi tiết** & ⏱️ **Dòng thời gian sự kiện (Timeline)**
- 👔 **Bản tóm lược cho lãnh đạo (Executive Briefing)** & 📖 **Bảng thuật ngữ chuyên ngành**
- ✍️ **Yêu cầu tuỳ chỉnh:** Tự nhập bất kỳ chỉ dẫn nào (tối đa 500 ký tự) cho một nhóm tài liệu đã chọn.
- Tự động lưu 10 phiên bản gần nhất và hỗ trợ xuất Markdown tức thì.

### 🔒 5. Bảo mật tối đa & Sao lưu mã hoá
- **Không thu thập dữ liệu:** Hoàn toàn không có telemetry, theo dõi hành vi hay kết nối ngầm.
- **Tuỳ chọn AI Online linh hoạt:** Khi cần sức mạnh của các siêu mô hình, bạn có thể kết nối Claude, Gemini hoặc OpenAI bằng **API key của chính bạn** (lưu an toàn trong OS Keychain). Huy hiệu bảo mật sẽ sáng lên để bạn luôn biết khi nào có dữ liệu ra ngoài.
- **Sao lưu mã hoá tiện lợi:** Đóng gói toàn bộ notebook thành một tệp duy nhất `.ivbackup`, hỗ trợ mã hoá bảo vệ bằng mật khẩu (AES-256-GCM).

### 🌐 6. Giao diện song ngữ mượt mà
- Hỗ trợ đầy đủ **Tiếng Việt** và **English** (chuyển đổi tức thì trong Cài đặt).
- AI thông minh tự động trả lời theo ngôn ngữ của câu hỏi mà bạn đặt.

---

## 🚀 Hướng dẫn Cài đặt & Sử dụng Nhanh

### Bước 1: Tải bộ cài SourceCraft
Tải bản cài đặt phù hợp với hệ điều hành của bạn từ mục [Releases](https://github.com/hoanghainh1188/source-craft/releases/latest):

- **macOS (Apple Silicon M1/M2/M3/M4):** `SourceCraft-<version>-arm64.dmg`
- **Windows (x64):** `SourceCraft-<version>-Setup.exe`

> [!NOTE]
> **Lưu ý khi mở ứng dụng lần đầu:** Do bản dựng hiện chưa mua chứng chỉ ký số thương mại:
> - **macOS:** Chuột phải vào ứng dụng trong `/Applications` $\rightarrow$ chọn **Open**, hoặc chạy lệnh Terminal:
>   ```bash
>   xattr -dr com.apple.quarantine /Applications/SourceCraft.app
>   ```
> - **Windows:** Nếu màn hình SmartScreen hiện lên, bấm **More info** (Thông tin khác) $\rightarrow$ **Run anyway** (Vẫn chạy).

### Bước 2: Cài đặt Ollama (Engine AI Cục bộ)
1. Tải và cài đặt [Ollama](https://ollama.com).
2. Tải mô hình chat phù hợp với RAM máy tính (khuyến nghị Qwen 2.5 7B hoặc Llama 3.1 8B):
   ```bash
   ollama pull qwen2.5:7b
   ```
*(Các mô hình nhúng văn bản, bóc băng giọng nói, OCR và chấm điểm liên quan sẽ được ứng dụng tự động tải về một lần duy nhất trong lần dùng đầu tiên).*

### Bước 3: Bắt đầu khai thác tri thức
Khởi động SourceCraft, tạo notebook đầu tiên, kéo thả tài liệu vào và bắt đầu đặt câu hỏi!

---

## 👥 Đối tượng sử dụng phù hợp

- 🔬 **Nhà nghiên cứu & Học giả:** Đọc hiểu hàng trăm tài liệu nghiên cứu, so sánh kết quả và trích dẫn chuẩn xác từng trang.
- ⚖️ **Luật sư & Chuyên gia Pháp lý:** Thẩm định hợp đồng, rà soát văn bản tố tụng với cam kết bảo mật tuyệt đối.
- 💼 **Nhà quản lý & Trưởng nhóm:** Lưu trữ biên bản cuộc họp, biến bản ghi âm thành danh sách hành động và bản tóm tắt điều hành.
- 📰 **Nhà báo & Tác giả:** Xử lý hồ sơ tài liệu lớn, phỏng vấn thực địa và kiểm chứng thông tin nguồn ngoại tuyến.
- 🎓 **Sinh viên:** Tổng hợp slide bài giảng, giáo trình và bài thu âm thành tài liệu ôn tập và bộ câu hỏi trắc nghiệm.

---

## 🛠️ Dành cho Lập trình viên

### Kiến trúc Công nghệ
- **Vỏ ứng dụng Desktop:** Electron + electron-vite
- **Giao diện người dùng:** React 18, TypeScript, Vite, Zustand, TanStack Query
- **Cơ sở dữ liệu cục bộ & FTS:** SQLite (FTS5) trong main process
- **Kho Vector nhúng:** LanceDB (kho lưu trữ vector serverless nhúng cục bộ)
- **AI Pipelines nội bộ:** `@huggingface/transformers` (multilingual-e5-small, Whisper) + `tesseract.js` + Ollama
- **Xử lý Audio/Video:** Bản dựng FFmpeg 7.1.1 LGPL tối giản tự biên dịch

### Thiết lập Môi trường Phát triển
```bash
# Clone mã nguồn
git clone git@github.com:hoanghainh1188/source-craft.git
cd source-craft

# Cài đặt thư viện phụ thuộc
npm install

# Khởi chạy chế độ phát triển (HMR)
npm run dev

# Chạy toàn bộ kiểm thử tự động (Vitest + Playwright e2e)
npm test
npm run test:e2e

# Đóng gói bản cài đặt
npm run build
npm run dist
```

---

## ⚠️ Giới hạn đã biết

- **Câu hỏi gần chủ đề nhưng tài liệu không trả lời:** Bộ chấm độ liên quan đôi khi có thể cho qua một đoạn văn gần chủ đề (ví dụ hỏi thang máy trong tài liệu đường sắt). Mô hình chat thường vẫn sẽ từ chối *"Không tìm thấy trong nguồn"* (xem issue [#187](https://github.com/hoanghainh1188/source-craft/issues/187)).
- **Bảng biểu / Hộp thông tin PDF phức tạp:** Các bảng biểu không kẻ viền hoặc hộp thông tin Wikipedia phức tạp có thể bị trộn dòng văn bản khi trích xuất ([#206](https://github.com/hoanghainh1188/source-craft/issues/206)).
- **Ghi âm thử nghiệm trên Windows:** Đang tiếp tục thử nghiệm khả năng tương thích với nhiều dòng micro và tai nghe Bluetooth trên Windows ([#186](https://github.com/hoanghainh1188/source-craft/issues/186)).

---

## 🤝 Đóng góp & Cộng đồng

Chúng tôi rất hoan nghênh các đóng góp, báo cáo lỗi và đề xuất tính năng mới!
- Xem hướng dẫn đóng góp tại [CONTRIBUTING.md](CONTRIBUTING.md).
- Mở issue hoặc thảo luận tại [GitHub Issues](https://github.com/hoanghainh1188/source-craft/issues).
- Mọi trao đổi bằng **Tiếng Việt** hoặc **English** đều được tiếp nhận nhiệt tình.

---

## 📄 Giấy phép

- SourceCraft được phát hành dưới [Giấy phép mã nguồn mở MIT](LICENSE).
- Bản quyền và thông báo của các thư viện bên thứ ba được ghi nhận chi tiết tại [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).
