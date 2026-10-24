# Feature Spec: Enterprise License — Hệ thống Bản quyền Offline Ed25519 và Phân tầng Free/Pro/Enterprise

## 1. Mục tiêu

Xây dựng nền tảng quản lý bản quyền thương mại và phân tầng tính năng (Feature Gate) hoạt động **100% offline** cho SourceCraft, phục vụ đồng thời 2 mục tiêu:
1. Tạo ranh giới rõ ràng giữa bản **Community (Free)** dùng thử có giới hạn và bản trả phí (**Pro** cho cá nhân, **Enterprise** cho doanh nghiệp/tổ chức).
2. Cho phép các doanh nghiệp/tổ chức hoạt động trong môi trường mạng nội bộ cách ly (Air-gapped / Firewall chặn Internet) kích hoạt bản quyền bằng tệp `.sclicense` được ký số bất đối xứng **Ed25519** mà không cần bất kỳ kết nối mạng nào ra ngoài (tuân thủ Constitution I: Local-first & No Default Egress).

## 2. Ba tầng sản phẩm (License Tiers) và Quyền lợi (Entitlements)

Ứng dụng vận hành theo 3 tầng bản quyền (`LicenseTier`: `"free" | "pro" | "enterprise"`), mặc định khi mới cài đặt là `"free"`:

| Hạng mục / Tính năng | **Community (`free`)** | **Pro (`pro`)** | **Enterprise (`enterprise`)** |
| --- | --- | --- | --- |
| **Số lượng Notebook tối đa** | Tối đa **3** notebooks | Không giới hạn | Không giới hạn |
| **Số lượng Nguồn mỗi Notebook** | Tối đa **10** nguồn | Không giới hạn | Không giới hạn |
| **Loại nguồn hỗ trợ** | Văn bản & Web (`pdf`, `docx`, `txt`, `md`, `url`) | Toàn bộ định dạng (+ `audio`, `video`, `image`, `meeting`) | Toàn bộ định dạng (+ `audio`, `video`, `image`, `meeting`) |
| **Ghi âm cuộc họp (Meeting Capture)** | Tối đa **15 phút** (900 giây) mỗi phiên ghi | Không giới hạn (≥ 120 phút) | Không giới hạn (≥ 120 phút) |
| **AI Studio** | Chỉ 2 loại cơ bản (`summary`, `keyPoints`) | Toàn bộ 8 loại + `custom` prompt | Toàn bộ 8 loại + `custom` prompt |
| **Quyền tính năng B2B (`features`)** | Không | Không | Mở khóa cờ `lanAi`, `sharedNotebooks`, `itPolicy` (dùng cho Pha 2 & Pha 3) |
| **Hiển thị thương hiệu tổ chức** | Không | Hiển thị tên người sở hữu (`orgName`) trong Cài đặt | Hiển thị huy hiệu tổ chức (`orgName`, số ghế `seats`) ở Cài đặt và Header ứng dụng |

*Lưu ý về dữ liệu đã tạo trước khi hết hạn / hạ cấp:* Nếu người dùng đã có hơn 3 notebooks hoặc hơn 10 nguồn khi còn hạn Pro/Enterprise (hoặc từ phiên bản cũ), khi về gói `free` họ **vẫn được đọc, tra cứu, hỏi đáp và xóa** các notebook/nguồn hiện có, chỉ bị chặn khi bấm **Tạo thêm notebook mới** hoặc **Thêm nguồn mới** vượt ngưỡng.

## 3. Tệp Bản quyền Offline (`.sclicense`) và Cơ chế Xác thực Ed25519

