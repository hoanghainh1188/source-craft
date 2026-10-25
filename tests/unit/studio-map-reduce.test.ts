import { describe, it, expect, vi } from "vitest";
import {
  numberAll,
  packBatches,
  runMapReduce,
} from "../../src/main/services/studio/map-reduce";
import { postprocessCitations } from "../../src/main/services/rag/citation";
import type { ScoredChunk } from "../../src/main/services/rag/rag-types";
import type { ChatMessage } from "@shared/ipc/types";

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

describe("numberAll", () => {
  it("đánh số [n] toàn cục theo nguồn → thứ tự đọc; bảng n → đoạn thật", () => {
    const { blocks, map } = numberAll(groups(2));
    expect(blocks.map((b) => b.n)).toEqual([1, 2, 3, 4]);
    expect(map.get(1)!.chunk.id).toBe("A-0");
    expect(map.get(3)!.chunk.id).toBe("B-0");
    expect(blocks[2].text.startsWith("[3]")).toBe(true);
  });
});

describe("packBatches", () => {
  it("gom tham lam vừa ngân sách; đoạn quá khổ đứng riêng 1 lô", () => {
    const blocks = [
      { n: 1, text: "a".repeat(40) },
      { n: 2, text: "b".repeat(40) },
      { n: 3, text: "c".repeat(200) },
      { n: 4, text: "d".repeat(40) },
    ];
    expect(packBatches(blocks, 100).map((b) => b.map((x) => x.n))).toEqual([
      [1, 2],
      [3],
      [4],
    ]);
  });
});

describe("runMapReduce", () => {
  /** chat giả: lượt map trả ghi chú trích [n] đầu tiên của lô + 1 số bịa; lượt cuối trả lại các [n] nhận được. */
  function fakeChat() {
    const calls: ChatMessage[][] = [];
    const chat = vi.fn(async (messages: ChatMessage[]) => {
      calls.push(messages);
      const sys = messages[0].content;
      const user = messages[1].content;
      const ns = [...user.matchAll(/\[(\d+)\]/g)].map((m) => Number(m[1]));
      if (sys.startsWith("Condense the NOTES"))
        return ns.map((n) => `- ý gọn [${n}]`).join("\n");
      if (sys.startsWith("Extract NOTES")) {
        return `- ý chính [${ns[0]}] [999]`; // [999] bịa ⇒ phải bị gỡ theo lô
      }
      return `Tóm tắt toàn bộ ${ns.map((n) => `[${n}]`).join(" ")}.`;
    });
    return { chat, calls };
  }

  it("nhiều lô ⇒ N lượt map + 1 lượt cuối; [n] cuối cùng trỏ ĐÚNG đoạn thật, số bịa bị gỡ", async () => {
    const { chat, calls } = fakeChat();
    const out = await runMapReduce({
      kind: "summary",
      groups: groups(3),
      budget: 900,
      chat,
    });
    expect(out.parts).toBeGreaterThan(1);
    expect(chat).toHaveBeenCalledTimes(out.parts + 1);
    expect(out.truncated).toBe(false);
    const finalUser = calls[calls.length - 1][1].content;
    expect(finalUser).not.toContain("[999]");
    const { citations } = postprocessCitations(out.raw, out.map);
    expect(citations.length).toBeGreaterThan(1);
    for (const c of citations)
      expect(out.map.get(c.n)!.chunk.id).toBe(c.chunkId);
    // lượt cuối được nhắc giữ nguyên [n]
    expect(calls[calls.length - 1][0].content).toMatch(/KEEP the \[n\] chips/);
  });

  it("vượt số lượt map tối đa ⇒ truncated, chỉ tổng hợp số phần cho phép", async () => {
    const { chat } = fakeChat();
    const out = await runMapReduce({
      kind: "keyPoints",
      groups: groups(10),
      budget: 500,
      chat,
      maxMapCalls: 3,
    });
    expect(out.parts).toBe(3);
    expect(out.truncated).toBe(true);
  });

  it("ghi chú gộp lại vẫn quá ngân sách ⇒ rút gọn ghi chú (giữ [n]) trước bước cuối", async () => {
    const calls: string[] = [];
    const chat = vi.fn(async (messages: ChatMessage[]) => {
      const sys = messages[0].content;
      const ns = [...messages[1].content.matchAll(/\[(\d+)\]/g)].map((m) =>
        Number(m[1]),
      );
      if (sys.startsWith("Condense the NOTES")) {
        calls.push("condense");
        return `- gộp [${ns[0]}]`;
      }
      if (sys.startsWith("Extract NOTES")) {
        calls.push("map");
        return ns.map((n) => `- ${"chi tiết ".repeat(30)}[${n}]`).join("\n");
      }
      calls.push("reduce");
      return `Kết luận [${ns[0]}].`;
    });
    const out = await runMapReduce({
      kind: "summary",
      groups: groups(3),
      budget: 900,
      chat,
    });
    expect(calls).toContain("condense");
    expect(calls[calls.length - 1]).toBe("reduce");
    expect(postprocessCitations(out.raw, out.map).citations).toHaveLength(1);
  });
});

