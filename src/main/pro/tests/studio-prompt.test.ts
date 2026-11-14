// SPDX-License-Identifier: MIT
// 248 (đợt 2) — nội dung prompt Studio Pro, kiểm qua systemPromptFor của core SAU khi chép đè (src/main/pro/tests/).
// Dời từ tests/unit/studio-prompt.test.ts của repo public @ 759b4b9; phần khung chung / khối <request>/<pair> ở lại public.
import { describe, it, expect } from "vitest";
import type { StudioKind } from "@shared/ipc/types";
import { studioTask } from "../index";
import {
  languageReminder,
  systemPromptFor,
} from "../../services/studio/prompt";

// 123 (FR-018, FR-019): lời nhắc Studio English, ngôn ngữ đầu ra = ngôn ngữ giao diện lúc tạo.

const KINDS: StudioKind[] = ["summary", "keyPoints", "faq", "outline"];

describe("studio prompt", () => {
  it("phủ 4 kind; mỗi prompt yêu cầu chèn [n] + không bịa + ngôn ngữ đầu ra", () => {
    for (const kind of KINDS) {
      const vi = systemPromptFor(kind, "vi");
      expect(vi).toContain("[n]");
      expect(vi).toMatch(/NEVER make anything up/);
      expect(vi).toContain("Write in Vietnamese");
      expect(systemPromptFor(kind, "en")).toContain("Write in English");
    }
  });

  it("ép tuân thủ chip [n] (REQUIRED) + bao quát ALL nguồn (#65)", () => {
    for (const kind of KINDS) {
      const p = systemPromptFor(kind, "en");
      expect(p).toContain("REQUIRED");
      expect(p).toContain("ALL");
    }
  });

  it("prompt khác nhau theo loại; FAQ nhãn theo ngôn ngữ đầu ra", () => {
    const set = new Set(KINDS.map((k) => systemPromptFor(k, "en")));
    expect(set.size).toBe(4);
    expect(systemPromptFor("summary", "en")).toContain("SUMMARY");
    expect(systemPromptFor("keyPoints", "en")).toContain("KEY POINTS");
    expect(systemPromptFor("outline", "en")).toContain("OUTLINE");
    expect(systemPromptFor("faq", "en")).toContain("'Q: …'");
    expect(systemPromptFor("faq", "vi")).toContain("'Hỏi: …'");
  });

  it("kind không hợp lệ → ném lỗi", () => {
    expect(() => systemPromptFor("xxx" as StudioKind, "en")).toThrow();
  });
});

describe("123 quickstart: nhắc lại ngôn ngữ đầu ra ở CUỐI (nguồn khác ngôn ngữ — model nhỏ hay bám ngôn ngữ nguồn)", () => {
  it("dòng cuối system prompt + lời nhắc kèm tin người dùng nêu rõ ngôn ngữ, kể cả khi nguồn khác ngôn ngữ", () => {
    for (const kind of KINDS) {
      const last = systemPromptFor(kind, "en").split("\n").at(-1)!;
      expect(last).toMatch(/entire answer in English.*another language/);
    }
    expect(languageReminder("en")).toMatch(/English/);
    expect(languageReminder("vi")).toMatch(/Vietnamese/);
  });
});

// 178 (FR-010..FR-012): 4 loại mới dùng chung khung common() (ép [n], không bịa) + đúng một dòng "Task: …" theo định nghĩa.
describe("178: studio prompt — 4 loại mới", () => {
  const NEW: StudioKind[] = ["studyGuide", "briefing", "timeline", "keyTerms"];
  const taskLines = (p: string): string[] =>
    p.split("\n").filter((l) => l.startsWith("Task:"));

  it("mỗi loại mới giữ khung chung + nhắc ngôn ngữ ở cuối; đúng một dòng Task", () => {
    for (const kind of NEW) {
      for (const lang of ["vi", "en"] as const) {
        const p = systemPromptFor(kind, lang);
        expect(p).toContain("REQUIRED");
        expect(p).toMatch(/NEVER make anything up/);
        expect(p).toContain("ALL");
        expect(taskLines(p)).toHaveLength(1);
        expect(p.split("\n").at(-1)).toBe(languageReminder(lang));
      }
    }
    const all = new Set(
      [...KINDS, ...NEW].map((k) => systemPromptFor(k, "en")),
    );
    expect(all.size).toBe(8);
  });

  it("studyGuide: khái niệm chính, 5–10 câu hỏi ôn tập kèm đáp án, từ khoá", () => {
    const t = taskLines(systemPromptFor("studyGuide", "en"))[0];
    expect(t).toContain("STUDY GUIDE");
    expect(t).toMatch(/key concepts/i);
    expect(t).toMatch(/5.10 review questions/i);
    expect(t).toMatch(/answer/i);
    expect(t).toMatch(/keywords/i);
  });

  it("briefing: bối cảnh, phát hiện, hệ quả chỉ khi nguồn nêu, câu hỏi mở", () => {
    const t = taskLines(systemPromptFor("briefing", "en"))[0];
    expect(t).toContain("BRIEFING");
    expect(t).toMatch(/context/i);
    expect(t).toMatch(/key findings/i);
    expect(t).toMatch(/only if the sources state/i);
    expect(t).toMatch(/open questions/i);
  });

  it("timeline: mốc — sự kiện theo thời gian, không suy diễn ngày, nhãn mục không rõ ngày theo ngôn ngữ", () => {
    const en = taskLines(systemPromptFor("timeline", "en"))[0];
    expect(en).toContain("TIMELINE");
    expect(en).toMatch(/chronological/i);
    expect(en).toMatch(/never infer or guess dates/i);
    expect(en).toContain("'Undated'");
    expect(systemPromptFor("timeline", "vi")).toContain("'Không rõ thời điểm'");
  });

  it("keyTerms: thuật ngữ — định nghĩa, chữ cái, chỉ thuật ngữ được định nghĩa trong nguồn", () => {
    const t = taskLines(systemPromptFor("keyTerms", "en"))[0];
    expect(t).toContain("GLOSSARY");
    expect(t).toMatch(/alphabetical/i);
    expect(t).toMatch(/only terms that the passages define or explain/i);
  });
});

