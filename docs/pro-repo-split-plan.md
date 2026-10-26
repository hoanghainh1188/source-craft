# Kế hoạch tách chức năng Pro sang repo riêng

- Ngày: 2026-10-25 · Trạng thái: **Đã chốt hướng đi (mục 9)** · Issue: #248.
- **Repo Pro (private):** https://github.com/hoanghainh1188/source-craft-pro
- **GitHub Project (quản lý task cả 2 repo):** https://github.com/users/hoanghainh1188/projects/8
- Mô hình theo cách đã làm ở Sheafly (`sheafly` public + `sheafly-pro` private): **repo Pro chỉ chứa code**; build và phát
  hành vẫn ở repo public.

## 1. Mục tiêu

Repo `hoanghainh1188/source-craft` đang **public, giấy phép MIT**, và chứa luôn mã các chức năng trả phí. Cổng bản quyền chỉ
nằm trong code (`feature-gate.ts`), nên ai cũng fork được rồi gỡ cổng. Mục tiêu:

1. **Repo public** giữ toàn bộ app, cổng bản quyền, IPC, UI, CI, build và phát hành. Bản tự build từ mã public chạy được,
   chỉ không có chức năng Pro.
2. **Repo private `source-craft-pro`** chỉ chứa **phần cài đặt** các module Pro (code + test). Không build, không phát hành.
3. Giữ nguyên 3 điểm khác biệt bất biến (local-first, kiểm chứng được, offline) và ranh giới bảo mật renderer/main.

## 2. Hiện trạng (đo trên `main` @ `c1a387c`)

