# Spec: domain-specific-ai-modes

## 1. Mục Tiêu
Cung cấp chế độ chuyên sâu theo lĩnh vực Pháp lý và Y tế cho tính năng Hỏi đáp RAG và AI Studio, áp dụng system prompt chuyên gia, siết chặt căn cứ tài liệu và thiết lập tham số lấy mẫu khắt khe nhằm đáp ứng nhu cầu khắt khe của người dùng Pro và Enterprise.

## 2. Yêu Cầu Chức Năng
- **FR-1**: Mở rộng `RagAskInput` và `StudioGenerateInput` với trường `domainMode?: DomainMode` (`"general" | "legal" | "medical"`).
- **FR-2**: Cấp cờ tính năng `specialistAiModes` cho phân tầng Pro và Enterprise; ném `licenseRequireProSpecialistModes` khi người dùng Free gọi chế độ chuyên ngành.
- **FR-3**: Chế độ Pháp lý (`legal`): system prompt yêu cầu trích dẫn Điều/Khoản/Điểm, kiểm tra mâu thuẫn nghĩa vụ và áp dụng `temperature: 0.1`.
- **FR-4**: Chế độ Y tế (`medical`): system prompt chuyên sâu về triệu chứng, chỉ định lâm sàng, kèm tuyên bố miễn trừ y khoa và áp dụng `temperature: 0.1`.
- **FR-5**: Giao diện chọn Chế độ Chuyên môn đặt tại composer của Chat và AI Studio, hiển thị huy hiệu PRO và tự động kích hoạt lời mời nâng cấp bản quyền khi người dùng Free tương tác.

## 3. Ràng Buộc Kỹ Thuật
- **Local-first**: Chạy hoàn toàn ngoại tuyến trên mô hình cục bộ hoặc LAN AI Server.
- **Tuân thủ Hiến chương**: Không suy diễn ngoài tài liệu ở chế độ căn cứ (Constitution Principle II: Verifiable Citations).