describe("runMapReduce — hậu kiểm chặt (review 105)", () => {
  it("bước cuối viết số HỢP LỆ TOÀN CỤC nhưng KHÔNG có trong ghi chú ⇒ bị gỡ (không trỏ đoạn model chưa đọc)", async () => {
    let seenFinal: number[] = [];
    const chat = vi.fn(async (messages: ChatMessage[]) => {
      const sys = messages[0].content;
      const ns = [...messages[1].content.matchAll(/\[(\d+)\]/g)].map((m) =>
        Number(m[1]),
      );
      if (sys.startsWith("Extract NOTES")) return `- ý [${ns[0]}]`;
      seenFinal = ns;
      return `Kết luận [${ns[0]}] và [2].`; // [2] có trong notebook nhưng không có trong ghi chú
    });
    const out = await runMapReduce({
      kind: "summary",
      groups: groups(3),
      budget: 900,
      chat,
    });
    expect(seenFinal).not.toContain(2);
    const { citations } = postprocessCitations(out.raw, out.map);
    expect(citations.map((c) => c.n)).toEqual([seenFinal[0]]);
  });

  it("chip dạng gộp [1, 2] trong ghi chú được tách ra (không mất ý)", async () => {
    const chat = vi.fn(async (messages: ChatMessage[]) => {
      const sys = messages[0].content;
      const ns = [...messages[1].content.matchAll(/\[(\d+)\]/g)].map((m) =>
        Number(m[1]),
      );
      if (sys.startsWith("Extract NOTES"))
        return `- ý chung [${ns[0]}, ${ns[1]}]`;
      return `Kết luận ${ns.map((n) => `[${n}]`).join(" ")}.`;
    });
    const out = await runMapReduce({
      kind: "summary",
      groups: groups(3),
      budget: 900,
      chat,
    });
    expect(
      postprocessCitations(out.raw, out.map).citations.length,
    ).toBeGreaterThan(out.parts);
  });

  it("mọi lô không trích được ghi chú có [n] ⇒ ném lỗi rõ (không để bước cuối bịa)", async () => {
    const chat = vi.fn(async () => "Không có gì để ghi chú.");
    await expect(
      runMapReduce({ kind: "summary", groups: groups(3), budget: 900, chat }),
    ).rejects.toThrow(/studioNoNotes/);
    expect(chat).toHaveBeenCalledTimes(3 * 2); // mỗi lô thử lại 1 lần rồi mới bỏ
  });

  it("một lô rỗng ⇒ đánh dấu truncated (phần tài liệu đó không được tổng hợp)", async () => {
    const chat = vi.fn(async (messages: ChatMessage[]) => {
      const sys = messages[0].content;
      const ns = [...messages[1].content.matchAll(/\[(\d+)\]/g)].map((m) =>
        Number(m[1]),
      );
      // lô đầu (đoạn [1]) luôn không trích được — kể cả lần thử lại
      if (sys.startsWith("Extract NOTES"))
        return ns[0] === 1 ? "rỗng" : `- ý [${ns[0]}]`;
      return `Kết luận ${ns.map((n) => `[${n}]`).join(" ")}.`;
    });
    const out = await runMapReduce({
      kind: "summary",
      groups: groups(3),
      budget: 900,
      chat,
    });
    expect(out.truncated).toBe(true);
  });

  it("một lượt map lỗi ⇒ thử lại 1 lần rồi chạy tiếp", async () => {
    let failed = false;
    const chat = vi.fn(async (messages: ChatMessage[]) => {
      const ns = [...messages[1].content.matchAll(/\[(\d+)\]/g)].map((m) =>
        Number(m[1]),
      );
      if (messages[0].content.startsWith("Extract NOTES")) {
        if (!failed) {
          failed = true;
          throw new Error("Ollama tạm lỗi");
        }
        return `- ý [${ns[0]}]`;
      }
      return `Kết luận [${ns[0]}].`;
    });
    const out = await runMapReduce({
      kind: "summary",
      groups: groups(3),
      budget: 900,
      chat,
    });
    expect(out.truncated).toBe(false);
    expect(postprocessCitations(out.raw, out.map).citations).toHaveLength(1);
  });

  it("rút gọn: [n] không thuộc lô ghi chú đầu vào bị gỡ; vẫn quá dài sau các vòng ⇒ cắt + truncated", async () => {
    const chat = vi.fn(async (messages: ChatMessage[]) => {
      const sys = messages[0].content;
      const input = messages[1].content;
      const ns = [...input.matchAll(/\[(\d+)\]/g)].map((m) => Number(m[1]));
      // model "không chịu rút gọn" + bịa thêm [2] (có trong notebook nhưng KHÔNG có trong ghi chú)
      if (sys.startsWith("Condense the NOTES")) return `${input}\n- bịa [2]`;
      if (sys.startsWith("Extract NOTES"))
        return `- ${"x ".repeat(300)}[${ns[0]}]`;
      return `Kết luận ${ns.map((n) => `[${n}]`).join(" ")}.`;
    });
    const out = await runMapReduce({
      kind: "summary",
      groups: groups(3),
      budget: 900,
      chat,
    });
    expect(out.truncated).toBe(true);
    const finalUser = (chat.mock.calls.at(-1)![0] as ChatMessage[])[1].content;
    expect(finalUser.length).toBeLessThanOrEqual(900);
    expect(finalUser).not.toContain("[2]");
  });
});

