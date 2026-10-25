import { describe, expect, it, vi } from "vitest";
import { UserFacingError } from "@shared/codes/user-error";
import {
  decryptQuestion,
  questionAad,
} from "../../../src/main/services/audit/question-cipher";
import type {
  InteractionEndBody,
  InteractionMeta,
  InteractionStartBody,
} from "../../../src/main/services/audit/audit-types";
import { memoryKeystore } from "./helpers";
import { ORG, harness } from "./service-harness";

// T018 (236) — runInteraction: write-ahead, fail-closed, mã hoá câu hỏi, không ghi câu trả lời (FR-007–FR-012, FR-016, FR-016a, FR-002).

const QUESTION = "Điều khoản phạt vi phạm trong HĐ cung ứng là bao nhiêu?";
const ANSWER = "SECRET-ANSWER-TEXT";
const meta = (o: Partial<InteractionMeta> = {}): InteractionMeta => ({
  channel: "rag",
  scope: {
    kind: "notebook",
    notebookId: "nb_7",
    notebookName: "Hợp đồng 2026",
  },
  question: QUESTION,
  model: { category: "local", providerId: "ollama", model: "qwen2.5:7b" },
  ...o,
});
const done = () => ({ status: "completed" as const, citations: [] });

async function active() {
  const h = harness();
  await h.service.start();
  return h;
}
const starts = (h: Awaited<ReturnType<typeof active>>) =>
  h
    .records()
    .filter(
      (r): r is typeof r & InteractionStartBody =>
        r.type === "interaction.start",
    );
const ends = (h: Awaited<ReturnType<typeof active>>) =>
  h
    .records()
    .filter(
      (r): r is typeof r & InteractionEndBody => r.type === "interaction.end",
    );

describe("runInteraction — active", () => {
  it("ghi start TRƯỚC khi gọi run, end SAU với outcome", async () => {
    const h = await active();
    const order: string[] = [];
    const run = vi.fn(async () => {
      order.push(`run:${starts(h).length}`);
      return { answer: ANSWER };
    });
    await h.service.runInteraction(meta(), run, () => {
      order.push("summarize");
      return done();
    });
    expect(order).toEqual(["run:1", "summarize"]);
    expect(h.types().slice(-2)).toEqual([
      "interaction.start",
      "interaction.end",
    ]);
    expect(ends(h)[0]).toMatchObject({
      interactionId: "int-1",
      status: "completed",
    });
  });

  it("start có osUser + host + scope + model; question là bản mã giải được bằng khoá tổ chức với AAD seq|id", async () => {
    const h = await active();
    await h.service.runInteraction(meta(), async () => ({}), done);
    const s = starts(h)[0]!;
    expect(s).toMatchObject({
      osUser: "CORP\\nguyen.an",
      host: "BANK-LT-0142",
      channel: "rag",
      scope: { kind: "notebook", notebookId: "nb_7" },
      model: { category: "local", providerId: "ollama", model: "qwen2.5:7b" },
    });
    expect(JSON.stringify(s)).not.toContain("phạt vi phạm");
    expect(
      decryptQuestion(
        s.question!,
        ORG.privateKeyPem,
        questionAad(s.seq, s.interactionId),
      ),
    ).toBe(QUESTION);
  });

  it("câu trả lời KHÔNG xuất hiện trong bất kỳ bản ghi nào (FR-012)", async () => {
    const h = await active();
    await h.service.runInteraction(
      meta(),
      async () => ({ answer: ANSWER }),
      done,
    );
    expect(h.fs.linesIn("/data/audit").join("\n")).not.toContain(ANSWER);
  });

  it("Studio không phải custom ⇒ không có question; custom ⇒ có", async () => {
    const h = await active();
    await h.service.runInteraction(
      meta({
        channel: "studio",
        question: undefined,
        studioKind: "summary",
        sourceScope: { all: true },
      }),
      async () => ({}),
      done,
    );
    await h.service.runInteraction(
      meta({
        channel: "studio",
        question: "Tóm tắt rủi ro",
        studioKind: "custom",
        sourceScope: { sourceIds: ["s1"] },
      }),
      async () => ({}),
      done,
    );
    const [a, b] = starts(h);
    expect(a!.question).toBeUndefined();
    expect(a).toMatchObject({
      studioKind: "summary",
      sourceScope: { all: true },
    });
    expect(b!.question).toBeDefined();
  });

  it("run ném ⇒ end{error} rồi ném lại đúng lỗi gốc", async () => {
    const h = await active();
    const boom = new UserFacingError("questionTooLong");
    await expect(
      h.service.runInteraction(
        meta(),
        async () => {
          throw boom;
        },
        done,
      ),
    ).rejects.toBe(boom);
    expect(ends(h)[0]).toMatchObject({
      status: "error",
      errorCode: "questionTooLong",
    });
  });

  it("ghi start lỗi ⇒ auditWriteFailed, run KHÔNG được gọi, status blocked", async () => {
    const h = await active();
    h.fs.failAppend = { code: "ENOSPC" };
    const run = vi.fn(async () => ({}));
    await expect(
      h.service.runInteraction(meta(), run, done),
    ).rejects.toMatchObject({ code: "auditWriteFailed" });
    expect(run).not.toHaveBeenCalled();
    expect(h.service.status()).toMatchObject({
      state: "blocked",
      reason: "writeFailed",
      blockedSince: expect.any(Number),
    });
  });

  it("ghi lại được sau blocked ⇒ audit.recovered{since} trước start mới", async () => {
    const h = await active();
    h.fs.failAppend = { code: "EACCES" };
    await expect(
      h.service.runInteraction(meta(), async () => ({}), done),
    ).rejects.toBeInstanceOf(UserFacingError);
    h.fs.failAppend = null;
    await h.service.runInteraction(meta(), async () => ({}), done);
    expect(h.types().slice(-3)).toEqual([
      "audit.recovered",
      "interaction.start",
      "interaction.end",
    ]);
    expect(h.service.status().state).toBe("active");
  });

  it("ghi end lỗi ⇒ vẫn trả kết quả, lượt sau bị chặn", async () => {
    const h = await active();
    const result = await h.service.runInteraction(
      meta(),
      async () => {
        h.fs.failAppend = { code: "ENOSPC" };
        return 42;
      },
      done,
    );
    expect(result).toBe(42);
    expect(h.service.status().state).toBe("blocked");
    const run = vi.fn(async () => 1);
    await expect(
      h.service.runInteraction(meta(), run, done),
    ).rejects.toMatchObject({ code: "auditWriteFailed" });
    expect(run).not.toHaveBeenCalled();
  });
});

