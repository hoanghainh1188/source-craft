import { describe, it, expect } from "vitest";
import { markdownToHtml } from "../../src/main/services/studio/export/pdf-generator";

describe("markdownToHtml (232 branded export)", () => {
  it("converts markdown content to professional HTML template", () => {
    const md = `# Tổng quan Báo Cáo

Nội dung đoạn văn với trích dẫn [1].

| Tiêu đề 1 | Tiêu đề 2 |
| --- | --- |
| Dữ liệu A | Dữ liệu B |

> Khối chú thích quan trọng.

\`\`\`typescript
const x = 42;
\`\`\`
`;

    const html = markdownToHtml(md, {
      title: "Báo Cáo Nghiên Cứu",
      subtitle: "Phân tích số liệu Q3",
      organization: "Bệnh Viện Trung Ương",
      author: "Bác Sĩ Trưởng Khoa",
      includeCoverPage: true,
    });

    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("Bệnh Viện Trung Ương");
    expect(html).toContain("Báo Cáo Nghiên Cứu");
    expect(html).toContain("Phân tích số liệu Q3");
    expect(html).toContain("Bác Sĩ Trưởng Khoa");
    expect(html).toContain("<table>");
    expect(html).toContain("<th>Tiêu đề 1</th>");
    expect(html).toContain("<td>Dữ liệu A</td>");
    expect(html).toContain(
      "<blockquote>Khối chú thích quan trọng.</blockquote>",
    );
    expect(html).toContain("<code>const x = 42;</code>");
    expect(html).toContain('<span class="citation">[1]</span>');
  });

  it("omits cover page when includeCoverPage is false", () => {
    const html = markdownToHtml("Chỉ có nội dung văn bản.", {
      includeCoverPage: false,
    });
    expect(html).not.toContain('class="cover-page"');
    expect(html).toContain("Chỉ có nội dung văn bản.");
  });

  // 233 (T019, FR-011, D6): xuất documentDiff HTML có bảng chứa [n] trong ô
  it("converts documentDiff GFM table with citations in cells to HTML", () => {
    const diffMarkdown = `## 4. Điều khoản sửa đổi & phân tích rủi ro

| Điều khoản | Bản gốc | Bản sửa đổi | Ảnh hưởng / rủi ro |
| --- | --- | --- | --- |
| Điều 5 | 30 ngày [1] | 15 ngày [2] | Rủi ro dòng tiền [1, 2] |
`;
    const html = markdownToHtml(diffMarkdown, {
      title: "So sánh văn bản",
      includeCoverPage: false,
    });
    expect(html).toContain("<table>");
    expect(html).toContain("<th>Điều khoản</th>");
    expect(html).toContain("<th>Bản gốc</th>");
    expect(html).toContain("<th>Bản sửa đổi</th>");
    expect(html).toContain("<th>Ảnh hưởng / rủi ro</th>");
    expect(html).toContain('<span class="citation">[1]</span>');
    expect(html).toContain('<span class="citation">[2]</span>');
  });
});
