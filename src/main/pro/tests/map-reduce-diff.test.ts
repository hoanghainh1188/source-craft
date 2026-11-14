// SPDX-License-Identifier: MIT
// 248 (đợt 2) — map-reduce của So sánh văn bản với prompt diff + pickDiffBatches của module Pro, chạy qua runMapReduce của
// core (src/main/pro/tests/). Dời từ tests/unit/studio-map-reduce.test.ts của repo public @ 759b4b9.
import { describe, it, expect, vi } from "vitest";
import { runMapReduce } from "../../services/studio/map-reduce";
import type { ScoredChunk } from "../../services/rag/rag-types";
import type { ChatMessage } from "@shared/ipc/types";
import { pickDiffBatches } from "../index";

// 105 — map-reduce GIỮ [n] tới ĐÚNG ĐOẠN (ADR studio-large-clarify): đánh số TOÀN CỤC, ghi chú theo lô kèm [n]
// (hậu kiểm theo lô), bước cuối giữ nguyên [n] ⇒ chip trỏ đoạn thật — khác phương án đã bác (citation mức nguồn).

function chunk(sourceId: string, ordinal: number, text: string): ScoredChunk {
  return {
    chunk: {
      id: `${sourceId}-${ordinal}`,
      sourceId,
      notebookId: "nb1",
      ordinal,
      text,
      locator: {
        page: 1,
        charStart: ordinal * 100,
        charEnd: ordinal * 100 + text.length,
      },
    },
    sourceTitle: `Tài liệu ${sourceId}`,
    score: 0,
  } as unknown as ScoredChunk;
}

const groups = (perSource: number, len = 400): ScoredChunk[][] =>
  ["A", "B"].map((s) =>
    Array.from({ length: perSource }, (_, i) =>
      chunk(s, i, `${s}${i} `.repeat(len / 4)),
    ),
  );

describe("233: map-reduce documentDiff", () => {
  it("đóng lô theo từng nguồn, map prompt riêng trích gần nguyên văn và gắn nhãn vai trò", async () => {
    const calls: ChatMessage[][] = [];
    const chat = vi.fn(async (messages: ChatMessage[]) => {
      calls.push(messages);
      const sys = messages[0].content;
      const user = messages[1].content;
      const ns = [...user.matchAll(/\[(\d+)\]/g)].map((m) => Number(m[1]));
      if (sys.includes("CLAUSES")) {
        return ns
          .map(
            (n) => `- Điều khoản số ${n} giá trị 100tr thời hạn 30 ngày [${n}]`,
          )
          .join("\n");
      }
      return `Kết quả đối chiếu [${ns[0]}].`;
    });

    const diffGroups = [
      [chunk("A", 0, "A0 ".repeat(60)), chunk("A", 1, "A1 ".repeat(60))],
      [chunk("B", 0, "B0 ".repeat(60)), chunk("B", 1, "B1 ".repeat(60))],
    ];

    const out = await runMapReduce({
      kind: "documentDiff",
      groups: diffGroups,
      budget: 300,
      chat,
      outputLanguage: "vi",
      diffPair: {
        baseTitle: "HopDong_Goc.pdf",
        revisedTitle: "HopDong_SuaDoi.pdf",
      },
    });

    expect(out.parts).toBeGreaterThan(1);
    const mapCalls = calls.slice(0, -1);
    const finalCall = calls[calls.length - 1];

    // Không lô nào trộn đoạn của cả hai nguồn
    for (const c of mapCalls) {
      const userContent = c[1].content;
      const hasA = userContent.includes("Tài liệu A");
      const hasB = userContent.includes("Tài liệu B");
      expect(hasA && hasB).toBe(false);

      // Map prompt trích gần nguyên văn
      expect(c[0].content).toContain("CLAUSES");
      expect(c[0].content).toMatch(/near-verbatim|exact clause/i);
    }

    // Ghi chú bước cuối có gắn nhãn vai trò
    const finalUser = finalCall[1].content;
    expect(finalUser).toContain("[Bản gốc]");
    expect(finalUser).toContain("[Bản sửa đổi]");
    // Khối <pair> xuất hiện
    expect(finalUser).toContain("<pair>");
    expect(finalUser).toContain("HopDong_Goc.pdf");
    expect(finalUser).toContain("HopDong_SuaDoi.pdf");
  });

  it("loại khác (summary) không bị ảnh hưởng: dùng mapPrompt thường và không gắn nhãn vai trò", async () => {
    const calls: ChatMessage[][] = [];
    const chat = vi.fn(async (messages: ChatMessage[]) => {
      calls.push(messages);
      const ns = [...messages[1].content.matchAll(/\[(\d+)\]/g)].map((m) =>
        Number(m[1]),
      );
      if (messages[0].content.startsWith("Extract NOTES")) {
        return `- ý [${ns[0]}]`;
      }
      return `Kết quả [${ns[0]}].`;
    });

    await runMapReduce({
      kind: "summary",
      groups: groups(2),
      budget: 300,
      chat,
    });

    expect(calls[0][0].content).toContain("Extract NOTES");
    expect(calls[0][0].content).not.toContain("CLAUSES");
    const finalUser = calls[calls.length - 1][1].content;
    expect(finalUser).not.toContain("[Bản gốc]");
    expect(finalUser).not.toContain("[Bản sửa đổi]");
  });
});