describe("runInteraction — không active", () => {
  it.each([["off", { status: "notConfigured" } as const]])(
    "%s ⇒ chỉ chạy run, không ghi",
    async (_n, policy) => {
      const h = harness({ policy });
      await h.service.start();
      await expect(
        h.service.runInteraction(meta(), async () => 7, done),
      ).resolves.toBe(7);
      expect(h.fs.files.size).toBe(0);
    },
  );

  it("licenseInactive ⇒ chỉ chạy run, không ghi", async () => {
    const h = harness({ license: { valid: false, itPolicy: true } });
    await h.service.start();
    await expect(
      h.service.runInteraction(meta(), async () => 7, done),
    ).resolves.toBe(7);
    expect(h.fs.files.size).toBe(0);
  });

  it("policyError ⇒ auditPolicyInvalid, run không gọi", async () => {
    const h = harness({
      policy: { status: "policyError", reason: "unreadableSystemPolicy" },
    });
    await h.service.start();
    const run = vi.fn(async () => 1);
    await expect(
      h.service.runInteraction(meta(), run, done),
    ).rejects.toMatchObject({ code: "auditPolicyInvalid" });
    expect(run).not.toHaveBeenCalled();
  });

  it("keychain không truy cập được ⇒ auditKeyUnavailable, run không gọi", async () => {
    const ks = memoryKeystore();
    ks.failing = true;
    const h = harness({ keyStore: ks });
    await h.service.start();
    const run = vi.fn(async () => 1);
    await expect(
      h.service.runInteraction(meta(), run, done),
    ).rejects.toMatchObject({ code: "auditKeyUnavailable" });
    expect(run).not.toHaveBeenCalled();
  });

  it("bản quyền đổi giữa hai lượt (không qua reevaluate) ⇒ lượt sau theo trạng thái mới (FR-002)", async () => {
    const h = harness({ license: { valid: false, itPolicy: true } });
    await h.service.start();
    await h.service.runInteraction(meta(), async () => 1, done);
    expect(h.fs.files.size).toBe(0);
    h.env.license = { valid: true, itPolicy: true };
    await h.service.runInteraction(meta(), async () => 1, done);
    expect(h.types()).toContain("interaction.start");
    h.env.license = { valid: false, itPolicy: true };
    await h.service.runInteraction(meta(), async () => 1, done);
    expect(h.types().slice(-1)).toEqual(["audit.stopped"]);
    expect(h.records().at(-1)).toMatchObject({ reason: "licenseInactive" });
  });
});

describe("runInteraction — review", () => {
  it("summarize ném ⇒ vẫn trả kết quả, end{error} được ghi, không để tương tác mở", async () => {
    const h = await active();
    const r = await h.service.runInteraction(
      meta(),
      async () => 99,
      () => {
        throw new TypeError("citations is not iterable");
      },
    );
    expect(r).toBe(99);
    expect(ends(h)[0]).toMatchObject({
      status: "error",
      errorCode: "TypeError",
    });
  });

  it("policyError + bản quyền KHÔNG đủ ⇒ không chặn AI (FR-001, FR-004)", async () => {
    const h = harness({
      policy: { status: "policyError", reason: "unreadableSystemPolicy" },
      license: { valid: true, itPolicy: false },
    });
    await h.service.start();
    await expect(
      h.service.runInteraction(meta(), async () => 1, done),
    ).resolves.toBe(1);
    expect(h.service.status().state).toBe("licenseInactive");
  });
});
