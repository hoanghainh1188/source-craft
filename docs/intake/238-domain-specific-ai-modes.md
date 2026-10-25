# Intake: [feature] domain-specific-ai-modes: Chế độ AI Chuyên gia cho Pháp lý và Y tế (Strict Grounding & Specialist Personas) (Pro/Enterprise)

## 1. Thông tin Issue
- **Issue**: #238
- **Tiêu đề**: [feature] domain-specific-ai-modes: Chế độ AI Chuyên gia cho Pháp lý và Y tế (Strict Grounding & Specialist Personas) (Pro/Enterprise)
- **Nhánh**: `238-domain-specific-ai-modes`
- **Phân tầng cấp phép**: Pro & Enterprise (`specialistAiModes`)

## 2. Mục tiêu & Bối cảnh
Người dùng chuyên nghiệp hoạt động trong các lĩnh vực đặc thù như Pháp lý (luật sư, thẩm định viên hợp đồng, pháp chế doanh nghiệp) và Y tế (bác sĩ, nghiên cứu sinh y học, dược sĩ) có yêu cầu rất khắt khe đối với mô hình AI:
1. **Pháp lý**: Cần trích dẫn chính xác Điều, Khoản, Điểm; không được suy diễn mơ hồ; nhiệt độ lấy mẫu (temperature) cần thấp (0.1) để giảm thiểu ảo giác và giữ nguyên văn tính chặt chẽ của câu chữ.
2. **Y tế**: Cần nhận diện thuật ngữ lâm sàng, đối chiếu dược lý; luôn giữ vững nguyên tắc trích dẫn kiểm chứng được; bắt buộc có cảnh báo miễn trừ y khoa chuyên môn.
3. **Strict Grounding**: Kiên quyết từ chối suy đoán khi tài liệu nạp không có câu trả lời.
4. **License Gate**: Mở khóa tính năng Chế độ Chuyên gia cho người dùng Pro và Enterprise (`specialistAiModes`); người dùng Free sử dụng chế độ Chung (`general`).
