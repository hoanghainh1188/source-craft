import { BrowserWindow } from "electron";
import type { BrandedExportOptions } from "@shared/ipc/types";

// 232 — Professional PDF generator using Electron Chromium printToPDF.
// Renders clean typography, cover page, auto table styling, and print margins.

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function parseInlineHtml(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\[(\d+)\]/g, '<span class="citation">[$1]</span>');
}

export function markdownToHtml(
  content: string,
  options?: BrandedExportOptions,
): string {
  const title = options?.title || "Report";
  const org = options?.organization || "SourceCraft Enterprise";
  const author = options?.author || "SourceCraft AI";
  const subtitle = options?.subtitle || "";
  const dateStr = new Date().toISOString().slice(0, 10);

  const lines = content.split(/\r?\n/);
  const bodyHtml: string[] = [];

  // Cover page
  if (options?.includeCoverPage !== false) {
    bodyHtml.push(`
      <div class="cover-page">
        <div class="cover-header">
          <span class="cover-org">${escapeHtml(org)}</span>
        </div>
        <div class="cover-body">
          <h1 class="cover-title">${escapeHtml(title)}</h1>
          ${subtitle ? `<p class="cover-subtitle">${escapeHtml(subtitle)}</p>` : ""}
        </div>
        <div class="cover-footer">
          <p><strong>Author:</strong> ${escapeHtml(author)}</p>
          <p class="cover-date">${escapeHtml(dateStr)}</p>
        </div>
      </div>
      <div class="page-break"></div>
    `);
  }

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      i++;
      continue;
    }

    // Markdown Table
    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      const rows: string[][] = [];
      while (
        i < lines.length &&
        lines[i].trim().startsWith("|") &&
        lines[i].trim().endsWith("|")
      ) {
        const rowLine = lines[i].trim();
        if (!/^[|\s:-]+$/.test(rowLine)) {
          rows.push(
            rowLine
              .slice(1, -1)
              .split("|")
              .map((c) => c.trim()),
          );
        }
        i++;
      }

      if (rows.length > 0) {
        let tableHtml = "<table>\n";
        rows.forEach((row, idx) => {
          tableHtml += "  <tr>\n";
          const tag = idx === 0 ? "th" : "td";
          row.forEach((cell) => {
            tableHtml += `    <${tag}>${parseInlineHtml(escapeHtml(cell))}</${tag}>\n`;
          });
          tableHtml += "  </tr>\n";
        });
        tableHtml += "</table>\n";
        bodyHtml.push(tableHtml);
      }
      continue;
    }

    // Code block
    if (trimmed.startsWith("```")) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      if (i < lines.length) i++;
      bodyHtml.push(
        `<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`,
      );
      continue;
    }

    // Headings
    if (trimmed.startsWith("# ")) {
      bodyHtml.push(`<h1>${escapeHtml(trimmed.slice(2).trim())}</h1>`);
    } else if (trimmed.startsWith("## ")) {
      bodyHtml.push(`<h2>${escapeHtml(trimmed.slice(3).trim())}</h2>`);
    } else if (trimmed.startsWith("### ")) {
      bodyHtml.push(`<h3>${escapeHtml(trimmed.slice(4).trim())}</h3>`);
    } else if (trimmed.startsWith("> ")) {
      // Blockquote
      bodyHtml.push(
        `<blockquote>${parseInlineHtml(escapeHtml(trimmed.slice(2).trim()))}</blockquote>`,
      );
    } else if (/^[-*]\s+/.test(trimmed)) {
      // Bullet list
      bodyHtml.push(
        `<ul><li>${parseInlineHtml(escapeHtml(trimmed.replace(/^[-*]\s+/, "")))}</li></ul>`,
      );
    } else if (/^\d+\.\s+/.test(trimmed)) {
      // Numbered list
      const numMatch = trimmed.match(/^(\d+\.)\s+(.*)$/);
      const text = numMatch ? numMatch[2] : trimmed;
      bodyHtml.push(`<ol><li>${parseInlineHtml(escapeHtml(text))}</li></ol>`);
    } else {
      // Paragraph
      bodyHtml.push(`<p>${parseInlineHtml(escapeHtml(trimmed))}</p>`);
    }

    i++;
  }

  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(title)}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 20mm 15mm 20mm 15mm;
    }
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #1e293b;
      line-height: 1.6;
      font-size: 11pt;
      margin: 0;
      padding: 0;
      background: #ffffff;
    }
    .cover-page {
      height: 90vh;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 40px 0;
    }
    .cover-org {
      font-size: 14pt;
      font-weight: 700;
      color: #1e3a8a;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .cover-title {
      font-size: 32pt;
      font-weight: 800;
      color: #0f172a;
      line-height: 1.2;
      margin-bottom: 16px;
    }
    .cover-subtitle {
      font-size: 16pt;
      color: #64748b;
      font-style: italic;
    }
    .cover-footer {
      border-top: 2px solid #e2e8f0;
      padding-top: 16px;
      color: #64748b;
      font-size: 10pt;
    }
    .page-break {
      page-break-after: always;
      break-after: page;
    }
    h1 {
      font-size: 18pt;
      color: #1e3a8a;
      margin-top: 24pt;
      margin-bottom: 12pt;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 6pt;
      page-break-after: avoid;
    }
    h2 {
      font-size: 14pt;
      color: #1e293b;
      margin-top: 18pt;
      margin-bottom: 8pt;
      page-break-after: avoid;
    }
    h3 {
      font-size: 12pt;
      color: #334155;
      margin-top: 14pt;
      margin-bottom: 6pt;
      page-break-after: avoid;
    }
    p {
      margin: 8pt 0;
      text-align: justify;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 14pt 0;
      page-break-inside: avoid;
      font-size: 10pt;
    }
    th, td {
      border: 1px solid #cbd5e1;
      padding: 8pt 10pt;
      text-align: left;
    }
    th {
      background-color: #f1f5f9;
      font-weight: 600;
      color: #0f172a;
    }
    tr:nth-child(even) td {
      background-color: #f8fafc;
    }
    blockquote {
      border-left: 4px solid #3b82f6;
      background: #f8fafc;
      margin: 12pt 0;
      padding: 8pt 14pt;
      color: #475569;
      font-style: italic;
      border-radius: 0 4px 4px 0;
    }
    pre {
      background: #0f172a;
      color: #f8fafc;
      padding: 12pt;
      border-radius: 6px;
      overflow-x: auto;
      font-size: 9.5pt;
      line-height: 1.4;
    }
    code {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      background: #f1f5f9;
      padding: 2pt 4pt;
      border-radius: 3pt;
      font-size: 9.5pt;
      color: #0f172a;
    }
    pre code {
      background: transparent;
      color: inherit;
      padding: 0;
    }
    ul, ol {
      margin: 8pt 0;
      padding-left: 24pt;
    }
    li {
      margin: 4pt 0;
    }
    .citation {
      color: #2563eb;
      font-weight: 600;
    }
  </style>
</head>
<body>
  ${bodyHtml.join("\n")}
</body>
</html>`;
}

/**
 * Generates a PDF buffer using Electron's hidden BrowserWindow printToPDF.
 */
export async function generatePdf(html: string): Promise<Buffer> {
  const win = new BrowserWindow({
    show: false,
    width: 1024,
    height: 768,
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  try {
    const encoded = Buffer.from(html, "utf8").toString("base64");
    await win.loadURL(`data:text/html;charset=utf-8;base64,${encoded}`);
    const pdfData = await win.webContents.printToPDF({
      printBackground: true,
      pageSize: "A4",
      margins: {
        top: 0.4,
        bottom: 0.4,
        left: 0.4,
        right: 0.4,
      },
    });
    return Buffer.from(pdfData);
  } finally {
    win.destroy();
  }
}