### Cấu trúc tệp `.sclicense`
Tệp `.sclicense` là tệp JSON (UTF-8, kích thước ≤ 16 KB) gồm 2 trường:
- `payload`: đối tượng chứa thông tin bản quyền:
  - `licenseId` (string, bắt buộc): mã định danh duy nhất (VD: `"LIC-2026-ENT-001"`).
  - `tier` (`"pro" | "enterprise"`, bắt buộc): tầng bản quyền được cấp.
  - `orgName` (string, bắt buộc, 1..120 ký tự): tên cá nhân hoặc tổ chức sở hữu bản quyền (VD: `"Công ty Luật TNHH ABC"`).
  - `seats` (number, nguyên dương ≥ 1, tùy chọn — mặc định 1 cho Pro): số lượng máy được cấp phép.
  - `issuedAt` (string ISO 8601 UTC, bắt buộc): thời điểm phát hành.
  - `expiresAt` (string ISO 8601 UTC hoặc `null`, bắt buộc): thời điểm hết hạn (`null` = bản quyền vĩnh viễn / trọn đời).
  - `features` (mảng string, tùy chọn): danh sách cờ tính năng mở rộng (`"lanAi"`, `"sharedNotebooks"`, `"itPolicy"`, `"unlimitedSources"`, `"fullStudio"`).
- `signature` (string Base64Url, bắt buộc): chữ ký số **Ed25519** trên chuỗi JSON chuẩn hóa (canonical JSON: sắp xếp khóa theo thứ tự bảng chữ cái) của `payload`.

### Cơ chế xác thực tại Main Process
1. Main process nhúng sẵn khóa công khai **Ed25519 Public Key** (định dạng SPKI PEM / DER).
2. Khi nạp tệp `.sclicense`, main kiểm tra chữ ký bằng `crypto.verify(null, canonicalPayloadBytes, publicKey, signatureBytes)`.
3. Kiểm tra thời hạn:
   - Nếu `expiresAt !== null` và thời gian hiện tại `now > Date.parse(expiresAt)` → trạng thái là `expired` (hết hạn), quyền lợi thực tế quay về mức `"free"`, nhưng giao diện vẫn hiển thị thông báo bản quyền đã hết hạn để người dùng gia hạn.
   - Chống lùi đồng hồ hệ thống cơ bản (clock rollback guard): main lưu `lastSeenTimestamp` (cập nhật mỗi khi mở app và khi kiểm tra bản quyền nếu `now > lastSeenTimestamp`). Nếu phát hiện `now < lastSeenTimestamp - 24 giờ` (cho phép lệch múi giờ khi di chuyển tối đa 24h) và bản quyền có thời hạn (`expiresAt !== null`), từ chối kích hoạt với lý do `clockRollback`.

### Công cụ phát hành License (`scripts/issue-license.mjs`)
- Cung cấp script CLI chạy bằng Node.js cho nhà phát triển (Harry) để:
  1. Sinh cặp khóa Ed25519 (`--keygen`) lưu khóa bí mật vào biến môi trường hoặc tệp ngoài git (`.keys/license-private.pem` nằm trong `.gitignore`) và in khóa công khai.
  2. Ký phát hành tệp `.sclicense` (`--issue --tier enterprise --org "Công ty ABC" --seats 50 --expires 2027-12-31 --out abc.sclicense`).

## 4. Điểm chặn Giới hạn (Enforcement Gates) ở Main Process

Mọi kiểm tra giới hạn thực hiện tại **main process** (Constitution III — không tin cậy renderer):
1. **Tạo Notebook (`notebook:create`):** Nếu tầng hiệu lực là `"free"` và tổng số notebook hiện tại `>= 3` → ném `UserFacingError("licenseLimitNotebooks", { max: 3 })`.
2. **Thêm Nguồn (`source:add`):**
   - Nếu tầng hiệu lực là `"free"` và loại nguồn `kind` thuộc nhóm nâng cao (`"audio"`, `"video"`, `"image"`) → ném `UserFacingError("licenseRequireProFormat", { kind })`.
   - Nếu tầng hiệu lực là `"free"` và tổng số nguồn trong notebook đích `>= 10` → ném `UserFacingError("licenseLimitSources", { max: 10 })`.
