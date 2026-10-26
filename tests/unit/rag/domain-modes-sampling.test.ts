import { afterEach, describe, expect, it, vi } from "vitest";
import type { ChatOptions } from "../../../src/main/services/rag/rag-service";
import { createRagService } from "../../../src/main/services/rag/rag-service";
import {
  MEDICAL_DISCLAIMER_EN,
  MEDICAL_DISCLAIMER_VI,
} from "../../../src/main/services/rag/prompt";
import { toOpenAIRequest } from "../../../src/main/services/ai-runtime/online/openai-provider";
import { ProUnavailableError } from "../../../src/main/services/pro-bridge/pro-unavailable";
import { setFakeProAvailable } from "../helpers/fake-pro";

// 248 (đợt 2): chỉ dẫn chuyên gia nằm ở module Pro — dùng module Pro GIẢ để kiểm phần core (nhiệt độ, disclaimer, cổng stub).
vi.mock("../../../src/main/pro", () => import("../helpers/fake-pro"));

afterEach(() => setFakeProAvailable(true));

describe("238 — Domain-specific AI modes sampling temperature", () => {
  const baseDeps = {
    embed: async () => [0.1, 0.2, 0.3],
    search: async () => [
      {
        id: "chk-1",
        sourceId: "src-1",
        score: 0.1,
      },
    ],
    searchBm25: () => [{ id: "chk-1", score: -5.0 }],
    getChunksByIds: () => [
      {
        id: "chk-1",
        sourceId: "src-1",
        ordinal: 0,
        text: "Điều 15 Hợp đồng quy định phạt vi phạm 8% giá trị vi phạm.",
        locator: { page: 2, charStart: 0, charEnd: 80 },
      },
    ],
    sourceTitle: () => "HopDongDichVu.pdf",
  };

  it("chế độ legal → chat nhận temperature = 0.1", async () => {
    let capturedOptions: ChatOptions | undefined;
    const rag = createRagService({
      ...baseDeps,
      chat: async (_messages, options) => {
        capturedOptions = options;
        return "Theo Điều 15 [1], mức phạt là 8%.";
      },
      chatStream: async () => "",
    });

    await rag.ask({
      notebookId: "nb-1",
      question: "Phạt vi phạm thế nào?",
      mode: "grounded",
      history: [],
      domainMode: "legal",
    });

    expect(capturedOptions?.temperature).toBe(0.1);
  });

  it("chế độ medical → chatStream nhận temperature = 0.1", async () => {
    let capturedOptions: ChatOptions | undefined;
    const rag = createRagService({
      ...baseDeps,
      chat: async () => "",
      chatStream: async (_messages, _opts, options) => {
        capturedOptions = options;
        return "Liều dùng [1].";
      },
    });

    await rag.askStream(
      {
        notebookId: "nb-1",
        question: "Liều dùng paracetamol?",
        mode: "grounded",
        history: [],
        domainMode: "medical",
      },
      {},
    );

    expect(capturedOptions?.temperature).toBe(0.1);
  });

  it("chế độ general hoặc mặc định → temperature là undefined", async () => {
    let capturedOptions: ChatOptions | undefined;
    const rag = createRagService({
      ...baseDeps,
      chat: async (_messages, options) => {
        capturedOptions = options;
        return "Câu trả lời thông thường [1].";
      },
      chatStream: async () => "",
    });

    await rag.ask({
      notebookId: "nb-1",
      question: "Nội dung chung?",
      mode: "grounded",
      history: [],
      domainMode: "general",
    });

    expect(capturedOptions?.temperature).toBeUndefined();
  });

  it("chế độ medical ⇒ app gắn disclaimer vào câu trả lời dù model không viết", async () => {
    const rag = createRagService({
      ...baseDeps,
      chat: async () => "",
      chatStream: async () => "Liều dùng theo phác đồ [1].",
    });
    const res = await rag.askStream(
      {
        notebookId: "nb-1",
        question: "Liều dùng paracetamol cho người lớn là bao nhiêu?",
        mode: "grounded",
        history: [],
        domainMode: "medical",
      },
      {},
    );
    expect(res.notFound).toBe(false);
    expect(res.answer.endsWith(MEDICAL_DISCLAIMER_VI)).toBe(true);
  });

  it("chế độ legal/general ⇒ không gắn disclaimer y khoa", async () => {
    const rag = createRagService({
      ...baseDeps,
      chat: async () => "Theo Điều 15 [1], mức phạt là 8%.",
      chatStream: async () => "",
    });
    const res = await rag.ask({
      notebookId: "nb-1",
      question: "Phạt vi phạm thế nào?",
      mode: "grounded",
      history: [],
      domainMode: "legal",
    });
    expect(res.answer).not.toContain(MEDICAL_DISCLAIMER_VI);
    expect(res.answer).not.toContain(MEDICAL_DISCLAIMER_EN);
  });

  it("OpenAI: model reasoning (o1/o3/o4, gpt-5) ⇒ bỏ temperature để tránh HTTP 400", () => {
    for (const model of ["o1", "o3-mini", "o4-mini", "gpt-5", "gpt-5-mini"]) {
      expect(toOpenAIRequest([], model, 0.1)).not.toHaveProperty("temperature");
    }
    for (const model of ["gpt-4o", "gpt-4o-mini", "gpt-4.1"]) {
      expect(toOpenAIRequest([], model, 0.1).temperature).toBe(0.1);
    }
    expect(toOpenAIRequest([], "gpt-4o")).not.toHaveProperty("temperature");
  });

  it("248: bản không có Pro ⇒ chế độ chuyên gia bị từ chối TRƯỚC truy xuất / gọi AI", async () => {
    setFakeProAvailable(false);
    let embedded = false;
    let chatted = false;
    const rag = createRagService({
      ...baseDeps,
      embed: async () => {
        embedded = true;
        return [0.1, 0.2, 0.3];
      },
      chat: async () => {
        chatted = true;
        return "";
      },
      chatStream: async () => "",
    });
    for (const domainMode of ["legal", "medical"] as const) {
      await expect(
        rag.ask({
          notebookId: "nb-1",
          question: "Phạt vi phạm thế nào?",
          mode: "grounded",
          history: [],
          domainMode,
        }),
      ).rejects.toBeInstanceOf(ProUnavailableError);
    }
    expect(embedded).toBe(false);
    expect(chatted).toBe(false);
  });
});
