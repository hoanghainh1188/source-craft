# Feature Specification: Nhật ký Kiểm toán & Tuân thủ cho Doanh nghiệp — truy vết truy vấn AI chống giả mạo

**Feature Branch**: `236-enterprise-audit-compliance-log`

**Created**: 2026-10-25

**Status**: Draft

**Input**: User description: "Xây dựng tính năng Nhật ký Kiểm toán & Tuân thủ cho Doanh nghiệp (`enterprise-audit-compliance-log`) cho SourceCraft (issue #236). Lấy mục 'Prompt for /speckit-specify' trong docs/intake/236-enterprise-audit-compliance-log.md làm mô tả: mỗi lượt tương tác AI ghi một bản ghi gồm timestamp, tài khoản người dùng hệ điều hành, câu hỏi gửi cho AI, mô hình đã dùng (Local / LAN AI) và danh sách trích dẫn tài liệu nội bộ đã truy xuất; hook ở hỏi đáp RAG và AI Studio tại main process; tệp kiểm toán xoay vòng, ký hoặc mã hoá để chống giả mạo, kiểm chứng được offline; chỉ bật khi `enterprise-policy.json` có `enableAuditLogging: true` và bản quyền Enterprise hợp lệ; 100% cục bộ, TDD ≥ 80%, i18n vi/en. Các điểm chưa rõ để /speckit-clarify xử lý (mục Ambiguities của intake)."

## Bối cảnh