| Cờ bản quyền          | Mã cài đặt chính                                                                       | Giá trị cần giấu         |
| --------------------- | -------------------------------------------------------------------------------------- | ------------------------ |
| `studioPro`           | prompt 7 loại Studio + `custom` + `documentDiff` (`studio/prompt.ts`, `map-reduce.ts`) | Cao — nội dung prompt    |
| `specialistAiModes`   | `domainDirectives` trong `rag/prompt.ts`                                               | Cao — nội dung prompt    |
| `brandedExport`       | `studio/export/` (~813 dòng: `docx-generator.ts`, `pdf-generator.ts`)                  | Cao — bộ dựng tài liệu   |
| (audit log, #236)     | `src/main/services/audit/` (17 file, PR A #249 đã merge); PR B (CLI) chưa merge        | Cao — định dạng, mã hoá  |
| `lanAi`               | `ai-runtime/lan/` (~535 dòng) — client HTTP tới máy chủ AI nội bộ                      | Thấp — mã nối            |
| `crossNotebookSearch` | `rag/scope-gate.ts` + nhánh `scope === "all"`                                          | Thấp — mã nối RAG        |
| `multimedia`          | `ingestion/audio/`, `video/`, `image/` (~700 dòng) — gọi FFmpeg / Whisper / tesseract  | Thấp — mã nối công cụ mở |
| `itPolicy`            | `policy/` (~164 dòng) — đọc policy hệ thống                                            | Thấp                     |
| `meetingLong`         | chỉ là hạn mức; `meeting-capture/` dùng cho cả Free (15 phút)                          | — (chức năng lõi)        |
| `sharedNotebooks`     | chưa có mã                                                                             | —                        |

## 3. Ràng buộc phải nói rõ trước

1. **Không rút lại được những gì đã public.** Mã Pro hiện tại đã nằm trong lịch sử git public dưới MIT; xoá khỏi `main` không
   thu hồi được. Việc tách chỉ bảo vệ **mã viết từ nay** và bản cải tiến của mã cũ (Q1).
2. **Mã JS trong bộ cài đọc được.** Khác Sheafly (Rust biên dịch ra máy), bản Electron chứa JS trong `app.asar`; ai tải bộ
   cài cũng giải nén được. Phải biên dịch phần Pro sang **V8 bytecode** (`bytecodePlugin` của electron-vite, đã có trong
   `electron-vite@5`), tắt sourcemap cho phần đó. Đây là làm khó, không phải bảo vệ tuyệt đối.
   **Đợt 1 (thực tế):** `bytecodePlugin` chỉ hỗ trợ output CommonJS, còn main build ra ESM (`"type": "module"`) ⇒ chưa
   dùng được. Tạm thời mã `src/main/pro/` nằm ở chunk riêng `pro`, chỉ chunk đó được minify và không có sourcemap
   (`scripts/pro-chunk.ts`). Chuyển main sang CJS để bật bytecode: làm sau, đo kỹ (đụng `import.meta`, deps chỉ-ESM).
3. **README đang hứa** "Free forever, open-source (MIT), unlimited local usage" — phải sửa cho khớp hạn mức gói Free.
4. **Feature ID = số issue** (rule 4): branch đặt theo issue của repo public, **cùng tên ở cả hai repo**.

## 4. Mô hình (theo Sheafly)

```text
source-craft (public)                         source-craft-pro (private)
├─ src/main/pro/        ← STUB (MIT)           ├─ src/            ← cài đặt thật (cùng chữ ký)
│   ├─ index.ts           available() = false   ├─ api-types.test.ts  ← GIỐNG HỆT bản ở stub
│   ├─ api-types.test.ts  ghim kiểu từng hàm    ├─ deps.json          ← GIỐNG HỆT bản ở stub
│   └─ deps.json          phụ thuộc của Pro     ├─ tests/
├─ gate bản quyền, IPC, UI, i18n (public)      ├─ scripts/check-stub.mjs
└─ .github/workflows/release.yml               └─ .github/workflows/ci.yml (nhỏ, chỉ test Pro)
     job "pro": deploy key đọc repo Pro,
     kiểm khớp stub, chép đè src/main/pro/, build
```

### 4.1 Quy tắc ranh giới

- **Module Pro = hàm thuần ở main process**: nhận dữ liệu, trả kết quả. **Không** import Electron, **không** IPC, **không**
  UI, **không** tự gọi mạng (cần I/O thì core truyền hàm vào, như `AuditFs` hiện có). Zero-egress vẫn do core kiểm soát.
- **Ở lại public:** cổng bản quyền (`feature-gate.ts`, verifier, khoá công khai), handler IPC, preload whitelist, UI, chuỗi
  i18n, kiểu dữ liệu và id (`StudioKind`, `LicenseFeature`), migration DB. Không cần extension API, slot UI hay whitelist
  sinh lúc build: chỉ thay **thân hàm**.
- **Stub:** cùng tên hàm, cùng chữ ký; mỗi hàm trả lỗi `unavailable(lang)` ("Bản này không có chức năng Pro — hãy dùng bản
  phát hành chính thức"). Core gọi `pro.available()` để ẩn hoặc báo thay vì gọi mù.
- **`api-types.test.ts`** giống hệt ở hai repo, ghim kiểu từng hàm (`const _: (k: StudioKind, l: LanguageCode) => string =
pro.studioTask`); lệch chữ ký ⇒ `tsc` đỏ ở repo tương ứng.
- **`deps.json`** liệt kê phụ thuộc npm của Pro, giống hệt ở hai repo; mọi phụ thuộc này **khai ở `package.json` gốc của
  repo public** ⇒ `package-lock.json` và `THIRD_PARTY_NOTICES` không đổi khi chép đè. Chỉ giấy phép permissive.

### 4.2 Build & phát hành (repo public)

- `release.yml` thêm job **`pro`** chạy trước job build: dùng deploy key chỉ-đọc `SOURCECRAFT_PRO_DEPLOY_KEY`, checkout repo
  Pro, chạy `check-stub.mjs` (so `api-types.test.ts` + `deps.json`), chọn **một commit** cho mọi nền tảng.
- Job build (mac + win) checkout đúng commit đó, xoá `.git`/`.github` của nó, **chép đè `src/main/pro/`**, kiểm dấu
  `LicenseRef-SourceCraft-Pro`, rồi build như hiện nay.
- **Tag `v*` mà thiếu deploy key ⇒ fail** (không bao giờ phát hành nhầm bản thiếu Pro). Chạy tay / fork thiếu key ⇒ cảnh báo,
  build bằng stub.
- **Không upload mã Pro thành artifact** (artifact của repo public ai cũng tải được). Chỉ upload bộ cài.
- `ci.yml` của repo public chạy test với stub như hiện nay.

### 4.3 Repo Pro

- CI nhỏ (repo private tốn phút Actions): chỉ ubuntu, bỏ qua thay đổi `*.md`, huỷ lượt cũ. Clone repo public ở **branch cùng
  tên** (không có thì `main`), chạy `check-stub.mjs`, chép đè `src/main/pro/`, `npm ci`, chạy `tsc` + test của Pro.
- Làm việc local: clone repo Pro ra thư mục riêng (cạnh repo public), rồi trong checkout repo public chạy
  `node scripts/pro-overlay.mjs apply ../source-craft-pro` (chỉ đọc bản clone, thay `src/main/pro/`); xong thì
  `git checkout -- src/main/pro && git clean -fd src/main/pro` để về stub. `.gitignore` của repo public **không** được bỏ qua `src/main/pro/`
  (stub phải commit) ⇒ thêm kiểm tra CI: `src/main/pro/` của repo public không có dấu `LicenseRef-SourceCraft-Pro`.
- `scripts/issue-license.mjs` (công cụ cấp bản quyền) dời sang repo Pro.

## 5. Phân loại chức năng

| Chức năng                                            | Sang repo Pro                                                                                                                                            | Đợt       |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| Studio Pro (7 loại + `custom` + `documentDiff`)      | Có: `studioTask(kind, lang)`, prompt map/condense diff, `pickDiffBatches`; core giữ `summary`, `keyPoints` (Q4) và phần điều phối map-reduce             | 2         |
| Chế độ chuyên gia                                    | Có: `domainDirectives(mode, lang)`                                                                                                                       | 2         |
| Xuất DOCX/PDF                                        | Có: `docx-generator`, `pdf-generator` (thuần, nhận nội dung trả bytes)                                                                                   | 3         |
| Audit log (#236)                                     | Có: định dạng bản ghi, chuỗi băm, ký, mã hoá câu hỏi; I/O qua `AuditFs`/keystore do core truyền vào. CLI audit (đã lỡ merge public ở #253) dời cùng (Q7) | 4         |
| LAN AI, tìm kiếm toàn cục, đa phương tiện, IT policy | **Ở lại public** (mã nối, giá trị giấu thấp, cần mạng/tiến trình); chỉ giữ cổng bản quyền. Xem lại nếu sau này có logic riêng                            | —         |
| Ghi cuộc họp, bản quyền, upsell                      | Ở lại public                                                                                                                                             | —         |
| Chức năng Pro mới (shared notebooks, …)              | Viết thẳng ở repo Pro theo quy tắc 4.1                                                                                                                   | sau đợt 1 |

## 6. Lộ trình

| Đợt         | Việc                                                                                                                                                                                                                                                                                             | Xong khi                                                                                 |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| 0. Chốt     | Quyết định mục 9; **đóng băng**: không đưa mã Pro mới vào repo public                                                                                                                                                                                                                            | ADR được duyệt                                                                           |
| 1. Khung    | Chủ dự án tạo repo private + deploy key. Repo public: `src/main/pro/` stub (`available`, `unavailable`), `api-types.test.ts`, `deps.json`, job `pro` trong `release.yml`, `bytecodePlugin` cho phần Pro, kiểm tra "stub không phải bản Pro". Repo Pro: bản đầu cùng chữ ký, `check-stub.mjs`, CI | Chạy tay `release.yml` có key ⇒ build dùng bản Pro; không key ⇒ dùng stub; mọi test xanh |
| 2. Prompt   | Dời prompt Studio Pro + chế độ chuyên gia sang `pro`; core gọi qua `pro.*`, giữ cổng                                                                                                                                                                                                             | Bản stub: chỉ `summary`/`keyPoints`, chế độ chung                                        |
| 3. Xuất     | Dời `docx-generator`, `pdf-generator`                                                                                                                                                                                                                                                            | Bản stub báo `unavailable` khi xuất                                                      |
| 4. Audit    | Dời lõi audit + CLI audit (#253)                                                                                                                                                                                                                                                                 | Bản stub: audit báo không có, fail-closed vẫn đúng                                       |
| 5. Tài liệu | ADR tech-stack, `CLAUDE.md`, `TEAM-WORKFLOW.md`, README/OVERVIEW                                                                                                                                                                                                                                 | Thông điệp khớp mô hình                                                                  |

Mỗi đợt: một PR ở repo public (stub + chỗ gọi, xoá mã đã dời) và một PR ở repo Pro (mã dời sang), **cùng tên branch**, merge
repo Pro trước rồi đến repo public.

## 7. Quy trình nhóm

- Issue và Spec Kit (`specs/`, `docs/04-decisions/`, glossary, constitution) ở **repo public**. Spec không chép nội dung
  prompt hay thuật toán Pro — chỉ mô tả hành vi.
- Branch `NNN-slug` theo issue repo public, **cùng tên** ở repo Pro khi đợt đó có mã Pro.
- security-reviewer chạy ở cả hai repo; code-reviewer của repo public xem thêm: không lọt mã Pro vào stub.

## 8. Rủi ro

| Rủi ro                                | Giảm thiểu                                                                                        |
| ------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Mã Pro đọc được từ bộ cài             | V8 bytecode + minify cho phần Pro, không sourcemap; chấp nhận đây là làm khó                      |
| Stub và bản Pro lệch chữ ký/phụ thuộc | `api-types.test.ts` + `deps.json` giống hệt, `check-stub.mjs` ở cả CI repo Pro lẫn job `pro`      |
| Phát hành nhầm bản thiếu Pro          | Tag `v*` thiếu deploy key ⇒ fail                                                                  |
| Lọt mã Pro vào repo public            | Kiểm tra dấu `LicenseRef-SourceCraft-Pro` trong CI public; hướng dẫn khôi phục stub khi làm local |
| Lộ mã Pro qua artifact                | Không upload gì ngoài bộ cài; `persist-credentials: false`                                        |
| Tốn phút Actions ở repo private       | CI repo Pro chỉ ubuntu, chỉ test phần Pro, bỏ qua `*.md`                                          |

## 9. Quyết định đã chốt (2026-10-25)

Chi tiết: [`docs/04-decisions/2026-10-25-pro-repo-split.md`](04-decisions/2026-10-25-pro-repo-split.md).

| Câu                    | Quyết định                                                                                                         |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Q1 — Phạm vi bảo vệ    | Chỉ bảo vệ mã từ nay; không viết lại lịch sử git                                                                   |
| Q2 — Mô hình           | (sửa lại) Theo Sheafly: stub cùng chữ ký ở repo public, repo Pro chỉ chứa cài đặt; chép đè lúc build               |
| Q3 — Hạn mức Community | Giữ hạn mức gói Free (3 notebook, 10 nguồn, 15 phút họp); sửa câu "unlimited" ở README                             |
| Q4 — Studio bản stub   | Chỉ `summary`, `keyPoints`; `custom` và các loại khác ở repo Pro                                                   |
| Q5 — Phát hành         | (sửa lại) Build và phát hành ở repo public; bản phát hành chính thức luôn có Pro (thiếu bản quyền ⇒ chạy như Free) |
| Q6 — Issue & branch    | (sửa lại) Issue ở repo public; branch `NNN-slug` cùng tên ở cả hai repo                                            |
| Q7 — Audit log #236    | PR A, B đã merge ⇒ tạm ở public; dời lõi + CLI audit sang repo Pro ở đợt 4                                         |
