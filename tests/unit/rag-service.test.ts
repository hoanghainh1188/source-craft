import { describe, it, expect } from "vitest";
import {
  createRagService,
  type RagServiceDeps,
} from "../../src/main/services/rag/rag-service";
import type { Chunk, ChatMessage, RagAskInput } from "@shared/ipc/types";
import type { VectorSearchHit } from "../../src/main/services/ingestion/vector-store";
import {
  NOT_FOUND_CONTENT,
  REINDEXING_CONTENT,
} from "../../src/main/services/rag/constants";

function chunk(id: string): Chunk {
  return {
    id,
    sourceId: `s-${id}`,
    ordinal: 0,
    text: `Nội dung ${id}`,
    locator: { page: 1, charStart: 0, charEnd: 9 },
  };
}

// deps với 1 chunk liên quan + chat trả về câu do test chỉ định (ghi lại messages để kiểm multi-turn).
function makeDeps(opts: {
  hits?: VectorSearchHit[];
  chunks?: Chunk[];
  chatReply?: (messages: ChatMessage[]) => string;
  capture?: ChatMessage[][];
}): RagServiceDeps {
  const hits = opts.hits ?? [{ id: "a", sourceId: "s-a", score: 0.1 }];
  const chunks = opts.chunks ?? [chunk("a")];
  return {
    embed: async () => [0.1, 0.2, 0.3],
    search: async () => hits,
    getChunksByIds: (ids) => {
      const m = new Map(chunks.map((c) => [c.id, c]));
      return ids.map((i) => m.get(i)).filter((c): c is Chunk => c != null);
    },
    sourceTitle: (sid) => `Nguồn ${sid}`,
    chat: async (messages) => {
      opts.capture?.push(messages);
      return opts.chatReply ? opts.chatReply(messages) : "Trả lời [1].";
    },
    // 039: mô phỏng streaming — phát từng ký tự qua onToken, trả nội dung đầy đủ.
    chatStream: async (messages, sopts) => {
      opts.capture?.push(messages);
      const reply = opts.chatReply ? opts.chatReply(messages) : "Trả lời [1].";
      for (const ch of reply) sopts.onToken?.(ch);
      return reply;
    },
  };
}

const ask = (over: Partial<RagAskInput> = {}): RagAskInput => ({
  notebookId: "nb1",
  question: "Câu hỏi?",
  mode: "grounded",
  history: [],
  ...over,
});

describe("rag-service — 059 reindex guard (per-notebook)", () => {
  it("notebook đang tái lập → báo thông báo, KHÔNG truy xuất/chat, KHÔNG lưu", async () => {
    let embedCalled = false;
    let saved = false;
    const svc = createRagService({
      ...makeDeps({}),
      embed: async () => {
        embedCalled = true;
        return [0.1];
      },
      reindexing: async () => true,
      saveTurn: () => {
        saved = true;
      },
    });
    const res = await svc.ask(ask());
    expect(res.reindexing).toBe(true);
    expect(res.citations).toEqual([]);
    expect(embedCalled).toBe(false); // không truy xuất trên vector chưa đầy đủ
    expect(saved).toBe(false); // không lưu thông báo tạm vào lịch sử
  });

  it("notebook đã nhúng xong → hoạt động bình thường (per-notebook)", async () => {
    const svc = createRagService({
      ...makeDeps({}),
      reindexing: async () => false,
    });
    const res = await svc.ask(ask());
    expect(res.reindexing).toBeUndefined();
  });

  it("guard nhận đúng notebookId đang hỏi (chặn theo từng notebook)", async () => {
    const seen: (string | null)[] = [];
    const svc = createRagService({
      ...makeDeps({}),
      reindexing: async (nb) => {
        seen.push(nb);
        return nb === "nb-dang-reindex";
      },
    });
    const blocked = await svc.ask(ask({ notebookId: "nb-dang-reindex" }));
    expect(blocked.reindexing).toBe(true);
    const ok = await svc.ask(ask({ notebookId: "nb-xong" }));
    expect(ok.reindexing).toBeUndefined();
    expect(seen).toEqual(["nb-dang-reindex", "nb-xong"]);
  });
});

