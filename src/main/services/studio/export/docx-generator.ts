import type { BrandedExportOptions } from "@shared/ipc/types";
import { buildZip, type ZipEntry } from "./docx-zip";

// 232 — Pure TypeScript DOCX Generator complying with ISO/IEC 29500 (Open Packaging Conventions).
// Generates Microsoft Word (.docx) files with branding, cover page, headers/footers, and styled markdown content.

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function parseInlineRuns(text: string): string {
  // Tokenize bold, italic, code, and citations
  // Example tokens: **bold**, *italic*, `code`, [1]
  const runs: string[] = [];
  const regex = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[\d+\])/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      const plain = text.slice(lastIndex, match.index);
      runs.push(
        `<w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="22"/></w:rPr><w:t xml:space="preserve">${escapeXml(plain)}</w:t></w:r>`,
      );
    }
    const token = match[0];
    if (token.startsWith("**") && token.endsWith("**")) {
      const inner = token.slice(2, -2);
      runs.push(
        `<w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:b/><w:sz w:val="22"/></w:rPr><w:t xml:space="preserve">${escapeXml(inner)}</w:t></w:r>`,
      );
    } else if (token.startsWith("*") && token.endsWith("*")) {
      const inner = token.slice(1, -1);
      runs.push(
        `<w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:i/><w:sz w:val="22"/></w:rPr><w:t xml:space="preserve">${escapeXml(inner)}</w:t></w:r>`,
      );
    } else if (token.startsWith("`") && token.endsWith("`")) {
      const inner = token.slice(1, -1);
      runs.push(
        `<w:r><w:rPr><w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/><w:shd w:val="clear" w:color="auto" w:fill="F1F5F9"/><w:sz w:val="20"/></w:rPr><w:t xml:space="preserve">${escapeXml(inner)}</w:t></w:r>`,
      );
    } else if (token.startsWith("[") && token.endsWith("]")) {
      runs.push(
        `<w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:b/><w:color w:val="2563EB"/><w:sz w:val="18"/><w:vertAlign w:val="superscript"/></w:rPr><w:t xml:space="preserve">${escapeXml(token)}</w:t></w:r>`,
      );
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    const plain = text.slice(lastIndex);
    runs.push(
      `<w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="22"/></w:rPr><w:t xml:space="preserve">${escapeXml(plain)}</w:t></w:r>`,
    );
  }

  return runs.join("");
}

