import { describe, it, expect } from "vitest";
import {
  domainDirectives,
  groundedSystemPrompt,
  openSystemPrompt,
  systemPromptFor,
  withMedicalDisclaimer,
  MEDICAL_DISCLAIMER_VI,
  MEDICAL_DISCLAIMER_EN,
} from "../../../src/main/services/rag/prompt";

describe("238 — Domain-specific prompts & directives", () => {
  describe("domainDirectives", () => {
    it("chế độ general hoặc undefined → trả về mảng rỗng", () => {
      expect(domainDirectives(undefined)).toEqual([]);
      expect(domainDirectives("general")).toEqual([]);
    });

    it("chế độ legal (tiếng Việt) → chứa chỉ dẫn trích dẫn Điều, Khoản, Điểm và phân biệt nghĩa vụ/quyền", () => {
      const dirs = domainDirectives("legal", "vi");
      expect(dirs.length).toBeGreaterThan(0);
      const text = dirs.join("\n");
      expect(text).toContain("Legal and Contract AI assistant");
      expect(text).toContain("Điều");
      expect(text).toContain("Khoản");
      expect(text).toContain("Điểm");
      expect(text).toContain("phải");
      expect(text).toContain("được quyền");
      expect(text).toContain("không được");
      expect(text).toContain("ZERO EXTRAPOLATION");
    });

    it("chế độ legal (tiếng Anh) → chứa chỉ dẫn trích dẫn Article, Clause, Section thuần tiếng Anh", () => {
      const dirs = domainDirectives("legal", "en");
      const text = dirs.join("\n");
      expect(text).toContain("Legal and Contract AI assistant");
      expect(text).toContain("Article");
      expect(text).toContain("Section");
      expect(text).toContain("Clause");
      expect(text).toContain("shall");
      expect(text).toContain("ZERO EXTRAPOLATION");
      const VI =
        /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i;
      expect(text).not.toMatch(VI);
    });

    it("chế độ medical (tiếng Việt) → chỉ dẫn y khoa, KHÔNG bắt model tự chép disclaimer", () => {
      const dirs = domainDirectives("medical", "vi");
      const text = dirs.join("\n");
      expect(text).toContain("Medical and Clinical Knowledge AI assistant");
      expect(text).toContain("CLINICAL GROUNDING");
      expect(text).not.toContain(MEDICAL_DISCLAIMER_VI);
    });

    it("chế độ medical (tiếng Anh) → chỉ dẫn y khoa thuần tiếng Anh", () => {
      const dirs = domainDirectives("medical", "en");
      const text = dirs.join("\n");
      expect(text).toContain("Medical and Clinical Knowledge AI assistant");
      expect(text).toContain("CLINICAL GROUNDING");
      expect(text).not.toContain(MEDICAL_DISCLAIMER_EN);
      const VI =
        /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i;
      expect(text).not.toMatch(VI);
    });
  });

  describe("groundedSystemPrompt & openSystemPrompt với domainMode", () => {
    it("grounded với legal mode chèn đầy đủ persona và context", () => {
      const prompt = groundedSystemPrompt("[1] Điều 5 Hợp đồng", "vi", "legal");
      expect(prompt).toContain("Legal and Contract AI assistant");
      expect(prompt).toContain("[1] Điều 5 Hợp đồng");
      expect(prompt).toContain("Không tìm thấy trong nguồn.");
    });

    it("grounded với medical mode chèn persona y khoa", () => {
      const prompt = groundedSystemPrompt(
        "[1] Phác đồ điều trị",
        "vi",
        "medical",
      );
      expect(prompt).toContain("Medical and Clinical Knowledge AI assistant");
      expect(prompt).toContain("[1] Phác đồ điều trị");
    });

    it("open mode với medical mode chèn persona y khoa và nhãn ngoài nguồn", () => {
      const prompt = openSystemPrompt(
        "[1] Hướng dẫn lâm sàng",
        "en",
        "medical",
      );
      expect(prompt).toContain("Medical and Clinical Knowledge AI assistant");
      expect(prompt).toContain("(not based on sources)");
    });

    it("systemPromptFor điều phối chính xác giữa grounded và open", () => {
      const g = systemPromptFor("grounded", "context", "vi", "legal");
      expect(g).toContain("Legal and Contract AI assistant");
      expect(g).toContain("ONLY from the numbered source passages");

      const o = systemPromptFor("open", "context", "vi", "medical");
      expect(o).toContain("Medical and Clinical Knowledge AI assistant");
      expect(o).toContain("(không dựa trên nguồn)");
    });
  });

  describe("withMedicalDisclaimer — app gắn cố định", () => {
    it("gắn disclaimer theo ngôn ngữ câu hỏi ở cuối câu trả lời", () => {
      expect(withMedicalDisclaimer("Liều 500mg [1].", "vi")).toBe(
        `Liều 500mg [1].\n\n${MEDICAL_DISCLAIMER_VI}`,
      );
      expect(withMedicalDisclaimer("Dose 500mg [1].", "en")).toBe(
        `Dose 500mg [1].\n\n${MEDICAL_DISCLAIMER_EN}`,
      );
      expect(withMedicalDisclaimer("Dose [1].")).toBe(
        `Dose [1].\n\n${MEDICAL_DISCLAIMER_EN}`,
      );
    });

    it("model đã tự chép disclaimer (có/không ngoặc kép) ⇒ không lặp", () => {
      const out = withMedicalDisclaimer(
        `Liều 500mg [1].\n"${MEDICAL_DISCLAIMER_VI}"\n${MEDICAL_DISCLAIMER_EN}`,
        "vi",
      );
      expect(out).toBe(`Liều 500mg [1].\n\n${MEDICAL_DISCLAIMER_VI}`);
      expect(out.split(MEDICAL_DISCLAIMER_VI)).toHaveLength(2);
    });
  });
});