describe("rag-service.ask", () => {
  it("US1 grounded có nguồn → answer + citations map đúng chunk", async () => {
    const svc = createRagService(makeDeps({}));
    const res = await svc.ask(ask());
    expect(res.modeUsed).toBe("grounded");
    expect(res.notFound).toBe(false);
    expect(res.citations).toHaveLength(1);
    expect(res.citations[0].chunkId).toBe("a");
    expect(res.answer).toContain("[1]");
  });

  it("US2 grounded không có căn cứ (0 chunk) → notFound, không gọi model", async () => {
    let chatCalled = false;
    const deps = makeDeps({ hits: [] });
    deps.chat = async () => {
      chatCalled = true;
      return "khong nen goi";
    };
    const res = await createRagService(deps).ask(ask());
    expect(res.notFound).toBe(true);
    expect(res.answer).toBe(NOT_FOUND_CONTENT);
    expect(res.citations).toEqual([]);
    expect(chatCalled).toBe(false);
  });

  it("US2 grounded có context nhưng model trả 'không tìm thấy' → notFound", async () => {
    const svc = createRagService(
      makeDeps({ chatReply: () => "Không tìm thấy trong nguồn." }),
    );
    const res = await svc.ask(ask());
    expect(res.notFound).toBe(true);
    expect(res.citations).toEqual([]);
  });

  it("(108 FR-015) grounded có context, model trả lời KHÔNG có [n] hợp lệ → notFound + gợi ý, KHÔNG gắn đoạn ngữ cảnh làm trích dẫn", async () => {
    const svc = createRagService(
      makeDeps({ chatReply: () => "Tài liệu nói về A và B." }),
    );
    const res = await svc.ask(ask());
    expect(res).toEqual({
      answer: NOT_FOUND_CONTENT,
      citations: [],
      notFound: true,
      modeUsed: "grounded",
    });
  });

  it("(108) grounded model chỉ chèn chip bịa [9] (0 [n] hợp lệ) → notFound", async () => {
    const svc = createRagService(
      makeDeps({ chatReply: () => "Theo tài liệu thì X [9]." }),
    );
    const res = await svc.ask(ask());
    expect(res.notFound).toBe(true);
    expect(res.citations).toEqual([]);
    expect(res.answer).toBe(NOT_FOUND_CONTENT);
  });

  it("grounded model tự nói 'không tìm thấy' (0 citation) → notFound", async () => {
    const svc = createRagService(
      makeDeps({ chatReply: () => "Rất tiếc, không tìm thấy thông tin này." }),
    );
    const res = await svc.ask(ask());
    expect(res.notFound).toBe(true);
    expect(res.answer).toBe(NOT_FOUND_CONTENT);
    expect(res.citations).toEqual([]);
  });

  it("mode lạ → ném (KHÔNG âm thầm hạ về open)", async () => {
    const svc = createRagService(makeDeps({}));
    await expect(
      svc.ask({ ...ask(), mode: "xxx" as unknown as "grounded" }),
    ).rejects.toThrow(/Invalid answer mode/);
  });

  it("US1 chip bịa [9] → gỡ, chỉ giữ citation hợp lệ", async () => {
    const svc = createRagService(
      makeDeps({ chatReply: () => "Đúng [1] bịa [9]." }),
    );
    const res = await svc.ask(ask());
    expect(res.answer).not.toContain("[9]");
    expect(res.citations.map((c) => c.n)).toEqual([1]);
  });

  it("US3 open → modeUsed=open, dùng open prompt (không notFound dù 0 chunk)", async () => {
    const cap: ChatMessage[][] = [];
    const svc = createRagService(
      makeDeps({
        hits: [],
        chunks: [],
        capture: cap,
        chatReply: () => "Kiến thức chung (không dựa trên nguồn).",
      }),
    );
    const res = await svc.ask(ask({ mode: "open" }));
    expect(res.modeUsed).toBe("open");
    expect(res.notFound).toBe(false);
    expect(cap[0][0].content).toContain("(không dựa trên nguồn)"); // open system prompt
  });

  it("123 (FR-017): lời nhắc chỉ định ngôn ngữ trả lời theo câu hỏi (vi / en / không chắc)", async () => {
    const run = async (question: string) => {
      const cap: ChatMessage[][] = [];
      await createRagService(makeDeps({ capture: cap })).ask(ask({ question }));
      return cap[0][0].content;
    };
    expect(await run("Where is Ha Long Bay located?")).toContain(
      "answer in English",
    );
    expect(await run("Vịnh Hạ Long nằm ở tỉnh nào?")).toContain(
      "answer in Vietnamese",
    );
    const unsure = await run("vinh ha long o dau");
    expect(unsure).toContain("same language as the user's last question");
    expect(unsure).not.toMatch(/answer in (English|Vietnamese)/);
  });

  it("US4 multi-turn: history đưa vào messages (giữa system và câu hỏi mới)", async () => {
    const cap: ChatMessage[][] = [];
    const svc = createRagService(
      makeDeps({
        capture: cap,
        chatReply: () => "ok [1]",
      }),
    );
    await svc.ask(
      ask({
        history: [
          { role: "user", content: "Câu trước" },
          { role: "assistant", content: "Đáp trước" },
        ],
      }),
    );
    const msgs = cap[0];
    expect(msgs[0].role).toBe("system");
    expect(msgs.some((m) => m.content === "Câu trước")).toBe(true);
    expect(msgs[msgs.length - 1].content).toBe("Câu hỏi?");
  });

  it("US4 câu hỏi quá dài → ném (validate boundary)", async () => {
    const svc = createRagService(makeDeps({}));
    await expect(svc.ask(ask({ question: "x".repeat(2001) }))).rejects.toThrow(
      /questionTooLong/,
    );
    await expect(svc.ask(ask({ question: "   " }))).rejects.toThrow(
      /notebookNameEmpty|questionEmpty/,
    );
  });
});

