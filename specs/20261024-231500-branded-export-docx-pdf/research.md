# Research: branded-export-docx-pdf

## 1. Cấu Trúc File DOCX (Open Packaging Conventions)
Một tệp `.docx` tiêu chuẩn gồm các file XML được nén dưới định dạng ZIP:
1. `[Content_Types].xml`: Định nghĩa MIME types cho từng phần mở rộng và file cụ thể.
2. `_rels/.rels`: Khai báo quan hệ gốc tới `word/document.xml`.
3. `word/_rels/document.xml.rels`: Khai báo quan hệ tới `styles.xml`, `header1.xml`, `footer1.xml`.
4. `word/styles.xml`: Định nghĩa các kiểu đoạn văn bản: Normal, Heading1, Heading2, Table, v.v.
5. `word/header1.xml` & `word/footer1.xml`: Chứa thông tin tiêu đề trang, tác giả, và thẻ trường số trang tự động `w:fldSimple w:instr="PAGE"`.
6. `word/document.xml`: Nội dung văn bản chính được bọc trong các thẻ `<w:p>`, `<w:r>`, `<w:t>`.

Với việc sử dụng module `node:zlib` của Node.js (cụ thể là `deflateRawSync` và bảng mã CRC32), ta có thể tạo file ZIP chuẩn 100% trong bộ nhớ mà không cần cài đặt thêm thư viện cồng kềnh, giúp giữ bundle nhỏ gọn và bảo đảm tính bảo mật của mã nguồn.

## 2. In PDF bằng Chromium trong Electron
Electron cung cấp hàm `webContents.printToPDF` trên đối tượng `BrowserWindow` hoặc `WebContents`. Khi tải một trang HTML chứa nội dung báo cáo với CSS `@page { size: A4 portrait; margin: 15mm; }`, Chromium sẽ render trực tiếp thành luồng byte PDF vector chuẩn xác, bảo đảm phông chữ Unicode tiếng Việt hiển thị hoàn hảo.
