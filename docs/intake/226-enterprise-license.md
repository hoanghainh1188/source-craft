# Intake — 226-enterprise-license

- Issue: #226 — "[feature] enterprise-license: Hệ thống bản quyền offline Ed25519 và phân tầng Free/Pro/Enterprise"
- Slug: `enterprise-license` (branch `226-enterprise-license`)
- Ngày intake: 2026-10-24
- Loại: tính năng MỚI (Pha 1 của lộ trình B2B Enterprise Edition). Chạm các tầng: `scripts/` (CLI phát hành license), `src/main/services/license/` (xác thực chữ ký số Ed25519 offline, quản lý tệp `.sclicense`, kiểm tra hạn mức `FeatureGate`), tích hợp vào `notebooks`, `ingestion`, `studio`, `meeting-capture`, `src/shared/` (IPC types, channels, user-error codes, i18n vi/en), `src/preload/`, và `src/renderer/` (Settings section Bản quyền, Header badge Enterprise, khóa PRO trên Studio).

## Input sources

- [`docs/01-basic-design/enterprise-license/basic-design.md`](../01-basic-design/enterprise-license/basic-design.md) — **nguồn chính** (6 mục: mục tiêu, 3 tầng sản phẩm & quyền lợi, cấu trúc tệp `.sclicense` & xác thực Ed25519, điểm chặn giới hạn ở main process, trải nghiệm người dùng & UI, ràng buộc bảo mật/riêng tư/i18n).
- [`docs/OVERVIEW.md`](../OVERVIEW.md) — mục 4 "Nền tảng": *"Hướng tới cộng đồng trước (miễn phí), freemium sau — nên kiến trúc cần 'sẵn sàng thu phí' (tách tầng license/đồng bộ)"* · mục 6 ràng buộc bất biến 1, 5 (local-first không egress, cách ly renderer).
- [`docs/03-ui/prototype.html`](../03-ui/prototype.html) — tham chiếu bố cục màn Cài đặt (`/settings`) và Header ứng dụng.
- [`.specify/memory/constitution.md`](../../.specify/memory/constitution.md) — I (Local-first & No Default Egress — xác thực bản quyền 100% offline), III (Desktop Security Boundary — kiểm tra hạn mức và mở hộp thoại chọn tệp `.sclicense` ở main process, không tin cậy renderer), IV (TDD & coverage ≥ 80%).
- [`docs/00-glossary.md`](../00-glossary.md) — đã tra cứu thuật ngữ hiện có; các thuật ngữ mới của hệ thống bản quyền được liệt kê ở mục "Thuật ngữ mới" bên dưới.
- [`docs/04-decisions/INDEX.md`](../04-decisions/INDEX.md) — kế thừa các quyết định về `UserFacingError` và i18n (`123-i18n`), hộp thoại chọn tệp ở main (`085-vault-backup`, `101-relink`), và cơ chế tự dừng phiên ghi cuộc họp (`186-meeting-capture`).

## Prompt for /speckit-specify

Xây dựng hệ thống **Quản lý Bản quyền Offline và Phân tầng Tính năng (`enterprise-license`)** cho ứng dụng SourceCraft nhằm hỗ trợ 3 tầng bản quyền thương mại: **Community (`free`)**, **Pro (`pro`)**, và **Enterprise (`enterprise`)**, vận hành **100% cục bộ (offline)** không cần kết nối mạng.

1. **Ba tầng sản phẩm và hạn mức quyền lợi (`Entitlements`):**
   - Mặc định khi chưa kích hoạt hoặc khi bản quyền hết hạn, ứng dụng chạy ở tầng **Community (`free`)** với các giới hạn dùng thử: tối đa **3 notebooks**, tối đa **10 nguồn mỗi notebook**, chỉ cho phép nạp các định dạng văn bản/web cơ bản (`pdf`, `docx`, `txt`, `md`, `url`), giới hạn thời lượng ghi âm cuộc họp tối đa **15 phút (900 giây) mỗi phiên**, và mở 2 mẫu tổng hợp AI Studio cơ bản (`summary`, `keyPoints`). Dữ liệu đã tạo từ trước nếu vượt ngưỡng vẫn được đọc, tìm kiếm, hỏi đáp và xóa bình thường, chỉ chặn khi tạo thêm mới vượt ngưỡng.
   - Tầng **Pro (`pro`)** và **Enterprise (`enterprise`)** mở khóa toàn bộ giới hạn: không giới hạn số lượng notebook và nguồn, mở khóa nạp `audio`, `video`, `image`, ghi âm cuộc họp không giới hạn thời lượng (≥ 120 phút), và mở khóa toàn bộ 9 loại AI Studio (gồm cả `custom`).
   - Tầng **Enterprise (`enterprise`)** bổ sung thêm thông tin tổ chức (`orgName`, số lượng máy `seats`), hiển thị huy hiệu `Enterprise · <orgName>` trên thanh Header của ứng dụng, và bật các cờ tính năng doanh nghiệp (`lanAi`, `sharedNotebooks`, `itPolicy`) để sẵn sàng cho các pha B2B tiếp theo.

