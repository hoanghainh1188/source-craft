# Lời mời nâng cấp khi chạm hạn mức Free & nút Mua bản quyền (237)

- Ngày: 2026-10-24
- Feature: `237-license-upsell` (issue #237). Trạng thái: **Đã chấp nhận** (chủ dự án chốt 2026-10-24).
- Phạm vi: chỉ phần "dẫn người dùng tới trang mua". Cổng thanh toán và tự động cấp `.sclicense` là feature sau.

## Quyết định

1. **URL trang mua cố định ở main process** (`src/main/services/license-upsell/purchase-page.ts`). Renderer chỉ gọi
   kênh `license:openPurchasePage`, không truyền URL ⇒ kênh không thể bị dùng để mở URL tuỳ ý.
2. **v1 dùng URL tạm** `https://github.com/hoanghainh1188/source-craft#pricing` (chưa có cổng thanh toán). Khi có
   trang mua thật: đổi `PURCHASE_PAGE_URL` + `PURCHASE_PAGE_HOSTS` và test kèm theo.
3. **Lưới an toàn trước `shell.openExternal`:** chỉ `https:` và host nằm trong danh sách cho phép; chặn bấm liên tục
   (1 giây). Nhật ký chỉ ghi tên sự kiện, không ghi URL.
4. **Lời mời nâng cấp hiện ngay dưới câu báo lỗi** ở 3 nơi bị chặn theo gói: tạo notebook, thêm nguồn, Studio. Chỉ
   với các mã `licenseLimit*`, `licenseRequirePro*`, `lanAiRequireEnterprise`; lỗi khác không mời mua.
5. **Nút Mua trong Cài đặt › Bản quyền & Gói dịch vụ** hiện khi chưa có bản quyền trả phí đang hiệu lực (Free, hết
   hạn, không hợp lệ, đồng hồ lùi); ẩn khi `state === "valid"`.
6. **Quy trình:** feature nhỏ ⇒ làm trực tiếp trên branch `237-license-upsell`, không qua Spec Kit.

## Không làm ở feature này

- Lời mời khi phiên Ghi cuộc họp tự dừng ở mốc 15 phút (đó là dừng an toàn, không phải lỗi) — có thể bổ sung sau.
- Network egress: không có. App chỉ giao URL cho trình duyệt hệ thống khi người dùng bấm.
