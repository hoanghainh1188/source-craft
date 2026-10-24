# Feature Specification: Enterprise License & Feature Tiering

**Feature Branch**: `226-enterprise-license`

**Created**: 2026-10-24

**Status**: Approved

**Input**: User description: "Xây dựng hệ thống Quản lý Bản quyền Offline và Phân tầng Tính năng (`enterprise-license`) cho ứng dụng SourceCraft nhằm hỗ trợ 3 tầng bản quyền thương mại: Community (`free`), Pro (`pro`), và Enterprise (`enterprise`), vận hành 100% cục bộ (offline) không cần kết nối mạng."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Xác thực & Kích hoạt Bản quyền Offline bằng tệp `.sclicense` (Priority: P1)

Là một Quản trị viên IT của tổ chức hoặc người dùng chuyên nghiệp đã mua bản quyền (Pro / Enterprise), tôi muốn kích hoạt ứng dụng SourceCraft bằng một tệp bản quyền `.sclicense` ngay trên máy tính mà không cần kết nối Internet, để mở khóa toàn bộ tính năng và xác nhận quyền sở hữu hợp pháp của tổ chức trong môi trường mạng nội bộ cách ly (air-gapped).

**Why this priority**: Đây là nền tảng cốt lõi để xác định trạng thái bản quyền (`LicenseStatus`) và quyền lợi (`Entitlements`) của người dùng; mọi cổng kiểm soát tính năng và hiển thị giao diện đều phụ thuộc vào luồng này.

**Independent Test**: Có thể kiểm thử độc lập bằng cách dùng công cụ phát hành tạo ra một tệp `.sclicense` hợp lệ (và các tệp giả mạo / hết hạn / sai chữ ký), nạp vào dịch vụ bản quyền và kiểm tra trạng thái trả về mà không cần chạy toàn bộ pipeline hỏi đáp RAG.

**Acceptance Scenarios**:

1. **Given** ứng dụng mới cài đặt chưa có tệp bản quyền, **When** người dùng mở ứng dụng và xem trạng thái bản quyền, **Then** trạng thái bản quyền là `free` (Community) với hạn mức mặc định (tối đa 3 notebooks, 10 nguồn/notebook, 15 phút ghi âm cuộc họp, 2 mẫu Studio cơ bản).
2. **Given** người dùng có tệp `.sclicense` hợp lệ (chữ ký số hợp lệ, chưa hết hạn) thuộc tầng `enterprise` cấp cho `"Công ty Luật TNHH ABC"` với `50` máy, **When** người dùng chọn kích hoạt tệp bản quyền trong màn Cài đặt, **Then** ứng dụng xác thực thành công ngay lập tức (không phát sinh kết nối mạng), lưu bền bản quyền, chuyển tầng hiệu lực sang `enterprise`, mở khóa toàn bộ hạn mức và hiển thị tên tổ chức `"Công ty Luật TNHH ABC"` trên Header cùng màn Cài đặt.
3. **Given** người dùng chọn một tệp `.sclicense` đã bị chỉnh sửa nội dung (`orgName`, `tier`, hoặc `expiresAt` bị sửa đổi so với chữ ký gốc), **When** hệ thống kiểm tra tệp, **Then** hệ thống từ chối kích hoạt với mã lỗi bản quyền không hợp lệ (`invalid`) và giữ nguyên trạng thái trước đó.
4. **Given** ứng dụng đang có tệp `.sclicense` hợp lệ nhưng thời điểm hiện tại đã vượt quá `expiresAt`, **When** người dùng mở ứng dụng, **Then** trạng thái bản quyền hiển thị là `expired` (Đã hết hạn), tầng hiệu lực thực tế quay về mức `free`, nhưng toàn bộ dữ liệu đã tạo trước đó vẫn được giữ nguyên để đọc và tra cứu.
5. **Given** người dùng đang kích hoạt bản quyền `pro` hoặc `enterprise`, **When** người dùng chọn "Gỡ bản quyền" và xác nhận, **Then** tệp bản quyền được xóa khỏi thư mục dữ liệu và ứng dụng quay về tầng `free`.

---

### User Story 2 - Thực thi Giới hạn Gói Community (`free`) và Mở khóa ở Gói Trả phí (Priority: P1)

Là Chủ sản phẩm SourceCraft, tôi muốn ứng dụng thực thi nghiêm ngặt nhưng thân thiện các giới hạn dùng thử ở gói Community (`free`) tại tiến trình chính (main process), đồng thời bảo toàn quyền truy cập dữ liệu cũ của người dùng, để người dùng cá nhân có thể trải nghiệm giá trị cốt lõi trước khi nâng cấp lên bản Pro hoặc Enterprise.

