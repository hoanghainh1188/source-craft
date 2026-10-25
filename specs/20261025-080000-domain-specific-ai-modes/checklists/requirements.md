# Requirements Checklist: domain-specific-ai-modes

- [x] Định nghĩa kiểu dữ liệu `DomainMode` (`"general" | "legal" | "medical"`).
- [x] Bổ sung cờ `specialistAiModes` vào `LicenseFeature`.
- [x] Thêm `specialistAiModes` vào `DEFAULT_PRO_FEATURES`, `DEFAULT_ENTERPRISE_FEATURES` và `VALID_FEATURES`.
- [x] Gated IPC kiểm tra `domainMode === "legal" | "medical"` với `licenseRequireProSpecialistModes`.
- [x] Xây dựng system prompt pháp lý với chỉ dẫn trích dẫn Điều/Khoản/Điểm.
- [x] Xây dựng system prompt y tế với khuyến cáo y khoa bắt buộc.
- [x] Áp dụng `temperature: 0.1` cho các chế độ chuyên ngành.
- [x] Giao diện chọn chế độ trong `ChatColumn` và `useChat`.
- [x] Tích hợp với `UpgradePrompt` khi người dùng Free lựa chọn chế độ Pro.