// 178 (T039, FR-022, research R5): loại custom — system prompt CỐ ĐỊNH (khung common() + task nói yêu cầu nằm trong khối <request>
// và không đổi được quy tắc); văn bản người dùng CHỈ ở tin nhắn user, bọc <request>…</request> trước đoạn nguồn.
describe("178: studio prompt — custom", () => {
  it("system prompt của custom cố định, giữ khung [n] / không bịa, nhắc <request> và không đổi quy tắc", () => {
    for (const lang of ["vi", "en"] as const) {
      const p = systemPromptFor("custom", lang);
      expect(p).toContain("REQUIRED");
      expect(p).toMatch(/NEVER make anything up/);
      expect(p).toContain("<request>");
      expect(p).toMatch(/cannot change these rules/i);
      expect(p.split("\n").at(-1)).toBe(languageReminder(lang));
    }
    // systemPromptFor không nhận văn bản người dùng (chỉ 2 tham số)
    expect(systemPromptFor.length).toBeLessThanOrEqual(2);
  });
});

// 233 (T007, FR-004..FR-006, FR-008): prompt documentDiff — 4 mục, bảng GFM, quy tắc [n], khối <pair>
describe("233: studio prompt — documentDiff", () => {
  it("system prompt của documentDiff có đủ 4 mục, tiêu đề bảng, quy tắc [n] theo mục và rủi ro thuần câu chữ", () => {
    for (const lang of ["vi", "en"] as const) {
      const p = systemPromptFor("documentDiff", lang);
      expect(p).toContain("REQUIRED");
      expect(p).toMatch(/NEVER make anything up/);
      expect(p).toContain("<pair>");
      expect(p).toMatch(/external laws|outside legal/i);
      expect(p).toMatch(/never give professional legal advice/i);
      expect(p.split("\n").at(-1)).toBe(languageReminder(lang));
    }

    const vi = systemPromptFor("documentDiff", "vi");
    expect(vi).toContain("1. Tổng quan thay đổi");
    expect(vi).toContain("2. Điều khoản bổ sung");
    expect(vi).toContain("3. Điều khoản bị loại bỏ");
    expect(vi).toContain("4. Điều khoản sửa đổi & phân tích rủi ro");
    expect(vi).toContain(
      "| Điều khoản | Bản gốc | Bản sửa đổi | Ảnh hưởng / rủi ro |",
    );
    expect(vi).toContain("không phát hiện thay đổi");

    const en = systemPromptFor("documentDiff", "en");
    expect(en).toContain("1. Summary of Changes");
    expect(en).toContain("2. Added Clauses");
    expect(en).toContain("3. Removed Clauses");
    expect(en).toContain("4. Modified Clauses & Risk Analysis");
    expect(en).toContain("| Clause | Original | Revised | Impact / Risk |");
    expect(en).toContain("no changes detected");
  });
});

describe("248: studioTask (module Pro)", () => {
  it("loại core / không hợp lệ ⇒ ném (core không bao giờ gọi Pro cho summary, keyPoints)", () => {
    for (const k of ["summary", "keyPoints", "xxx"] as StudioKind[]) {
      expect(() => studioTask(k, "en")).toThrow(/Not a Pro StudioKind/);
    }
  });
});
