# Contract: domain-modes

## 1. IPC Kênh `rag:ask` & `rag:askStream`
- **Payload**: Bổ sung `domainMode?: DomainMode` (`"general" | "legal" | "medical"`).
- **Hành vi**:
  - Khi `domainMode === "legal"` hoặc `domainMode === "medical"`, hệ thống kiểm tra `licenseService.gate.hasFeature("specialistAiModes")`.
  - Nếu thiếu quyền, ném `UserFacingError("licenseRequireProSpecialistModes")`.
  - Khi hợp lệ, gọi mô hình với system prompt chuyên ngành và `temperature: 0.1`.

## 2. Mã Lỗi Người Dùng
- `licenseRequireProSpecialistModes`: "Chế độ AI Chuyên gia (Pháp lý & Y tế) yêu cầu bản quyền Pro hoặc Enterprise. Vui lòng nâng cấp bản quyền để sử dụng."