// 233 (review #233 lỗi 1, 2, 5): trần lượt map chia cho hai bản, rút gọn riêng từng bản, map prompt không ép "short".
describe("233: map-reduce documentDiff — chia trần lượt map & rút gọn theo bản", () => {
  /** Nhóm diff: A = bản gốc (`baseCount` đoạn), B = bản sửa đổi (`revisedCount` đoạn); mỗi đoạn ~250 ký tự. */
  const diffGroups = (baseCount: number, revisedCount: number) => [
    Array.from({ length: baseCount }, (_, i) =>
      chunk("A", i, `A${i} `.repeat(60)),
    ),
    Array.from({ length: revisedCount }, (_, i) =>
      chunk("B", i, `B${i} `.repeat(60)),
    ),
  ];
  const nsOf = (text: string): number[] =>
    [...text.matchAll(/\[(\d+)\]/g)].map((m) => Number(m[1]));
  const pair = { baseTitle: "Goc.pdf", revisedTitle: "SuaDoi.pdf" };

  /** Map ⇒ 1 ghi chú / đoạn; rút gọn ⇒ giữ 1 ghi chú ngắn đầu tiên; viết ⇒ 1 câu. */
  function diffChat(noteLen = 10) {
    const calls: ChatMessage[][] = [];
    const chat = vi.fn(async (messages: ChatMessage[]) => {
      calls.push(messages);
      const sys = messages[0].content;
      const ns = nsOf(messages[1].content);
      if (sys.includes("CLAUSES")) {
        return ns.map((n) => `- ${"x".repeat(noteLen)} [${n}]`).join("\n");
      }
      if (sys.startsWith("Condense")) return `- gọn [${ns[0]}]`;
      return `Kết quả [${ns[0]}].`;
    });
    return { calls, chat };
  }
  const mapCallsOf = (calls: ChatMessage[][]) =>
    calls.filter((c) => c[0].content.includes("CLAUSES"));

  it("bản gốc dài vượt trần ⇒ bản sửa đổi VẪN được đọc (chia trần lượt map cho hai bản)", async () => {
    const { calls, chat } = diffChat();
    const out = await runMapReduce({
      kind: "documentDiff",
      groups: diffGroups(20, 2),
      budget: 300,
      chat,
      maxMapCalls: 4,
      diffPair: pair,
    });
    const maps = mapCallsOf(calls);
    expect(maps.length).toBeLessThanOrEqual(4);
    const revisedMaps = maps.filter((c) => c[1].content.includes("Tài liệu B"));
    expect(revisedMaps.length).toBeGreaterThan(0);
    expect(out.truncated).toBe(true);
    expect(out.parts).toBe(maps.length);
  });

  it("một bản ngắn ⇒ lượt map còn dư nhường cho bản kia (không lãng phí trần)", async () => {
    const { calls, chat } = diffChat();
    await runMapReduce({
      kind: "documentDiff",
      groups: diffGroups(1, 20),
      budget: 300,
      chat,
      maxMapCalls: 4,
      diffPair: pair,
    });
    const maps = mapCallsOf(calls);
    expect(maps).toHaveLength(4);
    expect(
      maps.filter((c) => c[1].content.includes("Tài liệu A")),
    ).toHaveLength(1);
    expect(
      maps.filter((c) => c[1].content.includes("Tài liệu B")),
    ).toHaveLength(3);
  });

  it("rút gọn ghi chú TÁCH RIÊNG từng bản bằng prompt diff, rồi gắn lại nhãn vai trò", async () => {
    const { calls, chat } = diffChat(200);
    const groupsAB = diffGroups(3, 3);
    await runMapReduce({
      kind: "documentDiff",
      groups: groupsAB,
      budget: 300,
      chat,
      diffPair: pair,
    });
    const condenseCalls = calls.filter((c) =>
      c[0].content.startsWith("Condense"),
    );
    expect(condenseCalls.length).toBeGreaterThan(0);
    for (const c of condenseCalls) {
      // không lô rút gọn nào trộn ghi chú của hai bản (A = [1..3], B = [4..6])
      const ns = nsOf(c[1].content);
      const allBase = ns.every((n) => n <= 3);
      const allRevised = ns.every((n) => n > 3);
      expect(allBase || allRevised).toBe(true);
      // prompt rút gọn riêng cho diff: không gộp, giữ số liệu
      expect(c[0].content).toMatch(/do NOT merge/i);
      expect(c[0].content).toMatch(/amounts|dates/i);
      expect(c[0].content).not.toMatch(/drop minor details/i);
    }
    const finalUser = calls[calls.length - 1][1].content;
    expect(finalUser).toContain("[Bản gốc]");
    expect(finalUser).toContain("[Bản sửa đổi]");
  });

  it("một bản không ra ghi chú hợp lệ nào ⇒ studioNoNotes (không so một phía)", async () => {
    const chat = vi.fn(async (messages: ChatMessage[]) => {
      const ns = nsOf(messages[1].content);
      // chỉ bản gốc (n ≤ 2) có ghi chú; bản sửa đổi trả rác không có [n]
      if (ns.some((n) => n > 2)) return "không có gì";
      return ns.map((n) => `- ý [${n}]`).join("\n");
    });
    await expect(
      runMapReduce({
        kind: "documentDiff",
        groups: diffGroups(2, 2),
        budget: 300,
        chat,
        diffPair: pair,
      }),
    ).rejects.toThrow(/studioNoNotes/);
  });

  it("map prompt diff yêu cầu trích gần nguyên văn, KHÔNG ép ghi chú 'short'", async () => {
    const { calls, chat } = diffChat();
    await runMapReduce({
      kind: "documentDiff",
      groups: diffGroups(2, 2),
      budget: 300,
      chat,
      diffPair: pair,
    });
    const sys = mapCallsOf(calls)[0][0].content;
    expect(sys).toMatch(/near-verbatim/i);
    expect(sys).not.toMatch(/\bshort\b/i);
  });
});

describe("248: pickDiffBatches", () => {
  const seq = (n: number): number[] => Array.from({ length: n }, (_, i) => i);

  it("mỗi bản tối đa nửa trần (bản gốc lấy phần lẻ)", () => {
    expect(pickDiffBatches(seq(10), seq(10), 5).map((x) => x.length)).toEqual([
      3, 2,
    ]);
  });

  it("phần một bản không dùng hết nhường bản kia", () => {
    expect(pickDiffBatches(seq(1), seq(10), 4).map((x) => x.length)).toEqual([
      1, 3,
    ]);
    expect(pickDiffBatches(seq(10), seq(1), 4).map((x) => x.length)).toEqual([
      3, 1,
    ]);
  });

  it("trần = 1 ⇒ mỗi bản vẫn ≥ 1 lô", () => {
    expect(pickDiffBatches(seq(5), seq(5), 1).map((x) => x.length)).toEqual([
      1, 1,
    ]);
  });
});
