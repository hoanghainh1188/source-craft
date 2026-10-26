import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Chunk, ChatMessage, Source } from "@shared/ipc/types";
import { UserFacingError } from "@shared/codes/user-error";
import { ChatAbortedError } from "../../src/main/services/ai-runtime/abort";

// 248 (đợt 2): prompt loại Pro / diff ở module Pro — dùng module Pro GIẢ (chuỗi đánh dấu) để kiểm điều phối của core.
vi.mock("../../src/main/pro", () => import("./helpers/fake-pro"));

// 178 (PR 4, T061, FR-040..FR-045, research R7): stream CHỈ lượt viết cuối. Chat giả mô phỏng ĐÚNG hợp đồng nhánh stream đã
// xác minh ở cả 4 provider: có `onToken` ⇒ gọi onToken từng delta; abort giữa chừng ⇒ TRẢ phần đã nhận, KHÔNG ném. Không có
// `onToken` ⇒ nhánh không-stream: abort ⇒ ném ChatAbortedError (149). Vì stream không ném, service PHẢI `assertNotAborted` ngay
// sau lượt stream — nếu không, lượt đã huỷ sẽ bị hậu kiểm + lưu.

const postprocessSpy = vi.hoisted(() => ({ calls: 0 }));
vi.mock("../../src/main/services/rag/citation", async (orig) => {
  const mod =
    await orig<typeof import("../../src/main/services/rag/citation")>();
  return {
    ...mod,
    postprocessCitations: (
      ...a: Parameters<typeof mod.postprocessCitations>
    ) => {
      postprocessSpy.calls += 1;
      return mod.postprocessCitations(...a);
    },
  };
});
const { createStudioService } =
  await import("../../src/main/services/studio/studio-service");

type ChatOpts = {
  numCtx?: number;
  signal?: AbortSignal;
  onToken?: (delta: string) => void;
};

const src = (id: string): Source =>
  ({
    id,
    notebookId: "nb1",
    kind: "txt",
    title: `T ${id}`,
    status: "ready",
  }) as Source;
const chunks = (sourceId: string, count: number, len = 300): Chunk[] =>
  Array.from({ length: count }, (_, i) => ({
    id: `${sourceId}-${i}`,
    sourceId,
    notebookId: "nb1",
    ordinal: i,
    text: `${sourceId}${i} `.repeat(len / 4),
    locator: { page: 1, charStart: i * 10, charEnd: i * 10 + 5 },
  })) as unknown as Chunk[];

const isMap = (m: ChatMessage[]): boolean =>
  m[0].content.startsWith("Extract NOTES") ||
  m[0].content.startsWith("Condense the NOTES");

interface FakeOpts {
  /** Gọi trước khi phát delta thứ i của lượt stream (0-based) — dùng để huỷ giữa stream. */
  beforeDelta?: (i: number) => void;
  /** Provider "hư": vẫn gọi onToken sau khi abort (service phải chặn). */
  leakAfterAbort?: boolean;
}

/** Chat giả theo hợp đồng của provider (`label` chỉ để đặt tên ca). */
function fakeProvider(label: string, o: FakeOpts = {}) {
  const calls: { messages: ChatMessage[]; opts?: ChatOpts }[] = [];
  const chat = vi.fn(async (messages: ChatMessage[], opts?: ChatOpts) => {
    calls.push({ messages, opts });
    const ns = [...messages[1].content.matchAll(/\[(\d+)\]/g)].map((m) =>
      Number(m[1]),
    );
    if (isMap(messages)) {
      if (opts?.signal?.aborted) throw new ChatAbortedError();
      return `- ý [${ns[0]}]`;
    }
    const full = `${label}: Kết quả ${ns.map((n) => `[${n}]`).join(" ")}.`;
    if (!opts?.onToken) {
      if (opts?.signal?.aborted) throw new ChatAbortedError();
      return full;
    }
    // Nhánh stream: abort ⇒ trả phần đã nhận, KHÔNG ném.
    const deltas = full.match(/.{1,4}/gs) ?? [];
    let got = "";
    for (const [i, d] of deltas.entries()) {
      o.beforeDelta?.(i);
      await Promise.resolve();
      if (opts.signal?.aborted) {
        if (o.leakAfterAbort) opts.onToken(d);
        return got;
      }
      got += d;
      opts.onToken(d);
    }
    return got;
  });
  return { chat, calls };
}

function service(
  chat: ReturnType<typeof fakeProvider>["chat"],
  { perSource = 2, budget = 50_000 } = {},
) {
  const insert = vi.fn((v: Record<string, unknown>) => ({
    id: "r1",
    createdAt: 1,
    ...v,
  }));
  const svc = createStudioService({
    listSources: () => [src("A"), src("B")],
    listChunks: (id) => chunks(id, perSource),
    studioRepo: { insert, listByNotebook: () => [] } as never,
    chat,
    contextInfo: async () => ({ budget, numCtx: 4096 }),
  });
  return { svc, insert };
}

const isCancelled = (e: unknown): boolean =>
  e instanceof UserFacingError && e.code === "studioCancelled";

beforeEach(() => {
  postprocessSpy.calls = 0;
});