describe("123: ngôn ngữ đầu ra cho mọi bước map-reduce", () => {
  it("map, condense, bước cuối đều dặn cùng ngôn ngữ (en); mặc định vi", async () => {
    for (const [lang, word] of [
      ["en", "Write in English"],
      [undefined, "Write in Vietnamese"],
    ] as const) {
      const systems: string[] = [];
      const chat = vi.fn(async (messages: ChatMessage[]) => {
        const sys = messages[0].content;
        systems.push(sys);
        const ns = [...messages[1].content.matchAll(/\[(\d+)\]/g)].map((m) =>
          Number(m[1]),
        );
        if (sys.startsWith("Condense the NOTES")) return `- gộp [${ns[0]}]`;
        if (sys.startsWith("Extract NOTES"))
          return ns.map((n) => `- ${"chi tiết ".repeat(30)}[${n}]`).join("\n");
        return `Kết luận [${ns[0]}].`;
      });
      await runMapReduce({
        kind: "faq",
        groups: groups(3),
        budget: 900,
        chat,
        ...(lang ? { outputLanguage: lang } : {}),
      });
      expect(systems.length).toBeGreaterThan(2);
      for (const sys of systems) expect(sys).toContain(word);
    }
  });
});

// 146 (contract studio-progress): onProgress phát reading 1/N..N/N (trước lượt map đầu tiên của phần đó), condensing ≤ 1 lần (chỉ khi có
// vòng rút gọn), writing 1 lần trước bước cuối. Lỗi callback bị nuốt; kết quả giống hệt khi không có onProgress.
describe("runMapReduce — onProgress (146)", () => {
  type Ev = { phase: string; index?: number; total?: number };

  /** chat giả ghi lại thứ tự gọi xen kẽ với sự kiện tiến độ. */
  function tracedChat(
    log: string[],
    opts: { condense?: boolean; failFirstMap?: boolean } = {},
  ) {
    let failed = false;
    return vi.fn(async (messages: ChatMessage[]) => {
      const sys = messages[0].content;
      const ns = [...messages[1].content.matchAll(/\[(\d+)\]/g)].map((m) =>
        Number(m[1]),
      );
      if (sys.startsWith("Condense the NOTES")) {
        log.push("chat:condense");
        return `- gộp [${ns[0]}]`;
      }
      if (sys.startsWith("Extract NOTES")) {
        log.push("chat:map");
        if (opts.failFirstMap && !failed) {
          failed = true;
          throw new Error("tạm lỗi");
        }
        return opts.condense
          ? ns.map((n) => `- ${"chi tiết ".repeat(30)}[${n}]`).join("\n")
          : `- ý [${ns[0]}]`;
      }
      log.push("chat:final");
      return `Kết luận [${ns[0]}].`;
    });
  }

  const label = (e: Ev): string =>
    e.phase === "reading" ? `reading ${e.index}/${e.total}` : e.phase;

  it("nhiều phần, không rút gọn ⇒ reading 1/N..N/N rồi writing; mỗi sự kiện ngay trước lượt gọi của nó", async () => {
    const log: string[] = [];
    const out = await runMapReduce({
      kind: "summary",
      groups: groups(3),
      budget: 900,
      chat: tracedChat(log),
      onProgress: (e: Ev) => log.push(label(e)),
    });
    const N = out.parts;
    expect(N).toBeGreaterThan(1);
    const expected: string[] = [];
    for (let i = 1; i <= N; i++) expected.push(`reading ${i}/${N}`, "chat:map");
    expected.push("writing", "chat:final");
    expect(log).toEqual(expected);
  });

  it("bị cắt ở maxMapCalls ⇒ total = parts (số phần thực chạy)", async () => {
    const evs: Ev[] = [];
    const out = await runMapReduce({
      kind: "keyPoints",
      groups: groups(10),
      budget: 500,
      chat: tracedChat([]),
      maxMapCalls: 3,
      onProgress: (e: Ev) => evs.push(e),
    });
    expect(out.parts).toBe(3);
    const reading = evs.filter((e) => e.phase === "reading");
    expect(reading.map((e) => [e.index, e.total])).toEqual([
      [1, 3],
      [2, 3],
      [3, 3],
    ]);
  });

  it("lần thử lại trong cùng phần KHÔNG phát thêm sự kiện", async () => {
    const log: string[] = [];
    const out = await runMapReduce({
      kind: "summary",
      groups: groups(3),
      budget: 900,
      chat: tracedChat(log, { failFirstMap: true }),
      onProgress: (e: Ev) => log.push(label(e)),
    });
    expect(log.filter((l) => l.startsWith("reading"))).toHaveLength(out.parts);
    expect(log.slice(0, 3)).toEqual([
      `reading 1/${out.parts}`,
      "chat:map",
      "chat:map",
    ]);
  });

  it("có vòng rút gọn ⇒ condensing đúng 1 lần, trước lượt rút gọn đầu tiên, sau mọi reading", async () => {
    const log: string[] = [];
    await runMapReduce({
      kind: "summary",
      groups: groups(3),
      budget: 900,
      chat: tracedChat(log, { condense: true }),
      onProgress: (e: Ev) => log.push(label(e)),
    });
    expect(log.filter((l) => l === "condensing")).toHaveLength(1);
    const ci = log.indexOf("condensing");
    expect(log[ci + 1]).toBe("chat:condense");
    expect(log.slice(ci).some((l) => l.startsWith("reading"))).toBe(false);
    expect(log.filter((l) => l === "writing")).toHaveLength(1);
    expect(log[log.length - 2]).toBe("writing");
  });

  it("onProgress ném lỗi ⇒ lượt tạo vẫn xong; kết quả giống hệt khi không truyền onProgress", async () => {
    const base = await runMapReduce({
      kind: "summary",
      groups: groups(3),
      budget: 900,
      chat: tracedChat([]),
    });
    const withThrow = await runMapReduce({
      kind: "summary",
      groups: groups(3),
      budget: 900,
      chat: tracedChat([]),
      onProgress: () => {
        throw new Error("renderer đã đóng");
      },
    });
    expect(withThrow.raw).toBe(base.raw);
    expect(withThrow.parts).toBe(base.parts);
    expect(withThrow.truncated).toBe(base.truncated);
    expect([...withThrow.map.keys()]).toEqual([...base.map.keys()]);
  });
});