describe("rag-service.askStream (039)", () => {
  it("nối token qua onToken + finalize chip hậu kiểm", async () => {
    const tokens: string[] = [];
    const svc = createRagService(makeDeps({}));
    const res = await svc.askStream(ask(), {
      onToken: (d) => tokens.push(d),
    });
    expect(tokens.join("")).toContain("Trả lời"); // đã stream từng delta
    expect(res.answer).toContain("Trả lời");
    expect(res.citations.length).toBeGreaterThan(0); // chip [1] hậu kiểm
  });

  it("grounded không căn cứ → notFound, KHÔNG stream (không gọi model)", async () => {
    const tokens: string[] = [];
    const svc = createRagService(makeDeps({ hits: [] }));
    const res = await svc.askStream(ask(), {
      onToken: (d) => tokens.push(d),
    });
    expect(res.notFound).toBe(true);
    expect(tokens).toHaveLength(0);
  });

  it("phần đã nhận (nội dung ngắn như bị Dừng) → finalize trên phần đó", async () => {
    const svc = createRagService(makeDeps({ chatReply: () => "Một phần [1]" }));
    const res = await svc.askStream(ask(), {});
    expect(res.answer).toContain("Một phần");
    expect(res.citations.map((c) => c.n)).toEqual([1]);
  });
});