SourceCraft đã có bản quyền Enterprise (#226), chính sách IT phân phối qua `enterprise-policy.json` và LAN AI (#228), sổ tay nhóm, tìm kiếm toàn cục (#231) và xuất báo cáo (#232). Các tổ chức chịu quản lý chặt (ngân hàng, y tế, luật) cần thêm một điều trước khi triển khai đại trà: **chứng minh được** ai đã hỏi AI điều gì, bằng mô hình nào, dựa trên những tài liệu nội bộ nào — và chứng minh rằng bằng chứng đó không bị sửa sau sự việc.

Feature này thêm **Nhật ký kiểm toán** (`AuditLog`): một tệp cục bộ, do tổ chức bật bằng chính sách, ghi lại mỗi lượt tương tác AI thành một **Bản ghi kiểm toán** (`AuditRecord`) và có cơ chế phát hiện chỉnh sửa / xoá / chèn kiểm chứng được mà không cần Internet. Nhật ký kiểm toán **khác hẳn** nhật ký chẩn đoán của app (`app-log`, 088): khác mục đích, khác chủ sở hữu (tổ chức chứ không phải người dùng), khác vòng đời.

Ba điểm bất biến của sản phẩm được giữ nguyên: nhật ký **không bao giờ rời máy** (không egress, không đính kèm vào báo lỗi hay gói chẩn đoán); trích dẫn ghi trong nhật ký là cùng trích dẫn kiểm chứng được mà người dùng thấy; tính năng chạy đầy đủ khi offline.

## Clarifications

### Session 2026-10-25

- Q: Ghi câu hỏi gửi cho AI thế nào? → A: Nguyên văn nhưng mã hoá bằng khoá công khai của tổ chức; chỉ IT/thanh tra giữ khoá bí mật giải mã được (FR-010, FR-010a, FR-010b).
- Q: Cơ chế chống giả mạo và nơi giữ khoá? → A: Chuỗi băm + chữ ký số từng bản ghi bằng khoá riêng của máy lưu trong kho khoá OS; khoá công khai của máy xuất cho IT đối chiếu. Giới hạn đã biết: quản trị viên cục bộ lấy được khoá trong kho khoá vẫn có thể ký lại (FR-019, FR-019a, FR-019b).
- Q: Khi không ghi được nhật ký? → A: Fail-closed — ghi bản ghi bắt đầu trước khi gọi mô hình; ghi không được thì chặn lượt AI và báo lỗi vi/en (FR-016, FR-016a).
- Q: Nguồn hợp lệ cho cờ `enableAuditLogging`? → A: Chỉ tệp chính sách hệ thống; tệp ở thư mục dữ liệu người dùng không bật/tắt được audit; tệp hệ thống hỏng thì không rơi xuống tệp người dùng mà báo lỗi chính sách; các khoá khác giữ cách nạp hiện có (FR-005, FR-006).
- Q: Cờ bản quyền nào mở khoá audit? → A: Tái dùng `itPolicy` đã có; không thêm cờ mới, không sửa các tệp bản quyền dùng chung (FR-001).
- Q: Vị trí lưu nhật ký kiểm toán? → A: Mặc định thư mục `audit` trong dữ liệu ứng dụng của người dùng; chính sách hệ thống có thể chỉ định thư mục khác (đã khoá quyền hoặc ổ mạng), không ghi được thì fail-closed, không rơi về mặc định (FR-020a).
- Q: Công cụ cho IT kiểm tra toàn vẹn và giải mã câu hỏi? → A: Chế độ dòng lệnh của chính ứng dụng đã cài (không mở cửa sổ, có mã thoát, báo cáo vi/en), gồm cả sinh cặp khoá tổ chức; khoá bí mật chỉ đọc lúc chạy, không lưu (FR-020b).
- Q: Tên tài liệu trong trích dẫn có ghi rõ không? → A: Ghi rõ tên nguồn, tên sổ tay, ID và vị trí; chỉ câu hỏi được mã hoá (FR-011).

## User Scenarios & Testing _(mandatory)_

### User Story 1 - IT bật ghi nhật ký kiểm toán cho toàn tổ chức (Priority: P1)

Quản trị viên IT của một ngân hàng phân phối `enterprise-policy.json` có `enableAuditLogging: true` cùng tệp bản quyền Enterprise tới máy nhân viên (qua MDM/GPO như hướng dẫn triển khai). Từ lần khởi động kế tiếp, mỗi lần nhân viên hỏi AI trong một sổ tay hoặc tạo một kết quả AI Studio, ứng dụng ghi thêm một bản ghi kiểm toán vào nhật ký cục bộ. Nhân viên không tắt được việc ghi này từ trong ứng dụng.

**Why this priority**: Đây là giá trị cốt lõi của feature — không có bản ghi thì không có gì để kiểm toán. Riêng lát cắt này đã đủ để IT trả lời câu hỏi "ai hỏi gì, bằng model nào, dựa trên tài liệu nào".

**Independent Test**: Đặt chính sách bật audit + bản quyền Enterprise, hỏi 3 câu trong RAG và chạy 1 lượt Studio; mở thư mục nhật ký kiểm toán và xác nhận có đúng 4 tương tác kiểm toán (cặp bắt đầu/kết thúc) có đủ timestamp, tài khoản OS, câu hỏi/yêu cầu đã mã hoá, mô hình (Local hoặc LAN AI kèm tên model) và danh sách trích dẫn; giải mã câu hỏi bằng khoá bí mật của tổ chức ra đúng nội dung đã hỏi.

**Acceptance Scenarios**:

1. **Given** chính sách hệ thống có `enableAuditLogging: true` và bản quyền Enterprise hợp lệ, **When** người dùng hỏi một câu trong hỏi đáp RAG và nhận câu trả lời có trích dẫn `[1]`, `[2]`, **Then** nhật ký kiểm toán có thêm đúng một tương tác kiểm toán chứa thời điểm, tài khoản OS, câu hỏi (đã mã hoá), nhà cung cấp + tên model đã sinh câu trả lời và hai trích dẫn tương ứng (nguồn, sổ tay, vị trí).
2. **Given** audit đang bật và người dùng dùng LAN AI, **When** người dùng hỏi một câu, **Then** bản ghi phân biệt được mô hình là LAN AI (khác Local) và có tên model. _(LAN AI đã được nối vào đường chat ở #244; kiểm ở mức unit bằng ánh xạ provider.)_
3. **Given** audit đang bật, **When** người dùng tạo một kết quả AI Studio, **Then** nhật ký có một tương tác kiểm toán cho lượt Studio đó với loại Studio, phạm vi nguồn, mô hình và trích dẫn của kết quả.
4. **Given** audit đang bật, **When** người dùng dùng tìm kiếm & hỏi đáp toàn cục (mọi sổ tay), **Then** bản ghi thể hiện phạm vi toàn cục và mỗi trích dẫn mang sổ tay của nó.
5. **Given** chính sách không có `enableAuditLogging` (hoặc `false`), **When** người dùng dùng AI, **Then** không có bản ghi kiểm toán nào được tạo và không có tệp kiểm toán mới.
6. **Given** audit đang bật, **When** người dùng mở Cài đặt, **Then** không có điều khiển nào cho phép tắt audit; trạng thái audit chỉ được hiển thị (chỉ đọc).

---

### User Story 2 - Thanh tra tuân thủ kiểm chứng nhật ký không bị sửa (Priority: P1)

Sau một sự cố rò rỉ thông tin, ban thanh tra thu tệp nhật ký kiểm toán từ máy một nhân viên và cần chắc chắn rằng không bản ghi nào bị sửa, xoá hay chèn thêm kể từ khi được ghi. Họ chạy công cụ kiểm tra tính toàn vẹn ngay trên máy không có Internet và nhận kết luận rõ ràng: nhật ký nguyên vẹn, hoặc chỉ ra bản ghi/tệp đầu tiên bị phá vỡ.

**Why this priority**: Một nhật ký có thể bị sửa tuỳ ý không có giá trị bằng chứng; tính chống giả mạo là yêu cầu bắt buộc trong issue và là điểm khác biệt của feature so với lịch sử chat thông thường.

**Independent Test**: Tạo nhật ký có 50 bản ghi, chạy kiểm tra ⇒ "nguyên vẹn". Sửa 1 ký tự trong bản ghi 20 ⇒ kiểm tra báo phá vỡ tại bản ghi 20. Xoá bản ghi 30 ⇒ báo thiếu bản ghi. Chèn bản ghi giả ⇒ báo không hợp lệ.

**Acceptance Scenarios**:

1. **Given** một nhật ký kiểm toán chưa bị đụng tới, **When** chạy kiểm tra tính toàn vẹn offline, **Then** kết quả "nguyên vẹn" kèm số bản ghi và khoảng thời gian bao phủ.
2. **Given** một bản ghi đã bị sửa nội dung, **When** chạy kiểm tra, **Then** kết quả "bị can thiệp" và chỉ ra bản ghi đầu tiên không hợp lệ.
3. **Given** một bản ghi ở giữa đã bị xoá hoặc thứ tự bị đảo, **When** chạy kiểm tra, **Then** kết quả "bị can thiệp" và chỉ ra vị trí thiếu/đảo.
4. **Given** một bản ghi giả được chèn bởi người không nắm khoá, **When** chạy kiểm tra, **Then** bản ghi đó bị đánh dấu không hợp lệ.
5. **Given** nhật ký đã xoay vòng sang nhiều tệp, **When** chạy kiểm tra trên toàn bộ các tệp, **Then** tính liên tục giữa các tệp cũng được kiểm chứng.

---

### User Story 3 - Khoảng trống trong nhật ký không bị vô hình (Priority: P2)

Thanh tra cần biết khi nào việc ghi bị dừng: ứng dụng khởi động với audit bật/tắt, bản quyền hết hạn giữa phiên, chính sách bị gỡ, hay ứng dụng không ghi được nhật ký. Mỗi sự kiện như vậy để lại dấu vết trong nhật ký để khoảng trống có thể giải thích được.

**Why this priority**: Không có dấu vết bắt đầu/dừng thì "không có bản ghi" không phân biệt được với "đã bị xoá"; nhưng giá trị này xếp sau việc ghi và kiểm chứng bản ghi.

**Independent Test**: Bật audit, khởi động app, hỏi 1 câu, thoát; khởi động lại với bản quyền đã hết hạn. Nhật ký có sự kiện bắt đầu, bản ghi câu hỏi, sự kiện dừng, và (khi có thể ghi) sự kiện "dừng vì bản quyền không còn hiệu lực".

**Acceptance Scenarios**:

1. **Given** audit đang có hiệu lực, **When** ứng dụng khởi động và khi ứng dụng thoát bình thường, **Then** nhật ký có sự kiện bắt đầu và sự kiện dừng tương ứng.
2. **Given** audit đang chạy, **When** bản quyền chuyển sang không hợp lệ/hết hạn giữa phiên, **Then** nhật ký ghi sự kiện dừng kèm lý do trước khi ngừng ghi.
3. **Given** lần chạy trước bị crash giữa chừng, **When** ứng dụng khởi động lại, **Then** nhật ký ghi nhận phiên trước kết thúc bất thường.

---

### User Story 4 - Người dùng biết mình đang được ghi nhật ký (Priority: P2)

Nhân viên mở ứng dụng trên máy công ty và thấy rõ rằng tương tác AI đang được ghi nhật ký kiểm toán theo chính sách tổ chức, giống như chỉ báo riêng tư cho biết dữ liệu đang chạy cục bộ hay qua LAN.

**Why this priority**: Constitution I yêu cầu chỉ báo luôn đúng thực tế; người dùng không được bị theo dõi vô hình. Feature vẫn có giá trị kiểm toán nếu thiếu lát cắt này, nên xếp P2.

**Independent Test**: Bật audit ⇒ thấy chỉ báo; tắt audit (hoặc bỏ bản quyền Enterprise) ⇒ chỉ báo biến mất. Chuyển ngôn ngữ vi/en ⇒ nhãn đổi theo.

**Acceptance Scenarios**:

1. **Given** audit đang có hiệu lực, **When** người dùng xem giao diện chính và mục Cài đặt, **Then** có chỉ báo "Đang ghi nhật ký kiểm toán theo chính sách tổ chức" (vi) / tương đương (en).
2. **Given** chính sách bật audit nhưng bản quyền không phải Enterprise hợp lệ, **When** người dùng mở Cài đặt, **Then** thấy thông báo rằng chính sách audit không có hiệu lực vì cần bản quyền Enterprise, và không có chỉ báo "đang ghi".

---

### User Story 5 - Ghi nhận việc đưa kết quả AI ra khỏi ứng dụng (Priority: P3)

Khi người dùng xuất một báo cáo AI Studio ra Word/PDF, tổ chức muốn biết dữ liệu đã rời ứng dụng lúc nào, từ sổ tay nào, dạng gì.

**Why this priority**: Không nằm trong tóm tắt issue nhưng là sự kiện tuân thủ tự nhiên; có thể giao sau mà không ảnh hưởng các story khác.

**Independent Test**: Bật audit, xuất một báo cáo Studio ra PDF ⇒ nhật ký có một bản ghi sự kiện xuất với loại tệp, sổ tay và thời điểm.

**Acceptance Scenarios**:

1. **Given** audit đang có hiệu lực, **When** người dùng xuất báo cáo Studio ra tệp, **Then** nhật ký có bản ghi sự kiện xuất với thời điểm, tài khoản OS, sổ tay, loại báo cáo và định dạng tệp.

---

### Edge Cases

- Ổ đĩa đầy, thư mục nhật ký bị xoá hoặc mất quyền ghi trong lúc đang dùng: xem FR-016.
- Câu hỏi rất dài, hoặc lượt toàn cục/Studio có rất nhiều trích dẫn: bản ghi vẫn ghi được, không làm treo lượt AI.
- Nhiều lượt AI chạy song song (stream ở nhiều sổ tay / Studio cùng lúc): các bản ghi không xen lẫn hỏng nhau và thứ tự kiểm chứng vẫn đúng.
- Người dùng dừng (stop/cancel) giữa chừng hoặc lượt AI lỗi: bản ghi vẫn được tạo kèm trạng thái kết thúc (hoàn tất / bị dừng / lỗi / không tìm thấy trong nguồn).
- Lượt "không tìm thấy trong nguồn": vẫn có bản ghi, danh sách trích dẫn có thể rỗng.
- Lượt "Trả lời bằng AI cục bộ" sau khi provider online lỗi (098): bản ghi phản ánh mô hình thực sự đã sinh câu trả lời.
- Người dùng xoá lịch sử chat hoặc khôi phục bản sao lưu vault: nhật ký kiểm toán không bị xoá, không bị thay và không bị gói vào bản sao lưu.
- Đồng hồ hệ thống bị lùi: thứ tự bản ghi vẫn kiểm chứng được, bản ghi có dấu hiệu đồng hồ bất thường được đánh dấu.
- Tệp chính sách hệ thống hỏng (không parse được): audit không âm thầm biến mất mà không để lại dấu vết.
- Người dùng tự tạo `enterprise-policy.json` trong thư mục dữ liệu người dùng để vô hiệu hoá chính sách của IT: xem FR-005.

## Requirements _(mandatory)_

### Functional Requirements

**Kích hoạt & quyền**

- **FR-001**: Hệ thống MUST chỉ ghi nhật ký kiểm toán khi đồng thời (a) chính sách tổ chức có `enableAuditLogging: true` và (b) bản quyền hiện hành hợp lệ và có quyền tính năng chính sách IT (`itPolicy` — mặc định chỉ gói Enterprise có; trong spec này "bản quyền Enterprise" nghĩa là bản quyền hợp lệ có cờ `itPolicy`). Feature này MUST NOT thêm cờ bản quyền mới. Thiếu một trong hai thì không ghi bản ghi tương tác nào.
- **FR-002**: Hệ thống MUST đánh giá điều kiện (b) tại thời điểm từng lượt AI, để bản quyền hết hạn / bị thay giữa phiên có hiệu lực ngay mà không cần khởi động lại.
- **FR-003**: Hệ thống MUST NOT cung cấp bất kỳ điều khiển nào trong ứng dụng cho người dùng cuối bật, tắt, tạm dừng, xoá hay sửa nhật ký kiểm toán.
- **FR-004**: Khi chính sách bật audit nhưng bản quyền không đủ điều kiện, hệ thống MUST hiển thị trong Cài đặt rằng chính sách audit chưa có hiệu lực vì cần bản quyền Enterprise, và MUST NOT chặn việc dùng AI chỉ vì lý do này.
- **FR-005**: Khoá `enableAuditLogging` và khoá công khai của tổ chức MUST chỉ được đọc từ tệp chính sách cấp hệ thống (vị trí chỉ quản trị viên ghi được). Tệp chính sách trong thư mục dữ liệu người dùng MUST NOT bật hay tắt được audit trong mọi trường hợp. Các khoá chính sách khác giữ nguyên cách nạp hiện có.
- **FR-006**: Nếu tệp chính sách hệ thống tồn tại nhưng không đọc/parse được, hệ thống MUST NOT rơi xuống tệp trong thư mục dữ liệu người dùng để xác định trạng thái audit; MUST ghi nhận sự việc vào nhật ký chẩn đoán và hiển thị trạng thái lỗi chính sách trong Cài đặt, để việc audit không có hiệu lực không bị vô hình.

**Nội dung bản ghi**

- **FR-007**: Mỗi lượt hỏi đáp RAG do người dùng khởi tạo (cả dạng trả lời một lần và dạng stream, phạm vi một sổ tay hoặc toàn cục) MUST tạo đúng một **tương tác kiểm toán** gồm một bản ghi _bắt đầu_ (ghi TRƯỚC khi gửi yêu cầu tới mô hình) và một bản ghi _kết thúc_ liên kết với nó, không phụ thuộc số lệnh gọi mô hình nội bộ (viết lại truy vấn, v.v.).
- **FR-008**: Mỗi lượt tạo kết quả AI Studio do người dùng khởi tạo MUST tạo đúng một tương tác kiểm toán (bắt đầu + kết thúc) như FR-007, không phụ thuộc số bước nội bộ (map/reduce).
- **FR-009**: Bản ghi _bắt đầu_ MUST chứa: thời điểm; tài khoản người dùng hệ điều hành; tên máy; loại tương tác (hỏi đáp / Studio) và phạm vi (sổ tay nào hoặc toàn cục); nội dung câu hỏi hoặc yêu cầu Studio theo FR-010; nhà cung cấp mô hình dự kiến, phân loại Local / LAN AI / Online, kèm tên model. Bản ghi _kết thúc_ MUST chứa: thời điểm; mô hình thực sự đã sinh kết quả (có thể khác dự kiến, vd. trả lời bằng AI cục bộ sau lỗi online); danh sách trích dẫn; trạng thái kết thúc (hoàn tất / bị dừng / lỗi / không tìm thấy trong nguồn). Một bản ghi _bắt đầu_ không có _kết thúc_ tương ứng (crash) MUST được kiểm tra toàn vẹn báo là "chưa kết thúc", không phải "bị can thiệp".
- **FR-010**: Câu hỏi gửi cho AI (và yêu cầu tuỳ chỉnh của Studio) MUST được ghi **nguyên văn nhưng mã hoá** bằng khoá công khai của tổ chức do IT phân phối trong chính sách; chỉ bên giữ khoá bí mật tương ứng (IT / thanh tra) giải mã được. Nhân viên, ứng dụng trên máy đó và người lấy được tệp nhật ký MUST NOT đọc được nội dung câu hỏi. Các trường còn lại của bản ghi (thời điểm, tài khoản, mô hình, trích dẫn, trạng thái) ghi rõ để IT lọc được mà không cần giải mã.
- **FR-010a**: Nếu chính sách bật audit nhưng thiếu hoặc có khoá công khai không hợp lệ, audit MUST được coi là không ghi được và áp dụng FR-016; Cài đặt MUST hiển thị lỗi cấu hình chính sách rõ nguyên nhân.
- **FR-010b**: Hệ thống MUST cung cấp cho IT/thanh tra một cách giải mã offline các câu hỏi trong nhật ký bằng khoá bí mật của tổ chức (hình thức: FR-020b); khoá bí mật MUST NOT bao giờ cần có mặt trên máy nhân viên.
- **FR-011**: Mỗi trích dẫn trong bản ghi MUST ghi rõ (không mã hoá) định danh và tên của nguồn, định danh và tên của sổ tay, và vị trí trong nguồn (trang / mốc thời gian / đoạn), khớp với trích dẫn `[n]` mà người dùng thấy trong câu trả lời — để IT lọc được "ai đã truy cập tài liệu X" mà không cần giải mã, kể cả khi nguồn đã bị xoá khỏi máy.
- **FR-012**: Câu trả lời của AI MUST NOT được ghi nguyên văn vào nhật ký kiểm toán.
- **FR-013**: Bản ghi MUST có số thứ tự tăng đơn điệu độc lập với đồng hồ hệ thống, và MUST đánh dấu bản ghi có thời điểm lùi so với bản ghi trước.
- **FR-014**: Hệ thống MUST ghi các sự kiện vòng đời: audit bắt đầu (khởi động với audit có hiệu lực), audit dừng (thoát bình thường, bản quyền mất hiệu lực) kèm lý do — đổi chính sách cần khởi động lại ứng dụng nên được phản ánh qua cặp dừng/bắt đầu của hai phiên —, và phiên trước kết thúc bất thường (phát hiện khi khởi động lại).
- **FR-015**: Khi audit có hiệu lực, việc xuất báo cáo Studio ra tệp MUST tạo một bản ghi sự kiện xuất gồm thời điểm, tài khoản OS, sổ tay, loại báo cáo và định dạng tệp (không ghi nội dung báo cáo).

**Độ tin cậy**

- **FR-016**: Khi không ghi được bản ghi kiểm toán (đĩa đầy, mất quyền, thư mục bị xoá, khoá không dùng được), hệ thống MUST **chặn lượt AI (fail-closed)**: không gửi yêu cầu tới mô hình khi bản ghi _bắt đầu_ chưa ghi thành công, hiển thị lỗi vi/en nêu rõ nguyên nhân và hướng xử lý (liên hệ IT, giải phóng đĩa…), và ghi chi tiết kỹ thuật (không có nội dung câu hỏi) vào nhật ký chẩn đoán. Nếu bản ghi _kết thúc_ không ghi được sau khi mô hình đã trả lời, câu trả lời vẫn hiển thị nhưng các lượt AI tiếp theo bị chặn cho tới khi ghi lại được.
- **FR-016a**: Khi ghi lại được sau một thời gian bị chặn, hệ thống MUST ghi một sự kiện "khôi phục ghi nhật ký" kèm thời điểm bắt đầu sự cố, để khoảng thời gian bị chặn hiển hiện trong nhật ký.
- **FR-017**: Ghi nhật ký MUST NOT làm hỏng hoặc xen lẫn bản ghi khi nhiều lượt AI chạy song song.
- **FR-018**: Nhật ký kiểm toán MUST được xoay vòng sang tệp mới khi đạt ngưỡng kích thước; ứng dụng MUST NOT tự xoá các tệp đã xoay vòng (việc lưu trữ dài hạn và dọn dẹp là trách nhiệm của IT).

**Chống giả mạo & kiểm chứng**

- **FR-019**: Nhật ký MUST cho phép phát hiện việc sửa nội dung, xoá, chèn hoặc đổi thứ tự bản ghi, kể cả qua ranh giới giữa các tệp đã xoay vòng, bằng **chuỗi băm** (mỗi bản ghi mang dấu băm của bản ghi trước, nối liên tục qua các tệp xoay vòng) kết hợp **chữ ký số của từng bản ghi** bằng khoá ký riêng của máy. Khoá ký được sinh trên máy ở lần đầu audit có hiệu lực và lưu trong kho khoá bảo mật của hệ điều hành (không plaintext trên đĩa).
- **FR-019a**: Khoá công khai tương ứng của máy MUST được ghi vào nhật ký (bản ghi khởi tạo) và xuất được cho IT; công cụ kiểm tra MUST cho phép IT đối chiếu với khoá công khai đã đăng ký trước cho máy đó, để phát hiện trường hợp toàn bộ nhật ký bị tạo lại bằng khoá khác.
- **FR-019b**: Nếu khoá ký của máy bị mất hoặc thay đổi (vd. hồ sơ người dùng bị khôi phục), hệ thống MUST sinh khoá mới và ghi một sự kiện "đổi khoá ký" liên kết với chuỗi hiện có, không âm thầm bắt đầu chuỗi mới.
- **FR-020**: Hệ thống MUST cung cấp cho IT/thanh tra một cách kiểm tra tính toàn vẹn chạy hoàn toàn offline (hình thức: FR-020b), cho kết quả "nguyên vẹn" (kèm số bản ghi, khoảng thời gian) hoặc "bị can thiệp" (kèm tệp và bản ghi đầu tiên không hợp lệ).
- **FR-020b**: Các công cụ cho IT (kiểm tra toàn vẹn FR-020, giải mã câu hỏi FR-010b, sinh cặp khoá của tổ chức) MUST được cung cấp dưới dạng chế độ dòng lệnh của chính ứng dụng đã cài: chạy không mở cửa sổ, không cần cài thêm phần mềm, trả mã thoát phân biệt "nguyên vẹn" / "bị can thiệp" / "lỗi sử dụng", báo cáo bằng Tiếng Việt hoặc English. Khoá bí mật của tổ chức chỉ được đọc từ tệp do IT chỉ định khi chạy lệnh và MUST NOT được lưu lại ở bất kỳ đâu. Chế độ dòng lệnh MUST NOT có lệnh nào sửa, xoá hay ghi vào nhật ký.

**Vị trí & tách biệt**

- **FR-020a**: Nhật ký kiểm toán MUST mặc định nằm trong thư mục `audit` riêng thuộc dữ liệu ứng dụng của người dùng. Tệp chính sách hệ thống MAY chỉ định một thư mục khác (cục bộ đã khoá quyền, hoặc ổ mạng); khi có, hệ thống MUST ghi vào đúng thư mục đó và MUST NOT tự rơi về thư mục mặc định nếu thư mục chỉ định không ghi được (áp dụng FR-016). Đường dẫn chỉ định chỉ được đọc từ tệp chính sách hệ thống (FR-005).
- **FR-021**: Nhật ký kiểm toán MUST nằm ngoài vault dữ liệu người dùng và ngoài thư mục nhật ký chẩn đoán; MUST NOT bị xoá bởi "Xoá lịch sử chat", MUST NOT bị thay hay bị gói vào khi sao lưu / khôi phục vault.
- **FR-022**: Nhật ký kiểm toán MUST NOT bao giờ được gửi ra khỏi máy, đính kèm vào báo cáo lỗi, gói chẩn đoán hay bất kỳ kênh mạng nào.

**Minh bạch với người dùng**

- **FR-023**: Khi audit có hiệu lực, giao diện MUST hiển thị chỉ báo luôn thấy được rằng tương tác AI đang được ghi nhật ký kiểm toán theo chính sách tổ chức; Cài đặt MUST hiển thị trạng thái audit (có hiệu lực / chưa có hiệu lực và lý do / lỗi chính sách). Vị trí nhật ký chỉ được hiển thị dạng nhãn ("Mặc định" / "Do bộ phận IT chỉ định"), không hiển thị đường dẫn (theo quy ước renderer không nhận đường dẫn tệp — 085).
- **FR-024**: Mọi chuỗi giao diện và thông báo lỗi mới MUST có bản Tiếng Việt và English.
- **FR-025**: Tài liệu hướng dẫn triển khai doanh nghiệp MUST mô tả khoá `enableAuditLogging`, vị trí nhật ký, cách thu thập và cách kiểm tra tính toàn vẹn.

### Key Entities

- **Nhật ký kiểm toán (AuditLog)**: tập các tệp cục bộ (tệp hiện hành + các tệp đã xoay vòng) chứa chuỗi bản ghi kiểm toán liên tục của một máy; thuộc về tổ chức, độc lập với vault và với nhật ký chẩn đoán.
- **Bản ghi kiểm toán (AuditRecord)**: một mục trong nhật ký — số thứ tự, thời điểm, tài khoản OS, tên máy, loại (tương tác hỏi đáp / Studio / sự kiện xuất / sự kiện vòng đời), phạm vi, câu hỏi (theo FR-010), mô hình (nhóm Local/LAN AI/Online + tên model), danh sách trích dẫn, trạng thái kết thúc, và dữ liệu chống giả mạo liên kết với bản ghi trước.
- **Trích dẫn được ghi (AuditCitation)**: định danh + tên nguồn, định danh + tên sổ tay và vị trí trong nguồn, ghi rõ không mã hoá — cùng thông tin với `Citation` người dùng thấy.
- **Tương tác kiểm toán**: cặp bản ghi _bắt đầu_ / _kết thúc_ của một lượt AI do người dùng khởi tạo, liên kết bằng một định danh chung.
- **Khoá ký của máy**: cặp khoá riêng của từng máy dùng để ký bản ghi; khoá bí mật nằm trong kho khoá của hệ điều hành, khoá công khai được ghi vào nhật ký và xuất cho IT.
- **Chính sách tổ chức (EnterprisePolicy)**: thêm khoá `enableAuditLogging` (tuỳ chọn, mặc định tắt) , khoá công khai của tổ chức dùng để mã hoá câu hỏi, và thư mục nhật ký tuỳ chọn; các khoá này chỉ có hiệu lực từ tệp hệ thống.
- **Kết quả kiểm tra toàn vẹn**: nguyên vẹn / bị can thiệp, số bản ghi, khoảng thời gian, vị trí phá vỡ đầu tiên.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Khi audit có hiệu lực, 100% lượt hỏi đáp và lượt Studio do người dùng khởi tạo có đúng một tương tác kiểm toán (cặp bắt đầu/kết thúc) tương ứng, và 0 yêu cầu nào tới mô hình được gửi đi khi bản ghi bắt đầu chưa ghi được (đo trên bộ kịch bản kiểm thử gồm hỏi đáp một sổ tay, toàn cục, stream, dừng giữa chừng, lỗi, không tìm thấy, Studio).
- **SC-002**: Khi audit không có hiệu lực (thiếu chính sách hoặc thiếu bản quyền Enterprise), 0 bản ghi tương tác được tạo.
- **SC-003**: Kiểm tra toàn vẹn phát hiện 100% các trường hợp sửa một ký tự, xoá một bản ghi, chèn một bản ghi giả và đổi thứ tự hai bản ghi trong bộ kiểm thử can thiệp.
- **SC-004**: Kiểm tra toàn vẹn một nhật ký 10.000 bản ghi hoàn tất trong dưới 10 giây trên máy tham chiếu (4 nhân CPU, SSD — tương đương runner CI của dự án), không cần mạng.
- **SC-005**: Việc ghi nhật ký làm chậm thời điểm người dùng thấy những chữ đầu tiên của câu trả lời không quá 50 ms so với khi tắt audit.
- **SC-006**: 0 byte nhật ký kiểm toán rời khỏi máy trong mọi luồng (kiểm chứng bằng kiểm thử không có egress và rà soát báo lỗi/gói chẩn đoán).
- **SC-007**: Một thanh tra viên làm theo tài liệu triển khai có thể thu thập và kiểm tra nhật ký của một máy trong dưới 10 phút.
- **SC-008**: Người dùng trên máy có audit bật nhận ra được trạng thái "đang ghi nhật ký kiểm toán" ngay trên giao diện chính mà không cần mở Cài đặt.

## Assumptions

- Nguồn yêu cầu chính là tóm tắt issue #236; không có basic design / Figma riêng. Mọi quyết định dưới đây là mặc định hợp lý và có thể bị `/speckit-clarify` thay đổi (24 điểm mở ở mục Ambiguities của intake).
- Tài khoản OS là tên đăng nhập của người dùng đang chạy ứng dụng như hệ điều hành báo; trên Windows có kèm miền nếu máy thuộc miền. Tên máy được ghi kèm để IT phân biệt máy.
- Provider online (nếu chính sách cho phép) vẫn được ghi với nhóm "Online", vì đó là đường dữ liệu rời máy cần kiểm toán nhất. Với LAN AI, bản ghi ghi nhóm "LAN AI" + tên model, không bắt buộc ghi địa chỉ máy chủ.
- "Danh sách trích dẫn đã truy xuất" được hiểu là các trích dẫn hợp lệ xuất hiện trong kết quả trả về người dùng (cùng danh sách người dùng có thể bấm), không phải mọi đoạn ứng viên trong bước truy xuất.
- Với Studio, "yêu cầu" là loại Studio + phạm vi nguồn, cộng yêu cầu tuỳ chỉnh khi loại là `custom`.
- Các thao tác không gọi AI (tìm kiếm toàn văn, xem nguồn, nạp nguồn, ghi cuộc họp, sao chép vào clipboard) nằm ngoài phạm vi v1 của audit, trừ sự kiện xuất báo cáo (FR-015).
- Bản quyền mở khoá audit qua cờ `itPolicy` sẵn có (đã chốt ở clarify) ⇒ feature không sửa các tệp bản quyền dùng chung mà nhánh #238 đang sửa.
- Ngưỡng xoay vòng mặc định theo kích thước (cỡ vài MB mỗi tệp), là hằng số ở v1; không có cấu hình lưu giữ trong chính sách ở v1.
- Chính sách vẫn được nạp một lần lúc khởi động như hiện tại; đổi tệp chính sách cần khởi động lại ứng dụng. Riêng điều kiện bản quyền được đánh giá theo từng lượt (FR-002).
- Công cụ cho IT là chế độ dòng lệnh của ứng dụng đã cài (FR-020b); không có màn hình công cụ kiểm toán trong ứng dụng ở v1.
- Feature cần đề xuất sửa Constitution (làm rõ ngoại lệ có kiểm soát ở Principle III cho nhật ký kiểm toán, và yêu cầu chỉ báo ở Principle I); việc sửa phải qua PR riêng được steward duyệt, không nằm trong branch này.
- Phụ thuộc: bản quyền Enterprise & `FeatureGate` (#226), `enterprise-policy.json` & LAN AI (#228), tìm kiếm toàn cục (#231), xuất báo cáo (#232).
