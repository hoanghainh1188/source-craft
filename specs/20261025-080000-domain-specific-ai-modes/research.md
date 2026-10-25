# Research: domain-specific-ai-modes

## 1. Tối Ưu Hóa Tham Số Lấy Mẫu Cho Pháp Lý & Y Tế
Các nghiên cứu và thực nghiệm RAG trong ngành luật và y tế cho thấy tham số `temperature` đóng vai trò sống còn đối với độ tin cậy:
- Mức nhiệt độ cao (>= 0.7) dễ dẫn tới việc mô hình tự ý diễn giải thêm các quyền lợi, chế tài hoặc kết luận y khoa không có trong văn bản nguồn.
- Thiết lập `temperature: 0.1` giúp việc sinh văn bản mang tính quyết định luận (deterministic), bám sát nguyên văn định nghĩa và ràng buộc của tài liệu.

## 2. Cấu Trúc Lời Nhắc Chuyên Gia (Domain Personas)
- **Legal Persona**:
  - Dẫn hướng mô hình luôn kiểm tra mối quan hệ thứ bậc của các điều khoản và trích dẫn mã điều khoản (Ví dụ: "Theo Khoản 2 Điều 15 của Hợp đồng [1]...").
  - Khi phát hiện điều khoản mâu thuẫn giữa 2 tài liệu, chỉ ra sự khác biệt thay vì tự ý dung hòa.
- **Medical Persona**:
  - Phân tách rõ giữa triệu chứng mô tả, kết quả xét nghiệm và phương án can thiệp.
  - Tự động gắn tuyên bố miễn trừ y khoa cuối câu trả lời nhằm phòng tránh trách nhiệm pháp lý và rủi ro y tế.
