#!/usr/bin/env node
// Sinh THIRD-PARTY-NOTICES.md từ package-lock.json (chỉ gói production, bỏ dev) + văn bản giấy phép thật
// trong node_modules. Chạy: `npm run licenses`. Dùng `--check` để CI báo lỗi khi tệp lệch lockfile.
import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(root, "THIRD-PARTY-NOTICES.md");
const lock = JSON.parse(readFileSync(join(root, "package-lock.json"), "utf8"));

// Gói nằm trong cây phụ thuộc nhưng bị LOẠI khỏi bản cài (electron-builder.yml `files` — GPL, app không dùng).
const EXCLUDED_FROM_BUNDLE = new Set(["@audio/decode-aac", "@audio/decode-wma"]);

const LICENSE_FILE = /^(licen[sc]e|copying|notice)(\..*)?$/i;

function readJson(p) {
  try {
    return JSON.parse(readFileSync(p, "utf8"));
  } catch {
    return null;
  }
}

function licenseId(lockEntry, pkg) {
  const raw = lockEntry.license ?? pkg?.license ?? pkg?.licenses;
  if (Array.isArray(raw)) {
    return raw.map((l) => (typeof l === "string" ? l : l.type)).join(" OR ");
  }
  if (raw && typeof raw === "object") return raw.type ?? "UNKNOWN";
  return raw ?? "UNKNOWN";
}

function licenseTexts(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => LICENSE_FILE.test(f))
    .sort()
    .map((f) => readFileSync(join(dir, f), "utf8").trim())
    .filter(Boolean);
}

const entries = [];
for (const [path, meta] of Object.entries(lock.packages)) {
  if (!path || meta.dev) continue;
  if (EXCLUDED_FROM_BUNDLE.has(path.replace(/^.*node_modules\//, ""))) continue;
  const dir = join(root, path);
  const pkg = readJson(join(dir, "package.json"));
  const name = path.replace(/^.*node_modules\//, "");
  const repo =
    typeof pkg?.repository === "string"
      ? pkg.repository
      : (pkg?.repository?.url ?? pkg?.homepage ?? "");
  entries.push({
    name,
    version: meta.version ?? pkg?.version ?? "?",
    license: licenseId(meta, pkg),
    repo: repo.replace(/^git\+/, "").replace(/\.git$/, ""),
    optional: Boolean(meta.optional),
    texts: licenseTexts(dir),
  });
}
entries.sort(
  (a, b) =>
    a.name.localeCompare(b.name, "en") || a.version.localeCompare(b.version),
);

// Gộp văn bản giống hệt nhau để tệp không phình (hàng trăm gói MIT chỉ khác dòng Copyright → vẫn giữ riêng).
const byText = new Map();
for (const e of entries) {
  const key =
    e.texts.join("\n\n---\n\n") ||
    "(không có tệp giấy phép đi kèm — xem trường license ở trên)";
  const list = byText.get(key) ?? [];
  list.push(`${e.name}@${e.version}`);
  byText.set(key, list);
}

const counts = new Map();
for (const e of entries)
  counts.set(e.license, (counts.get(e.license) ?? 0) + 1);

const header = `# Thông báo bên thứ ba / Third-Party Notices

SourceCraft được phát hành theo giấy phép MIT (xem \`LICENSE\`). Ứng dụng bao gồm và/hoặc tải về các thành phần của
bên thứ ba bên dưới; mỗi thành phần thuộc quyền của chủ sở hữu và giữ giấy phép riêng.
SourceCraft is MIT-licensed (see \`LICENSE\`). It bundles or downloads the third-party components below, each under its own license.

> Tệp này SINH TỰ ĐỘNG bởi \`npm run licenses\` từ \`package-lock.json\` — đừng sửa tay (trừ mục 1–3).

## 1. Thành phần đóng gói sẵn không qua npm / Bundled non-npm components

| Thành phần | Giấy phép | Ghi chú |
|---|---|---|
| Electron + Chromium | MIT + giấy phép Chromium (\`LICENSES.chromium.html\` đi kèm bản cài) | Khung chạy ứng dụng |
| FFmpeg 7.1.1 (bản LGPL tối giản tự dựng) | LGPL-2.1-or-later (\`--disable-gpl --disable-nonfree\`, không thư viện ngoài) | Binary chạy riêng (spawn) để tách audio khỏi video. Mã nguồn + cấu hình dựng: https://ffmpeg.org/releases/ffmpeg-7.1.1.tar.xz và \`scripts/build-ffmpeg-lgpl.sh\` trong kho mã; văn bản giấy phép: \`ffmpeg/COPYING.LGPLv2.1\` cạnh ứng dụng |
| Tesseract OCR core + dữ liệu ngôn ngữ | Apache-2.0 | \`tesseract.js-core\`; dữ liệu \`vie\`, \`eng\` tải về lần đầu |

## 2. Mô hình AI tải về lúc chạy / Models downloaded at runtime

| Mô hình | Giấy phép | Nguồn |
|---|---|---|
| \`Xenova/whisper-base\`, \`Xenova/whisper-tiny\` (chuyển giọng nói) | MIT (OpenAI Whisper) | https://huggingface.co/Xenova |
| \`Xenova/multilingual-e5-small\` (embedding) | MIT | https://huggingface.co/Xenova/multilingual-e5-small |
| Mô hình LLM chạy qua Ollama | Do người dùng tự chọn — tuân theo giấy phép riêng của từng mô hình (Llama, Gemma, Qwen…) | https://ollama.com/library |

## 3. Thư viện npm (production) / npm libraries (production)

Tổng cộng ${entries.length} gói. Phân bố giấy phép:

${[...counts.entries()]
  .sort((a, b) => b[1] - a[1])
  .map(([l, n]) => `- ${l}: ${n}`)
  .join("\n")}

| Gói | Phiên bản | Giấy phép | Nguồn |
|---|---|---|---|
${entries
  .map(
    (e) =>
      `| ${e.name}${e.optional ? " *(tùy chọn theo nền tảng)*" : ""} | ${e.version} | ${e.license} | ${e.repo} |`,
  )
  .join("\n")}

## 4. Văn bản giấy phép / License texts
`;

const body = [...byText.entries()]
  .map(
    ([text, pkgs]) =>
      `\n### ${pkgs.join(", ")}\n\n\`\`\`text\n${text}\n\`\`\`\n`,
  )
  .join("");

const out = header + body;

if (process.argv.includes("--check")) {
  const cur = existsSync(OUT) ? readFileSync(OUT, "utf8") : "";
  if (cur !== out) {
    console.error("THIRD-PARTY-NOTICES.md đã cũ — chạy `npm run licenses`.");
    process.exit(1);
  }
  console.log("THIRD-PARTY-NOTICES.md khớp lockfile.");
} else {
  writeFileSync(OUT, out);
  console.log(`Đã ghi ${OUT} (${entries.length} gói).`);
}