**Why this priority**: Đảm bảo mô hình thương mại hóa (Freemium + B2B) hoạt động thực tế, không thể bị vượt qua từ phía giao diện, đồng thời không làm mất dữ liệu hiện có của người dùng.

**Independent Test**: Có thể kiểm thử độc lập từng điểm chặn (Tạo notebook thứ 4, thêm nguồn thứ 11, thêm nguồn âm thanh/hình ảnh, gọi Studio FAQ/Custom, ghi âm quá 15 phút) ở chế độ `free` và xác nhận tất cả đều được mở khóa ngay khi chuyển sang `pro` hoặc `enterprise`.

**Acceptance Scenarios**:

1. **Given** ứng dụng đang ở tầng hiệu lực `free` và người dùng đã có 3 notebooks, **When** người dùng yêu cầu tạo notebook thứ 4, **Then** hệ thống từ chối thao tác kèm thông báo rõ ràng về giới hạn 3 notebooks của gói Community, nhưng vẫn cho phép mở, đổi tên, hỏi đáp hoặc xóa 3 notebooks hiện có.
2. **Given** ứng dụng đang ở tầng hiệu lực `free` và một notebook đã có 10 nguồn, **When** người dùng thêm nguồn thứ 11 vào notebook đó, **Then** hệ thống từ chối thao tác kèm thông báo giới hạn 10 nguồn/notebook của gói Community.
3. **Given** ứng dụng đang ở tầng hiệu lực `free`, **When** người dùng thêm nguồn thuộc định dạng nâng cao (`audio`, `video`, `image`), **Then** hệ thống từ chối thao tác kèm thông báo tính năng bóc băng âm thanh/video và OCR hình ảnh yêu cầu gói Pro hoặc Enterprise.
4. **Given** ứng dụng đang ở tầng hiệu lực `free`, **When** người dùng tạo bản tổng hợp Studio thuộc loại `summary` hoặc `keyPoints`, **Then** hệ thống thực hiện bình thường; **When** người dùng chọn các loại nâng cao (`faq`, `outline`, `studyGuide`, `briefing`, `timeline`, `keyTerms`, `custom`), **Then** hệ thống từ chối kèm thông báo yêu cầu nâng cấp bản quyền.
5. **Given** ứng dụng đang ở tầng hiệu lực `free` và người dùng bắt đầu phiên ghi âm cuộc họp trực tiếp, **When** thời lượng audio ghi được chạm mốc 15 phút (900 giây), **Then** hệ thống tự động kết thúc phiên ghi một cách an toàn và chuyển sang bước chốt transcript + lập chỉ mục để không làm mất 15 phút âm thanh đã thu.

---

### User Story 3 - Công cụ Phát hành Bản quyền Dòng lệnh cho Nhà cung cấp (Priority: P2)

Là Nhà cung cấp giải pháp (Harry), tôi muốn có một công cụ dòng lệnh (CLI) để sinh cặp khóa mật mã và ký phát hành tệp `.sclicense` cho từng khách hàng cá nhân hoặc doanh nghiệp với các tham số tùy chỉnh (tên tổ chức, tầng gói, số lượng máy, ngày hết hạn, cờ tính năng), để có thể bàn giao bản quyền nhanh chóng khi ký hợp đồng.

**Why this priority**: Cần thiết để tạo ra tệp `.sclicense` hợp lệ phục vụ bán hàng và kiểm thử tự động.

**Independent Test**: Chạy lệnh CLI sinh khóa và ký tệp `.sclicense`, sau đó đưa tệp vừa sinh vào bộ xác thực của ứng dụng và kiểm tra khớp hoàn toàn mọi trường thông tin.

**Acceptance Scenarios**:

1. **Given** nhà cung cấp chạy công cụ phát hành với tham số `--tier enterprise --org "Tập đoàn XYZ" --seats 100 --expires "2027-12-31T23:59:59Z"`, **When** lệnh hoàn tất, **Then** một tệp `.sclicense` được tạo ra chứa đúng thông tin đã nhập kèm chữ ký số hợp lệ.
2. **Given** nhà cung cấp phát hành bản quyền vĩnh viễn (không truyền ngày hết hạn hoặc truyền `permanent`), **When** tệp `.sclicense` được nạp vào ứng dụng, **Then** ứng dụng hiển thị thời hạn là "Vĩnh viễn" (`expiresAt: null`) và không bao giờ hết hạn.

---

### Edge Cases

