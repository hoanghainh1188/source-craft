import { useRef, useState } from "react";
import type { AddSourceInput, SourceKind } from "@shared/ipc/types";
import type { Translator } from "@shared/i18n";
import type { ParsedIpcError } from "@shared/online-error-tag";
import { useModalA11y } from "../../shared/useModalA11y";
import { IconClose } from "../../shared/icons";
import { useT } from "../../shared/i18n/i18n-context";
import {
  describeIpcError,
  toParsedError,
} from "../../shared/i18n/describe-error";
import { UpgradePrompt } from "../license-upsell/UpgradePrompt";

const FILE_EXT: Record<string, Exclude<SourceKind, "url">> = {
  pdf: "pdf",
  docx: "docx",
  txt: "txt",
  md: "md",
  markdown: "md",
  // 045 (Pha 2a): audio — bóc băng cục bộ bằng Whisper. 051: thêm m4a/aac (tách qua ffmpeg).
  wav: "audio",
  mp3: "audio",
  flac: "audio",
  ogg: "audio",
  m4a: "audio",
  aac: "audio",
  // 051 (Pha 2b): video — tách audio (ffmpeg) → bóc băng; phát <video> qua iv-media://.
  mp4: "video",
  mov: "video",
  webm: "video",
  mkv: "video",
  // 053 (Pha 2c): image — OCR (tesseract.js) → text + bbox; hiển thị <img> + highlight vùng.
  png: "image",
  jpg: "image",
  jpeg: "image",
  webp: "image",
  bmp: "image",
  tiff: "image",
};

function kindOf(name: string): Exclude<SourceKind, "url"> | null {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return FILE_EXT[ext] ?? null;
}

// 123: lỗi/thông báo lưu dạng MÔ TẢ (mã + tham số) — dịch lúc render theo ngôn ngữ hiện tại.
type AddError =
  | { kind: "unsupported"; files: string[] }
  | { kind: "urlInvalid" }
  | { kind: "ipc"; error: ParsedIpcError };
type AddNotice = "duplicateFile" | "duplicateUrl";

function addErrorText(e: AddError, tr: Translator): string {
  switch (e.kind) {
    case "unsupported":
      return tr.t("sources.add.unsupported", {
        files: e.files.join(", "),
        formats: tr.t("sources.add.formats"),
      });
    case "urlInvalid":
      return tr.t("sources.add.urlInvalid");
    case "ipc":
      return describeIpcError(e.error, tr);
  }
}

