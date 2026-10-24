import { describe, it, expect } from "vitest";
import mammoth from "mammoth";
import { generateDocx } from "../../src/main/services/studio/export/docx-generator";

describe("generateDocx (232 branded export)", () => {
  it("generates a valid DOCX buffer parsable by mammoth", async () => {
    const markdown = `# Báo Cáo Thẩm Định Hợp Đồng

Dưới đây là bảng tổng hợp các điều khoản trọng yếu [1]:

| Điều khoản | Nội dung | Mức độ rủi ro |
| :--- | :--- | :--- |
| Điều 5 | Thanh toán trong vòng 30 ngày | Thấp |
| Điều 12 | Trọng tài quốc tế VIAC | Trung bình |

> Chú ý: Cần làm rõ phạm vi bảo lãnh của ngân hàng.

- Điểm a: Nghĩa vụ giao hàng đúng hạn
- Điểm b: Phạt vi phạm 8% giá trị vi phạm
1. Bước 1: Rà soát phụ lục
2. Bước 2: Ký duyệt biên bản
`;

    const docxBuf = generateDocx(markdown, {
      title: "Báo Cáo Thẩm Định Hợp Đồng",
      subtitle: "Phân tích rủi ro pháp lý năm 2026",
      organization: "Công Ty Luật Hợp Danh Á Châu",
      author: "Luật sư Trưởng",
      includeCoverPage: true,
      includeTableOfContents: true,
    });

    expect(Buffer.isBuffer(docxBuf)).toBe(true);
    expect(docxBuf.length).toBeGreaterThan(500);

    // Verify it starts with standard ZIP header PK\x03\x04
    expect(docxBuf[0]).toBe(0x50);
    expect(docxBuf[1]).toBe(0x4b);
    expect(docxBuf[2]).toBe(0x03);
    expect(docxBuf[3]).toBe(0x04);

    // Verify text can be extracted via mammoth
    const extracted = await mammoth.extractRawText({ buffer: docxBuf });
    expect(extracted.value).toContain("Báo Cáo Thẩm Định Hợp Đồng");
    expect(extracted.value).toContain("Công Ty Luật Hợp Danh Á Châu");
    expect(extracted.value).toContain("Thanh toán trong vòng 30 ngày");
    expect(extracted.value).toContain("Trọng tài quốc tế VIAC");
    expect(extracted.value).toContain("Phạt vi phạm 8% giá trị vi phạm");
  });

  it("handles empty or simple markdown without cover page", async () => {
    const docxBuf = generateDocx("Tóm tắt ngắn gọn.", {
      includeCoverPage: false,
    });
    expect(Buffer.isBuffer(docxBuf)).toBe(true);
    const extracted = await mammoth.extractRawText({ buffer: docxBuf });
    expect(extracted.value).toContain("Tóm tắt ngắn gọn.");
  });
});
