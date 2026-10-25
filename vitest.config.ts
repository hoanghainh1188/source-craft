import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

// Unit test chạy ở môi trường node, KHÔNG cần Electron runtime.
// Coverage chỉ tính "business logic" (Constitution IV, Article W ≥ 80%):
// services thuần + helpers + shared ipc. File chạm electron (index/register/preload) + UI renderer
// phủ bởi e2e (Playwright), loại khỏi coverage để không làm sai lệch ngưỡng.
export default defineConfig({
  resolve: { alias: { "@shared": resolve("src/shared") } },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: [
        "src/main/services/**/*.ts",
        "src/main/db/**/*.ts",
        "src/main/logging.ts",
        "src/shared/ipc/**/*.ts",
        "src/shared/i18n/**/*.ts",
        "src/shared/codes/**/*.ts",
        "src/main/services/ui-language/**/*.ts",
        "src/renderer/shared/i18n/i18n-context.ts",
        "src/renderer/shared/i18n/describe-error.ts",
        "src/shared/notebook-palette.ts",
        "src/renderer/features/notebooks/relative-time.ts",
        "src/renderer/features/sources/source-status.ts",
        "src/renderer/features/rag-qa/citation-format.ts",
        "src/renderer/features/source-viewer/highlight.ts",
        "src/main/services/studio/studio-repo.ts",
        "src/main/services/studio/prompt.ts",
        "src/main/services/studio/balanced-context.ts",
        "src/main/services/studio/export-name.ts",
        "src/main/services/rag/chat-repo.ts",
        "src/main/services/rag/fusion.ts",
        "src/main/services/rag/rewrite.ts",
        "src/main/services/rag/retrieval.ts",
        // 108: phần THUẦN của công cụ đo truy xuất (harness/report là I/O — không tính).
        "tests/eval/lib/dataset.ts",
        "tests/eval/lib/metrics.ts",
        "tests/eval/lib/grid.ts",
        "tests/eval/lib/rerank-grid.ts",
        "tests/eval/lib/rerank-diagnose.ts",
        "tests/eval/lib/rerank-compare.ts",
        "tests/eval/lib/rerank-input.ts",
        // 177: PDF fixture của bộ đánh giá (thuần, tất định).
        "tests/eval/lib/pdf-fixture.ts",
        // report.ts giữ NGOÀI coverage như 108 (writeReport + phần render lớn là I/O / định dạng); phần mới renderPdfSection có
        // test riêng ở tests/unit/eval-report.test.ts.
        "src/main/services/ingestion/fts-fold.ts",
        "src/main/services/ingestion/keyword-store.ts",
        "src/renderer/shared/useModalA11y.ts",
        "src/renderer/shared/lastNotebook.ts",
        "src/renderer/shared/markdown/remark-cite.ts",
        "src/renderer/features/sources/useColumnWidths.ts",
        "src/renderer/shared/format-bytes.ts",
        "src/main/services/app-shell/storage-info.ts",
        // 073 content-search: hàm thuần snippet + service DI (không I/O trực tiếp).
        "src/main/services/search/snippet.ts",
        "src/main/services/search/content-search.ts",
        "src/main/services/ai-runtime/online/stream-parse.ts",
        "src/renderer/shared/shortcuts.ts",
        "src/main/services/ingestion/audio/resample.ts",
        "src/main/services/ingestion/audio/audio-transcript.ts",
        // 194: phát hiện ngôn ngữ Whisper — phần thuần + bộ phát hiện chạy trên phần giả.
        "src/main/services/ingestion/audio/whisper-language.ts",
        "src/main/services/ingestion/audio/language-detector.ts",
        "src/main/services/source-viewer/media-range.ts",
        "src/main/services/ingestion/video/ffmpeg-path.ts",
        "src/main/services/ingestion/parsers/video.ts",
        "src/main/services/ingestion/image/image-transcript.ts",
        "src/main/services/ingestion/image/ocr-path.ts",
        "src/main/services/ingestion/parsers/image.ts",
        // 059 embed-in-process: hàm thuần embedding + gợi ý model.
        "src/main/services/embedding/e5-prefix.ts",
        "src/main/services/embedding/model-version.ts",
        "src/main/services/embedding/vector-normalize.ts",
        "src/main/services/embedding/reindex-plan.ts",
        "src/main/services/ai/model-recommend.ts",
        // 062: hàm thuần map lỗi khởi động → dialog (không I/O).
        "src/main/services/app-shell/startup-error.ts",
        // 085 vault-backup: service vault-backup (đã nằm trong src/main/services/**) + helper thuần renderer.
        "src/renderer/features/vault-backup/password-rules.ts",
        "src/renderer/features/vault-backup/messages.ts",
        // 088 app-log: báo lỗi renderer (thuần, jsdom test) — log-file/renderer-error đã nằm trong services/**.
        "src/renderer/shared/error-report.ts",
        // 091 a11y: kênh thông báo + câu thông báo (thuần).
        "src/renderer/shared/a11y/announcer.ts",
        "src/renderer/shared/a11y/messages.ts",
        // 186: phần thuần dùng chung + renderer của Ghi cuộc họp.
        "src/shared/meeting/**/*.ts",
        "src/renderer/features/meeting-capture/default-title.ts",
      ],
      // Composition roots / wiring quanh thư viện ngoài (I/O native, parser lib) — phủ bởi e2e/integration,
      // không phải business logic thuần. Loại khỏi ngưỡng coverage.
      // Chỉ loại các adapter I/O native / composition root (không test được thuần). pipeline.ts GIỮ
      // trong ngưỡng vì chứa business logic (cancel/resume/error-by-step) đã phủ test bằng DI.
      exclude: [
        // 186: entry utilityProcess (Whisper/transformers.js, parentPort) — chỉ chạy trong Electron, phủ bởi e2e
        // (IV_ASR_FAKE). Phần thuần (giao thức, ASR giả) đã tính coverage.
        "src/main/services/meeting-capture/asr-worker.ts",
        // 085: adapter hộp thoại Electron (I/O native) — phủ bởi e2e (IV_E2E_DIALOG_PATH).
        "src/main/services/vault-backup/dialogs.ts",
        // 088: adapter node:fs cho sink nhật ký (I/O thuần; logic xoay vòng ở log-file.ts đã tính coverage).
        "src/main/services/app-log/log-fs.ts",
        // 236: I/O mỏng của nhật ký kiểm toán (append + fsync) — phủ bởi audit-writer-perf (đĩa thật) + e2e.
        "src/main/services/audit/node-audit-fs.ts",
        // 093: adapter node:fs cho báo lỗi (tệp đánh dấu phiên, đọc đuôi nhật ký, liệt kê minidump).
        "src/main/services/crash-report/crash-fs.ts",
        // 101: hộp thoại Electron chọn lại tệp gốc (I/O native) — phủ bởi e2e (IV_E2E_DIALOG_PATH).
        "src/main/services/ingestion/relink-dialog.ts",
        "src/main/services/ai-runtime/ai-runtime.ts",
        "src/main/services/ingestion/ingestion.ts",
        "src/main/services/ingestion/vector-store.ts",
        "src/main/services/ingestion/parsers/pdf.ts",
        "src/main/services/ingestion/parsers/docx.ts",
        "src/main/services/ingestion/parsers/url.ts",
        "src/main/services/source-viewer/source-content.ts",
        "src/main/services/studio/export.ts",
        // online-provider (031): adapter I/O HTTP + native keytar loader — phủ qua provider tests (fetch giả)
        // + e2e/thủ công, không phải logic thuần đo ngưỡng.
        "src/main/services/ai-runtime/online/online-http.ts",
        "src/main/services/ai-runtime/online/keytar-loader.ts",
        "src/main/services/app-shell/storage-fs.ts",
        // 045 audio: adapter I/O (giải mã audio-decode + transformers.js Whisper + wiring parser) — phủ
        // bởi hàm thuần resample/audio-transcript + thủ công. Loại khỏi ngưỡng.
        "src/main/services/ingestion/audio/decode.ts",
        "src/main/services/ingestion/audio/transcribe.ts",
        "src/main/services/ingestion/parsers/audio.ts",
        // 049 audio-player: handler stream file gốc qua giao thức iv-media:// (node:fs + electron
        // protocol). Hàm thuần tách ở media-range.ts (đã tính coverage). Loại wiring I/O.
        "src/main/services/source-viewer/media-serve.ts",
        // 051 video: spawn ffmpeg I/O (mock trong extract-audio.test.ts, không tính ngưỡng).
        "src/main/services/ingestion/video/extract-audio.ts",
        // 053 image: OCR worker tesseract.js I/O (verify Node + manual; hàm thuần ở image-transcript).
        "src/main/services/ingestion/image/ocr.ts",
        // 059: adapter I/O (transformers.js feature-extraction, LanceDB re-add, Ollama /api/tags,
        // job nền reindex) — phủ bởi hàm thuần + DI test + thủ công. Loại khỏi ngưỡng.
        "src/main/services/embedding/embed-model.ts",
        "src/main/services/embedding/reindex-runner.ts",
        "src/main/services/ai/ollama-health.ts",
        // 109: adapter I/O bộ chấm (transformers.js cross-encoder) — phần thuần ở status.ts, fake-score.ts, rerank-filter.ts.
        "src/main/services/rerank/rerank-model.ts",
      ],
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
    },
  },
});