- **Hạ cấp khi đã có nhiều dữ liệu (Downgrade / Expired with existing data)**: Người dùng đã tạo 10 notebooks và 50 nguồn khi còn hạn Enterprise (hoặc từ phiên bản miễn phí trước đây). Khi bản quyền hết hạn về `free`, không một notebook hay nguồn nào bị xóa hoặc khóa đọc; người dùng vẫn hỏi đáp RAG, tìm kiếm toàn văn, xem nguồn và dùng Studio (`summary`, `keyPoints`) trên toàn bộ 50 nguồn đó.
- **Lùi đồng hồ hệ thống (System clock rollback)**: Nếu người dùng cố tình chỉnh lùi đồng hồ máy tính về quá khứ hơn 24 giờ so với thời điểm gần nhất ứng dụng từng ghi nhận (`lastSeenTimestamp`) để kéo dài một bản quyền có thời hạn (`expiresAt !== null`), hệ thống phát hiện trạng thái `clockRollback`, đưa tầng hiệu lực về `free` và hiển thị cảnh báo đồng hồ hệ thống không hợp lệ. (Cho phép dung sai 24 giờ để không ảnh hưởng người dùng di chuyển qua các múi giờ).
- **Tệp `.sclicense` hỏng, quá lớn hoặc không phải JSON**: Nếu người dùng chọn nhầm tệp PDF/ảnh hoặc tệp lớn hơn 16 KB, hệ thống từ chối ngay lập tức trước khi phân tích cú pháp, trả về mã lỗi `invalid` mà không làm sập ứng dụng và không ghi đè bản quyền hợp lệ đang có.
- **Đổi ngôn ngữ giao diện (Việt ↔ Anh)**: Khi người dùng chuyển đổi ngôn ngữ trong Cài đặt, toàn bộ nhãn trạng thái bản quyền, hạn mức gói và thông báo lỗi chặn hạn mức đều chuyển đổi tức thì sang ngôn ngữ tương ứng.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Hệ thống MUST hỗ trợ 3 tầng bản quyền (`LicenseTier`): `free` (Community — mặc định), `pro` (Cá nhân chuyên nghiệp), và `enterprise` (Doanh nghiệp/Tổ chức), hoạt động hoàn toàn cục bộ không phát sinh kết nối mạng.
- **FR-002**: Hệ thống MUST xác thực tệp bản quyền `.sclicense` bằng chữ ký số bất đối xứng Ed25519 trên dữ liệu `payload` đã chuẩn hóa thứ tự khóa, từ chối mọi tệp có kích thước > 16 KB, sai định dạng, thiếu trường bắt buộc, hoặc chữ ký không khớp khóa công khai của ứng dụng.
- **FR-003**: Hệ thống MUST kiểm tra thời hạn `expiresAt` của bản quyền và duy trì mốc thời gian lớn nhất từng ghi nhận (`lastSeenTimestamp`); nếu bản quyền có `expiresAt !== null` và đồng hồ hệ thống lùi quá 24 giờ so với `lastSeenTimestamp`, hệ thống MUST chuyển trạng thái bản quyền sang `clockRollback` và áp dụng hạn mức tầng `free`.
- **FR-004**: Khi tầng hiệu lực (`effectiveTier`) là `free`, hệ thống MUST chặn thao tác tạo notebook mới nếu số lượng notebook hiện có `>= 3` với mã lỗi `licenseLimitNotebooks`.
- **FR-005**: Khi tầng hiệu lực là `free`, hệ thống MUST chặn thao tác thêm nguồn mới vào một notebook nếu số lượng nguồn hiện có của notebook đó `>= 10` (`licenseLimitSources`) hoặc nếu loại nguồn thuộc `audio`, `video`, `image` (`licenseRequireProFormat`).
- **FR-006**: Khi tầng hiệu lực là `free`, hệ thống MUST chỉ cho phép tạo tổng hợp Studio với 2 loại `summary` và `keyPoints`, đồng thời chặn các loại `faq`, `outline`, `studyGuide`, `briefing`, `timeline`, `keyTerms`, `custom` với mã lỗi `licenseRequireProStudio`.
- **FR-007**: Khi tầng hiệu lực là `free`, hệ thống MUST giới hạn thời lượng ghi âm của mỗi phiên Ghi cuộc họp (`meeting-capture`) ở mức tối đa 15 phút (900 giây); khi chạm mốc 900 giây, phiên ghi MUST tự động dừng an toàn và hoàn tất nguồn như khi người dùng kết thúc.
- **FR-008**: Hệ thống MUST bảo toàn đầy đủ quyền đọc, tìm kiếm, xem trích dẫn, hỏi đáp RAG, xuất sao lưu và xóa đối với mọi notebook và nguồn đã tồn tại trên máy, bất kể số lượng hiện có vượt quá hạn mức của tầng `free`.
- **FR-009**: Màn hình Cài đặt (`/settings`) MUST có khu vực "Bản quyền & Gói dịch vụ" hiển thị tầng bản quyền hiện tại, thông tin cấp phép (`orgName`, `licenseId`, `seats`, `expiresAt` hoặc hạn mức dùng thử) và cung cấp nút kích hoạt tệp `.sclicense` (qua hộp thoại chọn tệp ở main process) cùng nút gỡ bản quyền.
- **FR-010**: Khi bản quyền tầng `enterprise` đang hoạt động hợp lệ, thanh Header của ứng dụng MUST hiển thị huy hiệu nhận diện tổ chức (`Enterprise · <orgName>`).
- **FR-011**: Dự án MUST cung cấp công cụ dòng lệnh (`scripts/issue-license.mjs`) cho phép sinh cặp khóa Ed25519 và ký xuất tệp `.sclicense` hợp lệ từ các tham số dòng lệnh.
- **FR-012**: Hệ thống MUST KHÔNG ghi nội dung nhạy cảm của tệp bản quyền hay chữ ký vào nhật ký ứng dụng (chỉ ghi tên sự kiện và mã trạng thái), và toàn bộ thông báo giao diện MUST hỗ trợ song ngữ Tiếng Việt / English.