export function generateDocx(
  content: string,
  options?: BrandedExportOptions,
): Buffer {
  const title = options?.title || "Report";
  const org = options?.organization || "SourceCraft Enterprise";
  const author = options?.author || "SourceCraft AI";
  const dateStr = new Date().toISOString().slice(0, 10);

  const lines = content.split(/\r?\n/);
  const bodyXmlElements: string[] = [];

  // 1. Cover page (if requested or by default if options specified)
  if (options?.includeCoverPage !== false) {
    bodyXmlElements.push(
      `<w:p><w:pPr><w:spacing w:before="2400" w:after="400"/><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:b/><w:sz w:val="56"/><w:color w:val="1E3A8A"/></w:rPr><w:t>${escapeXml(title)}</w:t></w:r></w:p>`,
    );
    if (options?.subtitle) {
      bodyXmlElements.push(
        `<w:p><w:pPr><w:spacing w:before="200" w:after="1200"/><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:i/><w:sz w:val="28"/><w:color w:val="64748B"/></w:rPr><w:t>${escapeXml(options.subtitle)}</w:t></w:r></w:p>`,
      );
    }
    bodyXmlElements.push(
      `<w:p><w:pPr><w:spacing w:before="1800" w:after="200"/><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:b/><w:sz w:val="24"/><w:color w:val="334155"/></w:rPr><w:t>${escapeXml(org)}</w:t></w:r></w:p>`,
    );
    bodyXmlElements.push(
      `<w:p><w:pPr><w:spacing w:before="100" w:after="100"/><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="22"/><w:color w:val="64748B"/></w:rPr><w:t>Author: ${escapeXml(author)}</w:t></w:r></w:p>`,
    );
    bodyXmlElements.push(
      `<w:p><w:pPr><w:spacing w:before="100" w:after="2000"/><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="20"/><w:color w:val="94A3B8"/></w:rPr><w:t>${escapeXml(dateStr)}</w:t></w:r></w:p>`,
    );
    bodyXmlElements.push(`<w:p><w:r><w:br w:type="page"/></w:r></w:p>`);
  }

  // 2. Table of Contents if requested
  const headingList: { level: number; text: string }[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("# ")) {
      headingList.push({ level: 1, text: trimmed.slice(2).trim() });
    } else if (trimmed.startsWith("## ")) {
      headingList.push({ level: 2, text: trimmed.slice(3).trim() });
    } else if (trimmed.startsWith("### ")) {
      headingList.push({ level: 3, text: trimmed.slice(4).trim() });
    }
  }

  if (options?.includeTableOfContents && headingList.length > 0) {
    bodyXmlElements.push(
      `<w:p><w:pPr><w:pStyle w:val="Heading1"/><w:spacing w:before="240" w:after="240"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="32"/><w:color w:val="1E3A8A"/></w:rPr><w:t>Table of Contents</w:t></w:r></w:p>`,
    );
    for (const h of headingList) {
      const indent = (h.level - 1) * 360;
      bodyXmlElements.push(
        `<w:p><w:pPr><w:ind w:left="${indent}"/><w:spacing w:after="100"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="22"/><w:color w:val="2563EB"/></w:rPr><w:t>${escapeXml(h.text)}</w:t></w:r></w:p>`,
      );
    }
    bodyXmlElements.push(`<w:p><w:r><w:br w:type="page"/></w:r></w:p>`);
  }

  // 3. Document Body
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
      const tableRows: string[][] = [];
      while (
        i < lines.length &&
        lines[i].trim().startsWith("|") &&
        lines[i].trim().endsWith("|")
      ) {
        const rowLine = lines[i].trim();
        // Check if separator line e.g. |---|---|
        if (!/^[|\s:-]+$/.test(rowLine)) {
          const cells = rowLine
            .slice(1, -1)
            .split("|")
            .map((c) => c.trim());
          tableRows.push(cells);
        }
        i++;
      }

      if (tableRows.length > 0) {
        const tblXml: string[] = [
          `<w:tbl>`,
          `<w:tblPr><w:tblW w:w="0" w:type="auto"/><w:tblBorders><w:top w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/><w:left w:val="none"/><w:bottom w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/><w:right w:val="none"/><w:insideH w:val="single" w:sz="4" w:space="0" w:color="E2E8F0"/><w:insideV w:val="none"/></w:tblBorders></w:tblPr>`,
        ];

        tableRows.forEach((row, rowIndex) => {
          const isHeader = rowIndex === 0;
          tblXml.push(`<w:tr>`);
          row.forEach((cell) => {
            const shd = isHeader
              ? `<w:shd w:val="clear" w:color="auto" w:fill="F1F5F9"/>`
              : "";
            const bold = isHeader ? `<w:b/>` : "";
            tblXml.push(
              `<w:tc><w:tcPr>${shd}<w:tcMar><w:top w:w="120" w:type="dxa"/><w:bottom w:w="120" w:type="dxa"/><w:left w:w="160" w:type="dxa"/><w:right w:w="160" w:type="dxa"/></w:tcMar></w:tcPr><w:p><w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/>${bold}<w:sz w:val="20"/></w:rPr><w:t>${escapeXml(cell)}</w:t></w:r></w:p></w:tc>`,
            );
          });
          tblXml.push(`</w:tr>`);
        });

        tblXml.push(`</w:tbl>`);
        bodyXmlElements.push(tblXml.join(""));
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
      if (i < lines.length) i++; // Skip closing ```

      const codeText = codeLines.join("\n");
      bodyXmlElements.push(
        `<w:p><w:pPr><w:pBdr><w:left w:val="single" w:sz="18" w:space="8" w:color="3B82F6"/></w:pBdr><w:shd w:val="clear" w:color="auto" w:fill="F8FAFC"/><w:spacing w:before="120" w:after="120"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/><w:sz w:val="18"/><w:color w:val="0F172A"/></w:rPr><w:t xml:space="preserve">${escapeXml(codeText)}</w:t></w:r></w:p>`,
      );
      continue;
    }

    // Headings
    if (trimmed.startsWith("# ")) {
      bodyXmlElements.push(
        `<w:p><w:pPr><w:pStyle w:val="Heading1"/><w:spacing w:before="360" w:after="160"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:b/><w:sz w:val="36"/><w:color w:val="1E3A8A"/></w:rPr><w:t>${escapeXml(trimmed.slice(2).trim())}</w:t></w:r></w:p>`,
      );
    } else if (trimmed.startsWith("## ")) {
      bodyXmlElements.push(
        `<w:p><w:pPr><w:pStyle w:val="Heading2"/><w:spacing w:before="280" w:after="120"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:b/><w:sz w:val="28"/><w:color w:val="1E293B"/></w:rPr><w:t>${escapeXml(trimmed.slice(3).trim())}</w:t></w:r></w:p>`,
      );
    } else if (trimmed.startsWith("### ")) {
      bodyXmlElements.push(
        `<w:p><w:pPr><w:pStyle w:val="Heading3"/><w:spacing w:before="200" w:after="80"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:b/><w:sz w:val="24"/><w:color w:val="334155"/></w:rPr><w:t>${escapeXml(trimmed.slice(4).trim())}</w:t></w:r></w:p>`,
      );
    } else if (trimmed.startsWith("> ")) {
      // Blockquote / Callout
      bodyXmlElements.push(
        `<w:p><w:pPr><w:pBdr><w:left w:val="single" w:sz="24" w:space="12" w:color="3B82F6"/></w:pBdr><w:shd w:val="clear" w:color="auto" w:fill="F8FAFC"/><w:spacing w:before="120" w:after="120"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:i/><w:sz w:val="22"/><w:color w:val="475569"/></w:rPr><w:t>${escapeXml(trimmed.slice(2).trim())}</w:t></w:r></w:p>`,
      );
    } else if (/^[-*]\s+/.test(trimmed)) {
      // Bullet list
      const bulletText = trimmed.replace(/^[-*]\s+/, "");
      bodyXmlElements.push(
        `<w:p><w:pPr><w:ind w:left="360" w:hanging="240"/><w:spacing w:after="80"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="22"/></w:rPr><w:t>• </w:t></w:r>${parseInlineRuns(bulletText)}</w:p>`,
      );
    } else if (/^\d+\.\s+/.test(trimmed)) {
      // Numbered list
      const numMatch = trimmed.match(/^(\d+\.)\s+(.*)$/);
      const prefix = numMatch ? numMatch[1] : "1.";
      const numText = numMatch ? numMatch[2] : trimmed;
      bodyXmlElements.push(
        `<w:p><w:pPr><w:ind w:left="360" w:hanging="240"/><w:spacing w:after="80"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:b/><w:sz w:val="22"/></w:rPr><w:t>${escapeXml(prefix)} </w:t></w:r>${parseInlineRuns(numText)}</w:p>`,
      );
    } else {
      // Regular paragraph
      bodyXmlElements.push(
        `<w:p><w:pPr><w:spacing w:after="140" w:line="276" w:lineRule="auto"/></w:pPr>${parseInlineRuns(trimmed)}</w:p>`,
      );
    }

    i++;
  }

  // Section properties (A4 size, margins, header/footer references)
  const headerText = options?.headerText || org;
  const footerText = options?.footerText || `${title} · Confidential`;

  const sectPr = `<w:sectPr><w:headerReference w:type="default" r:id="rId2"/><w:footerReference w:type="default" r:id="rId3"/><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr>`;

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>
    ${bodyXmlElements.join("\n    ")}
    ${sectPr}
  </w:body>