2. **Tệp bản quyền `.sclicense` và xác thực chữ ký số Ed25519 Offline:**
   - Tệp `.sclicense` là tệp JSON (≤ 16 KB) chứa `payload` (`licenseId`, `tier`, `orgName`, `seats`, `issuedAt`, `expiresAt`, `features`) và `signature` (Base64Url).
   - Main process nhúng khóa công khai **Ed25519 Public Key** và xác thực chữ ký số trên chuỗi JSON chuẩn hóa (canonical JSON) của `payload` hoàn toàn offline bằng `node:crypto`.
   - Kiểm tra thời hạn `expiresAt` (nếu `null` là bản quyền vĩnh viễn; nếu đã qua thời điểm `expiresAt` thì báo trạng thái `expired` và áp dụng hạn mức `free`). Có cơ chế chống lùi đồng hồ hệ thống cơ bản (`clockRollback`: từ chối bản quyền có thời hạn nếu đồng hồ máy bị lùi quá 24 giờ so với mốc thời gian lớn nhất từng ghi nhận `lastSeenTimestamp`).
   - Cung cấp công cụ dòng lệnh `scripts/issue-license.mjs` cho nhà phát triển để sinh cặp khóa Ed25519 (`--keygen`) và ký phát hành tệp `.sclicense` (`--issue`).

3. **Kiểm tra giới hạn tại Main Process và Giao diện Người dùng:**
   - Mọi kiểm tra hạn mức phải diễn ra tại main process trước khi thực hiện thao tác: chặn `notebook:create` khi đạt 3 notebooks (`licenseLimitNotebooks`), chặn `source:add` khi đạt 10 nguồn (`licenseLimitSources`) hoặc khi thêm nguồn `audio`/`video`/`image` ở gói `free` (`licenseRequireProFormat`), chặn `studio:generate` với các mẫu nâng cao ở gói `free` (`licenseRequireProStudio`), và tự động dừng an toàn phiên ghi cuộc họp ở gói `free` khi chạm mốc 900 giây.
   - Trong màn **Cài đặt (`/settings`)**, thêm khu vực **"Bản quyền & Gói dịch vụ"** hiển thị trạng thái gói hiện tại, thông tin tổ chức/mã bản quyền/thời hạn (hoặc hạn mức gói miễn phí), nút **"Kích hoạt bằng tệp bản quyền (.sclicense)…"** (mở hộp thoại chọn tệp ở main process, sao chép lưu bền vào `<userData>/license.sclicense`) và nút **"Gỡ bản quyền"**.
   - Toàn bộ chuỗi giao diện, nhãn trạng thái và mã lỗi vượt hạn mức hỗ trợ đầy đủ song ngữ Tiếng Việt và English qua `src/shared/i18n`.

## Ambiguities to raise in /speckit-clarify

Không có mâu thuẫn hay điểm mơ hồ (0 ambiguities) — toàn bộ ngưỡng giới hạn (3 notebooks, 10 nguồn, 15 phút ghi âm, 2 mẫu Studio), thuật toán ký số (Ed25519 offline), và cơ chế giữ nguyên quyền đọc dữ liệu cũ khi hết hạn đã được chủ dự án phê duyệt rõ ràng trong kế hoạch kiến trúc B2B.

## Thuật ngữ mới (append vào glossary)

| 日本語 | Tiếng Việt | English (dùng trong code) | Ghi chú |
| --- | --- | --- | --- |
| — | Tầng bản quyền | `LicenseTier` (`"free" \| "pro" \| "enterprise"`) | 3 tầng sản phẩm; mặc định `"free"` (Community) — 226 |
| — | Tệp bản quyền offline | license file (`.sclicense`, `LicenseFile`) | JSON chứa `payload` (`LicensePayload`) + chữ ký số `signature` (Ed25519 Base64Url) — 226 |
| — | Trạng thái bản quyền | `LicenseStatus` (`state`: `"free" \| "active" \| "expired" \| "invalid" \| "clockRollback"`) | Trạng thái trả về qua kênh `license:getStatus`; `effectiveTier` là tầng thực tế được áp dụng — 226 |
| — | Cổng kiểm tra tính năng / hạn mức | feature gate (`FeatureGate`, `Entitlements`) | Kiểm tra quyền và hạn mức theo `effectiveTier` ở main process trước khi tạo notebook/nguồn/Studio/ghi âm — 226 |
| — | Chống lùi đồng hồ hệ thống | clock rollback guard (`lastSeenTimestamp`, `"clockRollback"`) | Lưu mốc thời gian lớn nhất từng thấy; chặn kích hoạt bản quyền có thời hạn nếu đồng hồ lùi > 24 giờ — 226 |

## Suggested constitution amendments

Không có — tính năng tuân thủ hoàn toàn Constitution v1.0.0 (đặc biệt củng cố Principle I: Local-first & No Default Egress nhờ cơ chế xác thực chữ ký Ed25519 offline 100%).