// 108: câu "Không tìm thấy" hiển thị kèm gợi ý (FR-016); lượt lưu đúng như người dùng thấy (FR-015).
describe("rag-service — không tìm thấy + gợi ý (108)", () => {
  it("123: nội dung lưu 'không tìm thấy' là câu English trung tính (giao diện dịch theo cờ)", () => {
    expect(NOT_FOUND_CONTENT).toBe("Not found in the sources.");
    expect(REINDEXING_CONTENT).not.toMatch(/[àáạảãâầấậẩẫăằắặẳẵđ]/);
  });

  it("model tự nói không tìm thấy (bất kỳ ngôn ngữ nào, không [n]) → notFound (123: không phụ thuộc văn bản)", async () => {
    for (const reply of [
      "Không tìm thấy trong nguồn.",
      "The sources do not contain this information.",
    ]) {
      const r = await createRagService(
        makeDeps({ chatReply: () => reply }),
      ).ask(ask());
      expect(r.notFound).toBe(true);
    }
    const svc = createRagService(
      makeDeps({ chatReply: () => "The sources do not contain it." }),
    );
    const res = await svc.ask(ask());
    expect(res.answer).toBe(NOT_FOUND_CONTENT);
    expect(res.notFound).toBe(true);
  });

  it("grounded có [n] hợp lệ → không đổi (không thêm gợi ý)", async () => {
    const res = await createRagService(makeDeps({})).ask(ask());
    expect(res.notFound).toBe(false);
    expect(res.notFound).toBe(false);
  });

  it("open + model không chèn [n] → không đổi (không notFound, không gợi ý)", async () => {
    const svc = createRagService(
      makeDeps({ chatReply: () => "Kiến thức chung (không dựa trên nguồn)." }),
    );
    const res = await svc.ask(ask({ mode: "open" }));
    expect(res.notFound).toBe(false);
    expect(res.answer).toBe("Kiến thức chung (không dựa trên nguồn).");
  });

  it("(E3/FR-014) Mở rộng + retrieve rỗng → VẪN gọi chat, không trả NOT_FOUND_CONTENT", async () => {
    let chatCalled = false;
    const deps = makeDeps({ hits: [], chunks: [] });
    deps.chat = async () => {
      chatCalled = true;
      return "Kiến thức chung (không dựa trên nguồn).";
    };
    const res = await createRagService(deps).ask(ask({ mode: "open" }));
    expect(chatCalled).toBe(true);
    expect(res.answer).not.toBe(NOT_FOUND_CONTENT);
    expect(res.notFound).toBe(false);
  });

  it("saveTurn lưu đúng NOT_FOUND_CONTENT + notFound (cả nhánh không [n])", async () => {
    const saved: { content: string; notFound: boolean }[] = [];
    const deps = makeDeps({ chatReply: () => "Không có trích dẫn." });
    deps.saveTurn = (_nb, _q, a) =>
      saved.push({ content: a.content, notFound: a.notFound });
    await createRagService(deps).ask(ask());
    expect(saved).toEqual([{ content: NOT_FOUND_CONTENT, notFound: true }]);
  });

  it("askStream cùng hành vi: không [n] hợp lệ → NOT_FOUND_CONTENT, citations rỗng", async () => {
    const svc = createRagService(
      makeDeps({ chatReply: () => "Tóm tắt không kèm nguồn." }),
    );
    const res = await svc.askStream(ask(), {});
    expect(res.answer).toBe(NOT_FOUND_CONTENT);
    expect(res.citations).toEqual([]);
    expect(res.notFound).toBe(true);
  });

  it("askStream grounded retrieve rỗng → NOT_FOUND_CONTENT", async () => {
    const res = await createRagService(makeDeps({ hits: [] })).askStream(
      ask(),
      {},
    );
    expect(res.answer).toBe(NOT_FOUND_CONTENT);
  });
});

describe("rag-service — relevanceConfig (108, công cụ đo)", () => {
  it("deps.relevanceConfig được truyền xuống retrieve() (ngưỡng chặt ⇒ không tìm thấy, không gọi chat)", async () => {
    let chatCalled = false;
    const deps = makeDeps({ hits: [{ id: "a", sourceId: "s-a", score: 0.3 }] });
    deps.chat = async () => {
      chatCalled = true;
      return "x [1]";
    };
    deps.relevanceConfig = {
      maxDistance: 0.2,
      relativeDelta: null,
      bm25Gate: "requireVector",
      bm25VectorMaxDistance: null,
      bm25MaxScore: null,
    };
    const res = await createRagService(deps).ask(ask());
    expect(res.notFound).toBe(true);
    expect(chatCalled).toBe(false);
  });

  it("không đặt relevanceConfig ⇒ dùng bản ghi hiệu chuẩn (0.3 ≤ 0.5 ⇒ có trả lời)", async () => {
    const deps = makeDeps({ hits: [{ id: "a", sourceId: "s-a", score: 0.3 }] });
    const res = await createRagService(deps).ask(ask());
    expect(res.notFound).toBe(false);
  });
});