// Modal "Thêm nguồn" (prototype S3). Tệp (PDF/.docx/.txt/.md · audio 045+m4a/aac · video 051 mp4/mov/webm/mkv)
// + URL. Audio/Video nhập qua tab Tệp (kéo-thả); tab "Video" bấm → tab Tệp. "Hình ảnh" (2c) còn VÔ HIỆU.
export function AddSourceModal({
  notebookId,
  onAdd,
  onClose,
}: {
  notebookId: string;
  onAdd: (input: AddSourceInput) => Promise<boolean>;
  onClose: () => void;
}): JSX.Element {
  const [tab, setTab] = useState<"file" | "url">("file");
  const [url, setUrl] = useState("");
  const t = useT();
  const [error, setError] = useState<AddError | null>(null);
  const [notice, setNotice] = useState<AddNotice | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  useModalA11y({ active: true, onClose, containerRef: modalRef });

  const addFiles = async (files: FileList | File[]): Promise<void> => {
    setError(null);
    const arr = Array.from(files);
    const rejected: string[] = [];
    let dup = false;
    for (const f of arr) {
      const kind = kindOf(f.name);
      if (!kind) {
        rejected.push(f.name);
        continue;
      }
      const filePath = window.api.getFilePath(f);
      try {
        if (await onAdd({ notebookId, kind, filePath })) dup = true;
      } catch (e) {
        setError({ kind: "ipc", error: toParsedError(e) });
      }
    }
    if (rejected.length) setError({ kind: "unsupported", files: rejected });
    else if (dup) setNotice("duplicateFile");
    else onClose();
  };

  const addUrl = async (): Promise<void> => {
    setError(null);
    const u = url.trim();
    if (!/^https?:\/\//i.test(u)) {
      setError({ kind: "urlInvalid" });
      return;
    }
    try {
      const dup = await onAdd({ notebookId, kind: "url", url: u });
      if (dup) setNotice("duplicateUrl");
      else onClose();
    } catch (e) {
      setError({ kind: "ipc", error: toParsedError(e) });
    }
  };

  return (
    <div
      className="modal-backdrop"
      onClick={onClose}
      data-testid="add-source-modal"
    >
      <div
        className="modal add-source"
        ref={modalRef}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={t.t("sources.add.title")}
      >
        <button
          type="button"
          className="modal-x"
          onClick={onClose}
          aria-label={t.t("common.close")}
          data-testid="modal-close"
        >
          <IconClose size={16} />
        </button>
        <h3>{t.t("sources.add.title")}</h3>

        <div className="types" role="tablist">
          <button
            type="button"
            className={tab === "file" ? "type active" : "type"}
            onClick={() => setTab("file")}
            data-testid="tab-file"
          >
            {t.t("sources.add.tabFile")}
          </button>
          <button
            type="button"
            className={tab === "url" ? "type active" : "type"}
            onClick={() => setTab("url")}
            data-testid="tab-url"
          >
            {t.t("sources.add.tabUrl")}
          </button>
          {/* 045/051: audio + video nhập qua tab "Tệp" (kéo-thả). Bấm "Video" → về tab Tệp. "Hình ảnh" (2c) hoãn. */}
          <button
            type="button"
            className={tab === "file" ? "type active" : "type"}
            onClick={() => setTab("file")}
            title={t.t("sources.add.tabVideoHint")}
            data-testid="tab-video"
          >
            {t.t("sources.add.tabVideo")}
          </button>
          {/* 053: ảnh nhập qua tab "Tệp" (OCR). Bấm "Hình ảnh" → về tab Tệp. */}
          <button
            type="button"
            className={tab === "file" ? "type active" : "type"}
            onClick={() => setTab("file")}
            title={t.t("sources.add.tabImageHint")}
            data-testid="tab-image"
          >
            {t.t("sources.add.tabImage")}
          </button>
        </div>

        {tab === "file" && (
          <div
            className={dragOver ? "drop over" : "drop"}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              void addFiles(e.dataTransfer.files);
            }}
            onClick={() => fileInput.current?.click()}
            data-testid="drop-zone"
          >
            <p>{t.t("sources.add.dropPrompt")}</p>
            <p className="hint">
              {t.t("sources.add.dropHint", {
                formats: t.t("sources.add.formats"),
              })}
            </p>
            <p className="hint" data-testid="video-origin-note">
              {t.t("sources.add.originNote")}
            </p>
            <input
              ref={fileInput}
              type="file"
              multiple
              accept=".pdf,.docx,.txt,.md,.wav,.mp3,.flac,.ogg,.m4a,.aac,.mp4,.mov,.webm,.mkv,.png,.jpg,.jpeg,.webp,.bmp,.tiff"
              hidden
              onChange={(e) => {
                if (e.target.files) void addFiles(e.target.files);
              }}
            />
          </div>
        )}

        {tab === "url" && (
          <div className="url-row">
            <input
              type="url"
              placeholder="https://…"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              data-testid="url-input"
            />
            <button
              type="button"
              onClick={() => void addUrl()}
              data-testid="url-add"
            >
              {t.t("sources.add.urlAdd")}
            </button>
          </div>
        )}

        {error && (
          <p className="form-error" role="alert">
            {addErrorText(error, t)}
          </p>
        )}
        {error?.kind === "ipc" && <UpgradePrompt error={error.error} />}
        {notice && (
          <p className="form-notice">{t.t(`sources.add.${notice}`)}</p>
        )}

        <div className="modal-actions">
          <button type="button" onClick={onClose}>
            {t.t("common.close")}
          </button>
        </div>
      </div>
    </div>
  );
}