### Key Entities

- **`LicensePayload`**: Thông tin định danh bản quyền được ký số, bao gồm: `licenseId` (mã bản quyền), `tier` (`pro` | `enterprise`), `orgName` (tên cá nhân/tổ chức được cấp phép), `seats` (số lượng máy được cấp phép), `issuedAt` (ngày cấp ISO 8601), `expiresAt` (ngày hết hạn ISO 8601 hoặc `null` nếu vĩnh viễn), và `features` (danh sách cờ tính năng mở rộng).
- **`LicenseFile`**: Cấu trúc tệp `.sclicense` lưu trên đĩa gồm `payload` (`LicensePayload`) và `signature` (chữ ký số Base64Url).
- **`LicenseStatus`**: Trạng thái bản quyền tổng hợp trả về cho giao diện, gồm: `state` (`free` | `active` | `expired` | `invalid` | `clockRollback`), `effectiveTier` (`free` | `pro` | `enterprise`), thông tin bản quyền đính kèm (nếu có), và bảng quyền lợi hiện hành (`Entitlements`).
- **`Entitlements`**: Tập hợp các giới hạn và quyền được phép theo `effectiveTier`: `maxNotebooks` (`3` hoặc `null`), `maxSourcesPerNotebook` (`10` hoặc `null`), `maxMeetingDurationSec` (`900` hoặc `null`), `allowedSourceKinds`, `allowedStudioKinds`, và `enterpriseFeatures` (`lanAi`, `sharedNotebooks`, `itPolicy`).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Quá trình kích hoạt tệp `.sclicense` và kiểm tra trạng thái bản quyền khi khởi động ứng dụng hoàn tất trong dưới **50 ms** với **0 yêu cầu mạng** (100% offline).
- **SC-002**: **100%** các tệp `.sclicense` bị chỉnh sửa bất kỳ ký tự nào trong `payload` hoặc `signature` đều bị từ chối chính xác trong bộ kiểm thử tự động.
- **SC-003**: **100%** các thao tác vượt hạn mức ở gói `free` (notebook thứ 4, nguồn thứ 11, định dạng âm thanh/video/ảnh, mẫu Studio nâng cao, ghi âm quá 900 giây) đều bị chặn tại main process với thông báo lỗi đúng ngôn ngữ đang chọn (Tiếng Việt / English).
- **SC-004**: Độ phủ kiểm thử tự động (unit test coverage) của toàn bộ mô-đun bản quyền và kiểm tra hạn mức đạt tối thiểu **80%** (tuân thủ Constitution IV).

## Assumptions

- Khóa bí mật Ed25519 dùng để phát hành bản quyền thương mại sẽ được nhà phát triển lưu giữ riêng ngoài kho mã nguồn (truyền qua biến môi trường hoặc tệp trong `.keys/` đã được `.gitignore`); kho mã nguồn chỉ nhúng khóa công khai mặc định và hỗ trợ nạp khóa công khai thử nghiệm trong môi trường unit test.
- Việc kiểm soát số lượng máy (`seats`) trong môi trường mạng hoàn toàn cách ly (offline) ở Pha 1 mang tính cam kết hợp đồng và hiển thị minh bạch trên giao diện tổ chức (`"50 seats"`); việc đếm số máy hoạt động đồng thời qua mạng LAN sẽ được kết hợp với LAN AI Server ở Pha 2.