3. **Tạo tổng hợp Studio (`studio:generate`):** Nếu tầng hiệu lực là `"free"` và `kind` không nằm trong `["summary", "keyPoints"]` → ném `UserFacingError("licenseRequireProStudio", { kind })`.
4. **Ghi cuộc họp (`meeting:start` & vòng lặp ghi):** Ở gói `"free"`, người dùng vẫn được dùng thử tính năng Ghi cuộc họp nhưng giới hạn tối đa **15 phút (900 giây)** mỗi phiên; khi chạm 900 giây, phiên ghi tự động kết thúc an toàn (tương tự cơ chế chạm giới hạn đĩa nhưng với lý do hết thời gian dùng thử hoặc hoàn tất bình thường).

## 5. Trải nghiệm Người dùng & Giao diện (UI)

### Mục "Bản quyền & Gói dịch vụ" trong màn Cài đặt (`/settings`)
- Hiển thị thẻ trạng thái bản quyền hiện tại:
  - Gói đang dùng: Huy hiệu **Community (Miễn phí)**, **Pro**, hoặc **Enterprise** (hoặc cảnh báo **Đã hết hạn**).
  - Nếu đã kích hoạt (`pro` / `enterprise`): hiển thị **Cấp phép cho (`orgName`)**, **Số lượng máy (`seats`)**, **Mã bản quyền (`licenseId`)**, và **Thời hạn (`expiresAt` hoặc "Vĩnh viễn")**.
  - Nếu đang ở gói `free`: hiển thị tóm tắt hạn mức hiện tại (Tối đa 3 notebooks · 10 nguồn/notebook · 2 mẫu Studio · 15 phút ghi âm/phiên).
- Các nút thao tác:
  - **`Kích hoạt bằng tệp bản quyền (.sclicense)…`**: mở hộp thoại chọn tệp của hệ điều hành tại main process (renderer không gửi đường dẫn tùy ý), xác thực chữ ký Ed25519, lưu bền vào thư mục dữ liệu (`<userData>/license.sclicense`) và cập nhật giao diện ngay lập tức.
  - **`Gỡ bản quyền`**: xóa tệp bản quyền đang lưu, quay về gói `free` (có xác nhận).

### Huy hiệu Doanh nghiệp trên Header & Chỉ báo trên UI
- Khi kích hoạt gói `enterprise` hợp lệ, thanh Header của ứng dụng hiển thị nhãn trang nhã cạnh tên ứng dụng: `Enterprise · <orgName>`.
- Tại màn Studio: khi ở gói `free`, các nút mẫu nâng cao (`faq`, `outline`, `studyGuide`, `briefing`, `timeline`, `keyTerms`, `custom`) có biểu tượng ổ khóa nhỏ `PRO` và khi bấm vào sẽ hiển thị thông báo nâng cấp rõ ràng (song ngữ Việt/Anh qua khung i18n).

## 6. Ràng buộc Bảo mật, Riêng tư & Khả năng tiếp cận
- **Không kết nối mạng:** Toàn bộ quá trình kích hoạt, kiểm tra chữ ký và kiểm tra hạn dùng diễn ra 100% cục bộ trên máy. Không gửi telemetry hay ping máy chủ bản quyền.
- **Cách ly tiến trình:** Hộp thoại chọn tệp `.sclicense` mở ở main process; renderer chỉ gọi kênh IPC `license:activateFromFile`, `license:getStatus`, `license:deactivate`. Không ghi nội dung tệp hay chữ ký vào nhật ký ứng dụng (chỉ log sự kiện `license.activated`, `license.deactivated`, `license.invalid` kèm mã lý do).
- **Song ngữ (i18n):** Toàn bộ chuỗi giao diện và thông báo lỗi vượt hạn mức đều đi qua từ điển `src/shared/i18n` (Tiếng Việt + English).
