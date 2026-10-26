import { afterEach, describe, it, expect, vi } from "vitest";
import {
  assertDomainModeAvailable,
  domainDirectives,
  groundedSystemPrompt,
  openSystemPrompt,
  systemPromptFor,
  withMedicalDisclaimer,
  MEDICAL_DISCLAIMER_VI,
  MEDICAL_DISCLAIMER_EN,
} from "../../../src/main/services/rag/prompt";
import { ProUnavailableError } from "../../../src/main/services/pro-bridge/pro-unavailable";
import { setFakeProAvailable } from "../helpers/fake-pro";

// 248 (đợt 2): nội dung chỉ dẫn chuyên gia (Pháp lý / Y tế) nằm ở module Pro — test nội dung ở repo source-craft-pro.
// Ở đây dùng module Pro GIẢ (chuỗi đánh dấu) để kiểm phần ghép prompt + cổng stub của core.
vi.mock("../../../src/main/pro", () => import("../helpers/fake-pro"));

afterEach(() => setFakeProAvailable(true));

describe("238 — Domain-specific prompts & directives", () => {
  describe("domainDirectives", () => {
    it("chế độ general hoặc undefined → trả về mảng rỗng (không gọi module Pro)", () => {
      setFakeProAvailable(false);
      expect(domainDirectives(undefined)).toEqual([]);
      expect(domainDirectives("general")).toEqual([]);
    });

    it("chế độ legal / medical → chỉ dẫn do module Pro trả theo ngôn ngữ", () => {
      expect(domainDirectives("legal", "vi")).toEqual([
        "[fake-pro:domain:legal:vi]",
      ]);
      expect(domainDirectives("medical", "en")).toEqual([
        "[fake-pro:domain:medical:en]",
      ]);
    });
  });

  describe("groundedSystemPrompt & openSystemPrompt với domainMode", () => {
    it("grounded: chỉ dẫn chuyên gia đứng ngay sau dòng vai trò, vẫn giữ context và câu không tìm thấy", () => {
      const lines = groundedSystemPrompt(
        "[1] Điều 5 Hợp đồng",
        "vi",
        "legal",
      ).split("\n");
      expect(lines[0]).toContain("ONLY from the numbered source passages");
      expect(lines[1]).toBe("[fake-pro:domain:legal:vi]");
      expect(lines).toContain("[1] Điều 5 Hợp đồng");
      expect(lines.join("\n")).toContain("Không tìm thấy trong nguồn.");
    });

    it("open: chỉ dẫn chuyên gia + nhãn ngoài nguồn", () => {
      const prompt = openSystemPrompt(
        "[1] Hướng dẫn lâm sàng",
        "en",
        "medical",
      );
      expect(prompt.split("\n")[1]).toBe("[fake-pro:domain:medical:en]");
      expect(prompt).toContain("(not based on sources)");
    });

    it("general ⇒ prompt không có dòng chuyên gia", () => {
      expect(groundedSystemPrompt("x", "vi", "general")).toBe(
        groundedSystemPrompt("x", "vi"),
      );
    });

    it("systemPromptFor điều phối chính xác giữa grounded và open", () => {
      const g = systemPromptFor("grounded", "context", "vi", "legal");
      expect(g).toContain("[fake-pro:domain:legal:vi]");
      expect(g).toContain("ONLY from the numbered source passages");

      const o = systemPromptFor("open", "context", "vi", "medical");
      expect(o).toContain("[fake-pro:domain:medical:vi]");
      expect(o).toContain("(không dựa trên nguồn)");
    });
  });

  describe("248: bản không có module Pro", () => {
    it("chế độ chuyên gia ⇒ ProUnavailableError; general / không chọn vẫn chạy", () => {
      setFakeProAvailable(false);
      for (const mode of ["legal", "medical"] as const) {
        expect(() => assertDomainModeAvailable(mode, "vi")).toThrow(
          ProUnavailableError,
        );
        expect(() => groundedSystemPrompt("x", "vi", mode)).toThrow(
          ProUnavailableError,
        );
      }
      expect(() => assertDomainModeAvailable("general", "vi")).not.toThrow();
      expect(() => assertDomainModeAvailable(undefined, "vi")).not.toThrow();
      expect(groundedSystemPrompt("x", "vi", "general")).toContain("x");
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
