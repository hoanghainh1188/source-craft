# Kế hoạch tách chức năng Pro sang repo riêng (đề xuất)

- Ngày: 2026-10-25 · Trạng thái: **Đã chốt hướng đi (mục 9)** · Issue: #248.
- Khi đã chốt: tạo issue, ghi quyết định vào `docs/04-decisions/` (rule 2), cập nhật ADR tech-stack và `CLAUDE.md`.

## 1. Mục tiêu

Repo `hoanghainh1188/source-craft` đang **public, giấy phép MIT**, và chứa luôn mã các chức năng trả phí. Cổng bản quyền chỉ
nằm trong code (`feature-gate.ts`), nên ai cũng fork được rồi gỡ cổng. Mục tiêu:

1. **Repo public (core, MIT)** giữ bản Community miễn phí, chạy được độc lập, không chứa mã Pro.
2. **Repo private (`source-craft-pro`)** chứa phần cài đặt chức năng Pro/Enterprise và quy trình build + phát hành bản Pro.
3. Giữ nguyên 3 điểm khác biệt bất biến (local-first, kiểm chứng được, offline) và ranh giới bảo mật renderer/main.

## 2. Hiện trạng (đo trên `main` @ `137e1e6`)

| Cờ bản quyền                                                                                                             | Mã cài đặt chính                                                                                                      | Mức gắn với lõi                             |
| ------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| `lanAi`                                                                                                                  | `src/main/services/ai-runtime/lan/` (~535 dòng) + `SettingsLanAiSection.tsx`                                          | Thấp — đã là provider riêng                 |
| `brandedExport`                                                                                                          | `src/main/services/studio/export/` (~813 dòng) + nút xuất                                                             | Thấp                                        |
| `itPolicy`                                                                                                               | `src/main/services/policy/` (~164 dòng)                                                                               | Thấp                                        |
| `specialistAiModes`                                                                                                      | nhánh `domainMode` trong `rag/prompt.ts` + `DomainToggle.tsx`                                                         | Trung bình — chen giữa prompt RAG           |
| `studioPro`                                                                                                              | 7 loại Studio + `documentDiff` trong `studio/prompt.ts`, `map-reduce.ts`, `studio-service.ts`, `StudioDiffPicker.tsx` | Cao — `Record<StudioKind, …>`, CHECK của DB |
| `crossNotebookSearch`                                                                                                    | `rag/scope-gate.ts` + nhánh `scope === "all"` trong RAG/search                                                        | Cao — nằm trong luồng RAG                   |
| `multimedia`                                                                                                             | `ingestion/audio                                                                                                      | video                                       | image/`(~700 dòng) + FFmpeg, Whisper, tesseract trong`electron-builder.yml` | Cao — kéo theo binary native |
| `meetingLong`                                                                                                            | chỉ là hạn mức; `meeting-capture/` (~5.200 dòng) dùng cho cả Free (15 phút)                                           | Không tách được — là chức năng lõi          |
| `sharedNotebooks`                                                                                                        | chưa có mã                                                                                                            | —                                           |
| (audit log, #236)                                                                                                        | `src/main/services/audit/` (17 file, PR A #249 đã merge) + nối trong `main/index.ts`; PR B (CLI) chưa merge           | Thấp–trung bình — móc vào luồng hỏi đáp     |
| Điểm nối hiện có: `register.ts` (798 dòng) và `main/index.ts` (1.337 dòng) gọi trực tiếp mọi service; `preload/index.ts` |
| whitelist cứng mọi kênh; `StudioKind`/`LicenseFeature` là union cố định trong `src/shared/ipc/types.ts`; CHECK của       |
| `studio_result.kind` (migration v13) liệt kê cứng từng loại.                                                             |

## 3. Ràng buộc phải nói rõ trước

1. **Không rút lại được những gì đã public.** Toàn bộ mã Pro hiện tại đã nằm trong lịch sử git public dưới MIT. Xoá khỏi
   `main` hay viết lại lịch sử **không** thu hồi được quyền MIT đã trao, và fork thì đã tồn tại. Việc tách chỉ bảo vệ
   **mã Pro viết từ nay về sau** và các bản cải tiến của mã cũ.
2. **README đang hứa** "Free forever, open-source (MIT), unlimited local usage", trong khi bản Free đã có hạn mức (3
   notebook, 10 nguồn). Cần sửa thông điệp cho khớp mô hình open-core.
3. **Ranh giới bảo mật không đổi:** mã Pro chạy ở main process; kênh IPC Pro vẫn phải whitelist trong preload và kiểm tham
   số ở main.
4. **Feature ID = số issue** (rule 4): hai repo có hai dải số issue riêng ⇒ branch `NNN-slug` sẽ trùng số.
5. **Mỗi bản phải tự chạy được:** bản Community không được import mã Pro, kể cả gián tiếp.

## 4. Các phương án

| Phương án                                      | Mô tả                                                                                                                                    | Ưu                                                                          | Nhược                                                                                                  |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| A. Core thành thư viện npm                     | Repo Pro là app chính, core xuất bản thành package                                                                                       | Ranh giới rõ nhất                                                           | Core là app Electron, không phải thư viện — phải tái cấu trúc rất lớn; bản Community lại cần app riêng |
| **B. Open-core + extension API (khuyến nghị)** | Core giữ là app, thêm các "điểm cắm"; repo Pro là package `@sourcecraft/pro` + build bản Pro bằng cách gắn core (git submodule theo tag) | Bản Community không đổi cách build; mã Pro chỉ phụ thuộc hợp đồng công khai | Phải thiết kế và giữ ổn định extension API                                                             |
| C. Plugin tải lúc chạy                         | Bản cài duy nhất, mã Pro tải về khi kích hoạt bản quyền                                                                                  | Một bản cài                                                                 | Cần máy chủ phân phối + ký mã plugin; dễ đụng nguyên tắc offline/zero-egress; rủi ro bảo mật cao       |

**Khuyến nghị: B.** Hợp đồng (tên kênh, kiểu dữ liệu, id loại Studio, cờ bản quyền) để **public trong core**; phần cài đặt
để **private**.

## 5. Kiến trúc đích (phương án B)

### 5.1 Hợp đồng extension (core, `src/shared/extension/`)

```typescript
export interface ProModule {
  apiVersion: 1; // tăng khi đổi hợp đồng (semver của extension API)
  main: (host: MainHost) => void; // đăng ký phía main process
  renderer?: (host: RendererHost) => void; // đăng ký slot UI
  i18n?: Partial<Record<LanguageCode, Catalog>>;
  ipcChannels?: readonly string[]; // kênh thêm — build gộp vào whitelist preload
}
```

`MainHost` mở các registry sau (core tự đăng ký phần Free qua chính các registry này):

| Registry                       | Thay cho                                                                                                 |
| ------------------------------ | -------------------------------------------------------------------------------------------------------- |
| `studioKinds`                  | `task()` + `Record<StudioKind,…>`; mỗi loại khai prompt, có map-reduce riêng hay không, validate đầu vào |
| `exportFormats`                | gọi trực tiếp `docx-generator` / `pdf-generator`                                                         |
| `aiProviders`                  | nối cứng LAN provider trong `ProviderRegistry`                                                           |
| `ragPromptDirectives`          | nhánh `domainMode` trong `rag/prompt.ts`                                                                 |
| `ragScopes`                    | nhánh `scope === "all"`                                                                                  |
| `sourceParsers`                | parser audio/video/image trong ingestion                                                                 |
| `policyProviders`              | `policy-service.ts`                                                                                      |
| `ipcHandlers`                  | `safeHandle(...)` của chức năng Pro trong `register.ts`                                                  |
| `migrations` (namespace `pro`) | bảng/cột riêng của Pro, đếm phiên bản riêng                                                              |

`RendererHost` mở slot: mục Cài đặt, hành động Studio (nút + panel), công cụ khung Chat, nút xuất.

### 5.2 Nạp module lúc build

- `electron.vite.config.ts`: alias `@pro` → `src/pro-stub` (core, export `null`) hoặc → `pro/src` (repo Pro), chọn bằng biến
  `SC_EDITION=community|pro`.
- `main/index.ts` gọi `pro?.main(host)` **sau** khi core đăng ký xong; renderer tương tự.
- Preload: whitelist = kênh core ∪ `ipcChannels` của module, sinh lúc build (không đọc lúc chạy).
- Cổng bản quyền giữ ở core (`feature-gate.ts`, verifier, khoá công khai — khoá công khai không phải bí mật). Bản Community
  không có mã Pro nên có `.sclicense` cũng không mở thêm được gì.

### 5.3 Dữ liệu

- Bỏ CHECK liệt kê cứng ở `studio_result.kind` (migration core mới), kiểm bằng registry ở main ⇒ thêm loại Pro không cần
  migration core.
- Union `StudioKind` / `LicenseFeature` giữ trong core như **danh mục id công khai** (đã lộ qua bản quyền và i18n).
- DB tạo bởi bản Pro mở bằng bản Community: kết quả loại Pro hiển thị chỉ-đọc, không tạo lại được (cần test).

## 6. Phân loại chức năng

| Chức năng                                       | Đi repo Pro                                                      | Giai đoạn       | Ghi chú                                                                                                  |
| ----------------------------------------------- | ---------------------------------------------------------------- | --------------- | -------------------------------------------------------------------------------------------------------- |
| LAN AI (`lanAi`)                                | Có                                                               | 2               | Đã là provider riêng — làm đầu tiên để kiểm chứng `aiProviders`                                          |
| Xuất DOCX/PDF (`brandedExport`)                 | Có                                                               | 2               |                                                                                                          |
| IT policy (`itPolicy`)                          | Có                                                               | 2               |                                                                                                          |
| Chế độ chuyên gia (`specialistAiModes`)         | Có                                                               | 3               | Cần `ragPromptDirectives`                                                                                |
| Studio Pro (7 loại + `custom` + `documentDiff`) | Có                                                               | 3               | Cần `studioKinds`; core chỉ giữ `summary`, `keyPoints` (Q4)                                              |
| Tìm kiếm toàn cục (`crossNotebookSearch`)       | Có                                                               | 4               | Cần `ragScopes`; đụng sâu RAG                                                                            |
| Đa phương tiện (`multimedia`)                   | Có                                                               | 5               | Kéo theo FFmpeg/Whisper/tesseract ⇒ bản Community nhẹ hơn; cấu hình `electron-builder` tách theo edition |
| Ghi cuộc họp                                    | Không                                                            | —               | Lõi; hạn mức 15 phút giữ ở core                                                                          |
| Audit log (#236)                                | Có                                                               | 2               | PR A đã ở core (MIT) — dời qua registry; PR B làm ở repo Pro sau giai đoạn 1 (Q7)                        |
| Shared notebooks                                | Làm mới ở repo Pro                                               | sau giai đoạn 1 | Không đưa thêm mã Pro mới vào repo public                                                                |
| Bản quyền, upsell, `issue-license.mjs`          | Verifier + upsell ở core; **script cấp bản quyền sang repo Pro** | 1               | Khoá riêng đã `.gitignore` (`*.pem`); vẫn nên dời công cụ phát hành                                      |

## 7. Lộ trình

| Giai đoạn          | Việc                                                                                                                                                                                                             | Xong khi                                                  |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| 0. Chốt            | Trả lời mục 9; tạo issue + ADR; **đóng băng mã Pro mới** trên repo public                                                                                                                                        | ADR được duyệt                                            |
| 1. Khung           | Tạo `source-craft-pro` (private); `ProModule` + `MainHost`/`RendererHost` rỗng; alias `@pro` + stub; preload sinh whitelist; CI repo Pro: checkout core theo tag (submodule) + chạy toàn bộ test core + test Pro | Hai bản build xanh, hành vi y hệt hiện nay                |
| 2. Module ít gắn   | Dời LAN AI, xuất DOCX/PDF, IT policy, audit log (PR A) qua registry                                                                                                                                              | Bản Community không còn các thư mục này; test chuyển theo |
| 3. Prompt & Studio | Registry `studioKinds` + `ragPromptDirectives`; migration bỏ CHECK; dời loại Studio Pro + chế độ chuyên gia                                                                                                      | Thêm loại Studio không cần sửa core                       |
| 4. RAG toàn cục    | Registry `ragScopes`; dời tìm kiếm toàn cục                                                                                                                                                                      | Luồng RAG core chỉ biết phạm vi notebook                  |
| 5. Đa phương tiện  | Registry `sourceParsers`; `electron-builder` theo edition                                                                                                                                                        | Bản Community không đóng gói FFmpeg/Whisper/tesseract     |
| 6. Phát hành       | Release workflow ở repo Pro (dmg + nsis bản Pro); repo public phát hành bản Community; sửa README/OVERVIEW                                                                                                       | Hai bộ cài trên hai kênh phát hành                        |

Mỗi giai đoạn: một PR ở core (điểm cắm, xoá mã đã dời) + một PR ở repo Pro (mã dời sang), merge cùng nhau và repo Pro ghim
core theo commit/tag mới.

## 8. Repo, CI, quy trình nhóm

- **Cấu trúc repo Pro:** `core/` (git submodule → `source-craft` theo tag) · `pro/src/main`, `pro/src/renderer`,
  `pro/src/shared` · `pro/tests` · `scripts/issue-license.mjs` · `.github/workflows/{ci,release}.yml`.
- **Test:** core chạy với stub (không có mã Pro); repo Pro chạy test core + test Pro + **test hợp đồng** (core đổi
  `apiVersion` mà Pro chưa theo ⇒ CI đỏ). Thêm kiểm tra "core không import `pro/`" bằng ESLint `no-restricted-imports`.
- **Spec Kit & đánh số:** `docs/04-decisions`, glossary, constitution ở core là nguồn chung; repo Pro dùng branch
  `pro-NNN-slug` (NNN = số issue repo Pro) để không trùng số với core — xem Q6.
- **Bảo mật:** security-reviewer chạy ở cả hai repo; kênh Pro vẫn kiểm tham số ở main như kênh core.

## 9. Quyết định đã chốt (2026-10-25)

Chi tiết: [`docs/04-decisions/2026-10-25-pro-repo-split.md`](04-decisions/2026-10-25-pro-repo-split.md).

| Câu                    | Quyết định                                                                                                                              |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Q1 — Phạm vi bảo vệ    | Chỉ bảo vệ mã từ nay; không viết lại lịch sử git                                                                                        |
| Q2 — Mô hình           | B. Open-core + extension API; core là submodule (theo tag) trong repo Pro                                                               |
| Q3 — Hạn mức Community | Giữ hạn mức gói Free (3 notebook, 10 nguồn, 15 phút họp); sửa câu "unlimited" ở README                                                  |
| Q4 — Studio Community  | Chỉ `summary`, `keyPoints`; `custom` và các loại khác sang repo Pro                                                                     |
| Q5 — Phát hành         | Bản Pro là bộ cài chính (chưa có bản quyền ⇒ chạy như Free); Community để cộng đồng tự build                                            |
| Q6 — Issue             | Issue Pro ở repo Pro, branch `pro-NNN-slug`; issue điểm cắm core ở repo public                                                          |
| Q7 — Audit log #236    | (sửa lại) PR A đã merge ⇒ tạm ở core, dời sang repo Pro ở giai đoạn 2; PR B không merge vào repo public, làm ở repo Pro sau giai đoạn 1 |

## 10. Rủi ro

| Rủi ro                                        | Giảm thiểu                                                                                            |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Extension API thiết kế sai, phải đổi liên tục | Rút API từ đúng các điểm nối đang có (mục 5.1), làm LAN AI trước để thử; `apiVersion` + test hợp đồng |
| Hai repo lệch nhau                            | Repo Pro ghim core theo tag; CI Pro chạy test core                                                    |
| Lọt mã Pro vào repo public                    | ESLint chặn import; CI core build với stub; review PR                                                 |
| DB dùng chung giữa hai bản                    | Migration Pro namespace riêng; test mở DB của bản Pro bằng bản Community                              |
| Khối lượng lớn đúng lúc đang ra tính năng     | Đóng băng mã Pro mới ở core từ giai đoạn 0; chia nhỏ theo giai đoạn, mỗi giai đoạn tự phát hành được  |