describe.each(["ollama", "openai", "anthropic", "gemini"])(
  "studio stream — provider %s",
  (label) => {
    it("(a) 1 lượt: onToken ở lượt viết; delta tới callback theo thứ tự; nối lại = nội dung thô", async () => {
      const { chat, calls } = fakeProvider(label);
      const { svc, insert } = service(chat);
      const deltas: string[] = [];
      const r = await svc.generate(
        { notebookId: "nb1", kind: "summary" },
        { onToken: (d) => deltas.push(d) },
      );
      expect(calls).toHaveLength(1);
      expect(typeof calls[0].opts?.onToken).toBe("function");
      expect(calls[0].opts?.numCtx).toBe(4096);
      expect(deltas.length).toBeGreaterThan(1);
      expect(deltas.join("")).toMatch(new RegExp(`^${label}: Kết quả \\[1\\]`));
      expect(insert).toHaveBeenCalledTimes(1);
      expect(r.citations.length).toBeGreaterThan(0);
    });

    it("(b) map-reduce: map / condense KHÔNG nhận onToken; chỉ lượt cuối nhận", async () => {
      const { chat, calls } = fakeProvider(label);
      const { svc } = service(chat, { perSource: 6, budget: 1000 });
      const deltas: string[] = [];
      const r = await svc.generate(
        { notebookId: "nb1", kind: "keyPoints" },
        { onToken: (d) => deltas.push(d) },
      );
      expect(r.parts).toBeGreaterThan(1);
      const last = calls[calls.length - 1];
      expect(isMap(last.messages)).toBe(false);
      expect(typeof last.opts?.onToken).toBe("function");
      for (const c of calls.slice(0, -1)) {
        expect(isMap(c.messages)).toBe(true);
        expect(c.opts?.onToken).toBeUndefined();
      }
      expect(deltas.length).toBeGreaterThan(0);
    });

    it("(c) huỷ giữa stream ⇒ studioCancelled; KHÔNG hậu kiểm, KHÔNG lưu (stream trả phần dở, không ném)", async () => {
      const ac = new AbortController();
      const { chat } = fakeProvider(label, {
        beforeDelta: (i) => {
          if (i === 2) ac.abort();
        },
      });
      const { svc, insert } = service(chat);
      const deltas: string[] = [];
      const err = await svc
        .generate(
          { notebookId: "nb1", kind: "summary" },
          { signal: ac.signal, onToken: (d) => deltas.push(d) },
        )
        .catch((e: unknown) => e);
      expect(isCancelled(err)).toBe(true);
      expect(postprocessSpy.calls).toBe(0);
      expect(insert).not.toHaveBeenCalled();
      expect(deltas).toHaveLength(2);
    });

    it("(c') map-reduce: huỷ giữa stream lượt cuối ⇒ studioCancelled, không lưu", async () => {
      const ac = new AbortController();
      const { chat } = fakeProvider(label, {
        beforeDelta: (i) => {
          if (i === 1) ac.abort();
        },
      });
      const { svc, insert } = service(chat, { perSource: 6, budget: 1000 });
      const err = await svc
        .generate(
          { notebookId: "nb1", kind: "faq" },
          { signal: ac.signal, onToken: () => undefined },
        )
        .catch((e: unknown) => e);
      expect(isCancelled(err)).toBe(true);
      expect(insert).not.toHaveBeenCalled();
    });

    it("(d) không chuyển delta sau signal.aborted (kể cả provider vẫn gọi onToken)", async () => {
      const ac = new AbortController();
      const { chat } = fakeProvider(label, {
        leakAfterAbort: true,
        beforeDelta: (i) => {
          if (i === 3) ac.abort();
        },
      });
      const { svc } = service(chat);
      const deltas: string[] = [];
      await svc
        .generate(
          { notebookId: "nb1", kind: "summary" },
          { signal: ac.signal, onToken: (d) => deltas.push(d) },
        )
        .catch(() => undefined);
      expect(deltas).toHaveLength(3);
    });

    it("(e) không có onToken ⇒ chat KHÔNG nhận onToken (hành vi không-stream giữ nguyên)", async () => {
      const { chat, calls } = fakeProvider(label);
      const { svc, insert } = service(chat);
      await svc.generate({ notebookId: "nb1", kind: "summary" });
      expect(calls[0].opts?.onToken).toBeUndefined();
      expect(insert).toHaveBeenCalledTimes(1);
    });

    it("(f) có stream ⇒ chuỗi tiến độ (reading i/N → … → writing) KHÔNG đổi so với không stream", async () => {
      const run = async (stream: boolean) => {
        const { chat } = fakeProvider(label);
        const { svc } = service(chat, { perSource: 6, budget: 1000 });
        const steps: unknown[] = [];
        await svc.generate(
          { notebookId: "nb1", kind: "outline" },
          {
            onProgress: (s) => steps.push(s),
            ...(stream ? { onToken: () => undefined } : {}),
          },
        );
        return steps;
      };
      const plain = await run(false);
      expect(plain.length).toBeGreaterThan(1);
      expect(await run(true)).toEqual(plain);
    });

    it("onToken ném lỗi ⇒ lượt vẫn xong (stream chỉ là phụ)", async () => {
      const { chat } = fakeProvider(label);
      const { svc, insert } = service(chat);
      await svc.generate(
        { notebookId: "nb1", kind: "summary" },
        {
          onToken: () => {
            throw new Error("window gone");
          },
        },
      );
      expect(insert).toHaveBeenCalledTimes(1);
    });
  },
);