</w:document>`;

  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>
  <Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>
</Types>`;

  const relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

  const docRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>
</Relationships>`;

  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault>
      <w:rPr>
        <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/>
        <w:sz w:val="22"/>
        <w:color w:val="1E293B"/>
        <w:lang w:val="vi-VN"/>
      </w:rPr>
    </w:rPrDefault>
  </w:docDefaults>
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
    <w:name w:val="Normal"/>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading1">
    <w:name w:val="heading 1"/>
    <w:basedOn w:val="Normal"/>
    <w:rPr>
      <w:b/>
      <w:sz w:val="36"/>
      <w:color w:val="1E3A8A"/>
    </w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading2">
    <w:name w:val="heading 2"/>
    <w:basedOn w:val="Normal"/>
    <w:rPr>
      <w:b/>
      <w:sz w:val="28"/>
      <w:color w:val="1E293B"/>
    </w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading3">
    <w:name w:val="heading 3"/>
    <w:basedOn w:val="Normal"/>
    <w:rPr>
      <w:b/>
      <w:sz w:val="24"/>
      <w:color w:val="334155"/>
    </w:rPr>
  </w:style>
</w:styles>`;

  const headerXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:p>
    <w:pPr>
      <w:jc w:val="right"/>
      <w:pBdr>
        <w:bottom w:val="single" w:sz="6" w:space="4" w:color="CBD5E1"/>
      </w:pBdr>
    </w:pPr>
    <w:r>
      <w:rPr>
        <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/>
        <w:color w:val="64748B"/>
        <w:sz w:val="18"/>
      </w:rPr>
      <w:t>${escapeXml(headerText)}</w:t>
    </w:r>
  </w:p>
</w:hdr>`;

  const footerXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:p>
    <w:pPr>
      <w:pBdr>
        <w:top w:val="single" w:sz="6" w:space="4" w:color="CBD5E1"/>
      </w:pBdr>
      <w:tabs>
        <w:tab w:val="right" w:pos="9000"/>
      </w:tabs>
    </w:pPr>
    <w:r>
      <w:rPr>
        <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/>
        <w:color w:val="64748B"/>
        <w:sz w:val="18"/>
      </w:rPr>
      <w:t>${escapeXml(footerText)}</w:t>
    </w:r>
    <w:r>
      <w:tab/>
      <w:rPr>
        <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/>
        <w:color w:val="64748B"/>
        <w:sz w:val="18"/>
      </w:rPr>
      <w:t>Page </w:t>
    </w:r>
    <w:fldSimple w:instr="PAGE"/>
    <w:r>
      <w:rPr>
        <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/>
        <w:color w:val="64748B"/>
        <w:sz w:val="18"/>
      </w:rPr>
      <w:t> / </w:t>
    </w:r>
    <w:fldSimple w:instr="NUMPAGES"/>
  </w:p>
</w:ftr>`;

  const entries: ZipEntry[] = [
    { path: "[Content_Types].xml", data: contentTypesXml },
    { path: "_rels/.rels", data: relsXml },
    { path: "word/_rels/document.xml.rels", data: docRelsXml },
    { path: "word/document.xml", data: documentXml },
    { path: "word/styles.xml", data: stylesXml },
    { path: "word/header1.xml", data: headerXml },
    { path: "word/footer1.xml", data: footerXml },
  ];

  return buildZip(entries);
}
