# Tasks: document-diff-redline

Quy ước: `[P]` = làm song song được (khác file, không phụ thuộc task chưa xong). Mỗi cặp test → cài đặt theo TDD: viết test,
chạy thấy FAIL, rồi mới cài.

## Phase 0 — Quy trình

- [x] T001 Chuyển `docs/01-basic-design/document-diff/basic-design.md` → `docs/intake/233-document-diff-design.md`, sửa sơ đồ
      theo D1/D8.

## Phase 1 — Nền dữ liệu

- [x] T002 Test migration v13 trong `tests/unit/migration-studio-diff.test.ts` (giữ đủ cột, INSERT `documentDiff`, CHECK khớp
      `STUDIO_ALL_KINDS`).
- [x] T003 Thêm `documentDiff` vào `StudioKind` (`src/shared/ipc/types.ts`) và `STUDIO_KINDS`, `STUDIO_ALL_KINDS`
      (`src/main/services/studio/constants.ts`).
- [x] T004 Viết migration v13 trong `src/main/db/migrations.ts` (phụ thuộc T002, T003).
- [x] T005 [P] Mã lỗi `studioDiffNeedTwoSources` (`src/shared/codes/user-error.ts`) + thông điệp vi/en
      (`src/shared/i18n/domains/core.ts`).
- [x] T006 [P] Khoá i18n `studio.kind.documentDiff`, `studio.diff.*` (`src/shared/i18n/domains/studio.ts`); giữ xanh
      `i18n-catalog.test.ts`, `i18n-no-hardcoded-vi.test.ts`.

## Phase 2 — Prompt

- [x] T007 Test `systemPromptFor("documentDiff")` + `finalUserContent` với `<pair>` trong `tests/unit/studio-prompt.test.ts`
      (4 mục, cột bảng, quy tắc `[n]` theo mục, rủi ro chỉ từ câu chữ, trung hoà thẻ trong tên file).
- [x] T008 Cài `task("documentDiff")`, nhãn theo ngôn ngữ và khối `<pair>` trong `src/main/services/studio/prompt.ts`.

## Phase 3 — Service & map-reduce

- [x] T009 Test kiểm tra cặp + thứ tự vai trò trong `tests/unit/studio-service.test.ts` (0/1/trùng/3 id, nguồn 0 chunk, không
      gọi `contextInfo`/`chat`, mã cũ giữ nguyên, groups theo thứ tự `sourceIds`, lưu đúng thứ tự).
- [x] T010 [P] Test đóng lô theo nguồn + map prompt diff + nhãn vai trò trong `tests/unit/studio-map-reduce.test.ts`; loại khác
      không đổi.
- [x] T011 Cài kiểm tra cặp và dựng `groups` theo vai trò trong `src/main/services/studio/studio-service.ts` (sau T008, T009).
- [x] T012 Cài đóng lô theo nguồn + map prompt diff trong `src/main/services/studio/map-reduce.ts` (sau T010).

## Phase 4 — Bản quyền

- [x] T013 [P] Test Free từ chối / Pro + Enterprise cho phép `documentDiff` trong `tests/unit/license/feature-gate.test.ts`.

## Phase 5 — Renderer

- [x] T014 Test `tests/unit/studio-diff-picker.test.ts` (nguồn ready, điền sẵn, hoán đổi, nút tắt khi chưa đủ, gửi
      `[gốc, sửa đổi]`).
- [x] T015 Cài `src/renderer/features/studio/StudioDiffPicker.tsx` + style trong `studio.css` (sau T006, T014).
- [x] T016 Nối picker vào `StudioColumn.tsx`, thêm `documentDiff` vào `RESULT_KINDS`; cập nhật
      `tests/unit/studio-kinds-layout.test.ts`.
- [x] T017 Ghi chú disclaimer cho `documentDiff` trong `StudioResultCard.tsx` + test; test `UpgradePrompt` khi Free bị từ chối.
- [x] T018 [P] Test chip `[n]` trong ô bảng GFM bấm được (`MarkdownContent`).

## Phase 6 — Xuất

- [x] T019 [P] Test xuất DOCX/PDF/tên file cho `documentDiff` có bảng chứa `[n]`
      (`studio-export-docx.test.ts`, `studio-export-pdf.test.ts`, `studio-export-name.test.ts`); bổ sung nhãn nếu thiếu.

## Phase 7 — Quality gates

- [x] T020 `npm test`, `npm run lint`, `npm run build`; coverage ≥ 80% phần mã mới/đổi.
- [x] T021 Đánh dấu checklist `checklists/requirements.md`; chạy code-reviewer → glossary-steward → security-reviewer.