// 149 (research R2): signal — kiểm ở ranh giới bước; huỷ trong vòng thử lại KHÔNG gọi lần 2; không phát tiến độ sau huỷ.
import { ChatAbortedError } from "../../src/main/services/ai-runtime/abort";

describe("runMapReduce — huỷ (149)", () => {
  /** chat giả: đếm lượt theo loại; `abortAt(n, kind)` ⇒ ở lượt thứ n của loại đó: abort controller rồi ném ChatAbortedError. */
  function abortingChat(
    ctl: AbortController,
    at: { kind: "map" | "condense" | "final"; n: number } | null,
    opts: { condense?: boolean } = {},
  ) {
    const count = { map: 0, condense: 0, final: 0 };
    const chat = vi.fn(async (messages: ChatMessage[]) => {
      const sys = messages[0].content;
      const ns = [...messages[1].content.matchAll(/\[(\d+)\]/g)].map((m) =>
        Number(m[1]),
      );
      const kind = sys.startsWith("Condense the NOTES")
        ? "condense"
        : sys.startsWith("Extract NOTES")
          ? "map"
          : "final";
      count[kind] += 1;
      if (at && at.kind === kind && at.n === count[kind]) {
        ctl.abort();
        throw new ChatAbortedError();
      }
      if (kind === "condense") return `- gộp [${ns[0]}]`;
      if (kind === "map")
        return opts.condense
          ? ns.map((n) => `- ${"chi tiết ".repeat(30)}[${n}]`).join("\n")
          : `- ý [${ns[0]}]`;
      return `Kết luận [${ns[0]}].`;
    });
    return { chat, count };
  }

  it("signal đã abort trước ⇒ 0 lượt chat, ném ChatAbortedError", async () => {
    const ctl = new AbortController();
    ctl.abort();
    const { chat } = abortingChat(ctl, null);
    await expect(
      runMapReduce({
        kind: "summary",
        groups: groups(3),
        budget: 900,
        chat,
        signal: ctl.signal,
      }),
    ).rejects.toBeInstanceOf(ChatAbortedError);
    expect(chat).not.toHaveBeenCalled();
  });

  it("huỷ trong lượt map phần 2 ⇒ KHÔNG thử lại, không gọi phần 3 / bước cuối", async () => {
    const ctl = new AbortController();
    const { chat, count } = abortingChat(ctl, { kind: "map", n: 2 });
    await expect(
      runMapReduce({
        kind: "summary",
        groups: groups(3),
        budget: 900,
        chat,
        signal: ctl.signal,
      }),
    ).rejects.toBeInstanceOf(ChatAbortedError);
    expect(count).toEqual({ map: 2, condense: 0, final: 0 });
  });

  it("huỷ trong vòng rút gọn ⇒ không gọi lô rút gọn kế tiếp / bước cuối", async () => {
    const ctl = new AbortController();
    const { chat, count } = abortingChat(
      ctl,
      { kind: "condense", n: 1 },
      { condense: true },
    );
    await expect(
      runMapReduce({
        kind: "summary",
        groups: groups(3),
        budget: 900,
        chat,
        signal: ctl.signal,
      }),
    ).rejects.toBeInstanceOf(ChatAbortedError);
    expect(count.condense).toBe(1);
    expect(count.final).toBe(0);
  });

  it("huỷ giữa các bước (sau lượt map cuối) ⇒ không gọi bước cuối, không phát 'writing'", async () => {
    const ctl = new AbortController();
    const evs: string[] = [];
    let maps = 0;
    const chat = vi.fn(async (messages: ChatMessage[]) => {
      const ns = [...messages[1].content.matchAll(/\[(\d+)\]/g)].map((m) =>
        Number(m[1]),
      );
      if (messages[0].content.startsWith("Extract NOTES")) {
        maps += 1;
        return `- ý [${ns[0]}]`;
      }
      return `Kết luận [${ns[0]}].`;
    });
    const p = runMapReduce({
      kind: "summary",
      groups: groups(3),
      budget: 900,
      chat,
      signal: ctl.signal,
      onProgress: (e) => {
        evs.push(e.phase);
        // huỷ ngay khi lượt đọc cuối vừa phát (trước khi bước cuối bắt đầu)
        if (e.phase === "reading" && e.index === e.total)
          queueMicrotask(() => ctl.abort());
      },
    });
    await expect(p).rejects.toBeInstanceOf(ChatAbortedError);
    expect(
      chat.mock.calls.every((c) => c[0][0].content.startsWith("Extract NOTES")),
    ).toBe(true);
    expect(evs).not.toContain("writing");
    expect(maps).toBeGreaterThan(0);
  });
});

describe("runMapReduce — kiểm huỷ ở đầu mỗi lần thử (review N5)", () => {
  it("chat trả rỗng (không tôn trọng signal) sau khi bị huỷ ⇒ KHÔNG gọi lần thử thứ 2", async () => {
    const ctl = new AbortController();
    const chat = vi.fn(async () => {
      ctl.abort();
      return "không có trích dẫn"; // rỗng sau cleanNotes ⇒ bình thường sẽ thử lại
    });
    await expect(
      runMapReduce({
        kind: "summary",
        groups: groups(3),
        budget: 900,
        chat,
        signal: ctl.signal,
      }),
    ).rejects.toBeInstanceOf(ChatAbortedError);
    expect(chat).toHaveBeenCalledTimes(1);
  });
});

// 233 (T010, FR-007, D4): map-reduce documentDiff — đóng lô theo nguồn + map prompt diff + nhãn vai trò
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
