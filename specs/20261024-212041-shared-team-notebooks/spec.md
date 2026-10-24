# Feature Specification: Shared Team Notebooks (`shared-team-notebooks`)

**Branch**: `229-shared-team-notebooks` | **Date**: 2026-10-24 | **Issue**: #229  
**Status**: Ready for Planning | **Input**: [basic-design.md](../../docs/01-basic-design/shared-team-notebooks/basic-design.md), [intake/229-shared-team-notebooks.md](../../docs/intake/229-shared-team-notebooks.md)

---

## 1. User Stories & Acceptance Criteria

### User Story 1 (P1): Xuất bản Gói Sổ tay Tri thức (`.scnb`) cho Người dùng Pro / Enterprise
Là một chuyên gia quản lý tri thức hoặc trưởng nhóm (sở hữu bản quyền Pro hoặc Enterprise), tôi muốn xuất một notebook hoàn chỉnh (kèm nguồn tài liệu, các đoạn trích và vector nhúng sẵn) thành một tệp `.scnb` duy nhất để tôi có thể gửi cho đồng nghiệp hoặc đưa lên ổ đĩa mạng dùng chung.

- **AC 1.1**: Trong menu tùy chọn của Notebook, người dùng có nút **"Xuất gói sổ tay (.scnb)…"**.
- **AC 1.2**: Nếu người dùng đang ở gói Free (Community), hệ thống chặn lại và hiển thị thông báo yêu cầu bản quyền Pro (`licenseRequireProSharedNotebooks`).
- **AC 1.3**: Khi người dùng Pro/Enterprise bấm xuất, Main process mở hộp thoại lưu tệp native (`dialog.showSaveDialog`), lưu tệp nén `.scnb` chứa đầy đủ `manifest.json`, `sources.json`, `chunks.json` và dữ liệu vector.
- **AC 1.4**: Toàn bộ quá trình xuất diễn ra ngoại tuyến, không gửi bất kỳ dữ liệu nào ra mạng Internet.

### User Story 2 (P1): Nhập Gói Sổ tay Tri thức vào Máy Cục bộ (Import Independent Copy)
Là một thành viên trong nhóm sở hữu bản quyền Pro/Enterprise, tôi muốn nhập tệp `.scnb` do trưởng nhóm gửi để tôi có ngay một notebook độc lập trên máy mình để tra cứu và hỏi đáp RAG tức thì mà không cần nạp tệp hay chờ nhúng vector lại.

- **AC 2.1**: Trong danh sách Notebook, có nút **"Nhập từ gói (.scnb)…"**.
- **AC 2.2**: Người dùng chọn tệp `.scnb` qua hộp thoại chọn tệp native ở Main process.
- **AC 2.3**: Hệ thống giải nén, kiểm tra tính toàn vẹn của tệp và tạo notebook mới trong cơ sở dữ liệu SQLite & LanceDB cục bộ.
- **AC 2.4**: Người dùng có thể hỏi đáp RAG ngay lập tức với các trích dẫn chính xác từ gói tài liệu.

### User Story 3 (P2): Gắn kết Sổ tay Tri thức Dùng chung Chỉ đọc (Mount Read-Only / Shared Vault)
Là một nhân viên trong tổ chức, tôi muốn gắn kết trực tiếp một thư mục/gói tri thức dùng chung từ ổ mạng nội bộ (NAS / SMB) của công ty ở chế độ chỉ đọc để tôi luôn truy cập được tài liệu mới nhất mà không làm sai lệch hay xóa nhầm dữ liệu gốc của tổ chức.

- **AC 3.1**: Cho phép gắn kết notebook ở chế độ `isMounted: true` / `readOnly: true`.
- **AC 3.2**: Notebook hiển thị huy hiệu 🔒 **"Dùng chung (Chỉ đọc)"** trên giao diện Workspace.
- **AC 3.3**: Người dùng có toàn quyền tìm kiếm, hỏi đáp RAG, tạo câu hỏi trong Chat và chạy AI Studio. Các nút Thêm nguồn, Xóa nguồn, Đổi tên notebook bị vô hiệu hóa an toàn ở cả giao diện và ranh giới Main process IPC.

---

## 2. Functional Requirements (FR)

- **FR-001**: Cập nhật `feature-gate.ts` để `sharedNotebooks` nằm trong `DEFAULT_PRO_FEATURES`.
- **FR-002**: Xây dựng module `PackageExporter` ở Main process đóng gói notebook thành tệp `.scnb` (định dạng TAR/ZIP hoặc JSON container có checksum SHA-256).
- **FR-003**: Xây dựng module `PackageImporter` giải nén tệp `.scnb`, phục hồi metadata nguồn và ghi các bản ghi vector vào LanceDB.
- **FR-004**: Hỗ trợ cờ `readOnly` trên Notebook schema để khóa các thao tác ghi (thêm/sửa/xóa nguồn) tại Main process.
- **FR-005**: Thêm các kênh IPC: `notebook:exportPackage`, `notebook:importPackage`, `notebook:mountPackage`.
- **FR-006**: Bổ sung mã lỗi `licenseRequireProSharedNotebooks` và `packageCorrupted`.

---

## 3. Success Criteria (SC)

- **SC-001**: Người dùng Free bị chặn khi cố gắng xuất hoặc nhập gói `.scnb`, kèm thông báo rõ ràng về quyền lợi Pro.
- **SC-002**: Người dùng Pro/Enterprise xuất và nhập thành công gói `.scnb` trên 100% các tệp hợp lệ.
- **SC-003**: Sau khi nhập, tính năng hỏi đáp RAG hoạt động ngay lập tức với đầy đủ trích dẫn (không cần tính toán lại embedding).
- **SC-004**: Độ bao phủ unit test cho các module đóng gói, giải nén và kiểm tra quyền đạt $\ge 80\%$.
