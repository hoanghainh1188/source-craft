import {
  test,
  expect,
  type ElectronApplication,
  type Page,
} from "@playwright/test";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import { createServer, type Server } from "node:http";
import { chmod, mkdir, mkdtemp, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import {
  dismissOnboarding,
  launchAudit,
  launchFreshAt,
  readAuditRecords,
  readyWindow,
} from "./helper";
import {
  decryptQuestion,
  questionAad,
} from "../../src/main/services/audit/question-cipher";
import type { EncryptedText } from "../../src/main/services/audit/audit-types";

// 236 (T048–T049): nhật ký kiểm toán đầu-cuối với "Ollama" giả HTTP (đếm request /api/chat).
// Seam IV_E2E_POLICY_SYSTEM_PATH + IV_E2E_AUDIT_KEYSTORE=memory chỉ có hiệu lực ở bản chưa đóng gói.

const ANSWER = "Mức phạt là 8% giá trị phần vi phạm [1].";

interface Fake {
  server: Server;
  url: string;
  chats: () => number;
  hang: (on: boolean) => void;
}

async function fakeOllama(): Promise<Fake> {
  let chats = 0;
  let hang = false;
  const server = createServer((req, res) => {
    res.setHeader("content-type", "application/json");
    if (req.url === "/api/chat") {
      let body = "";
      req.on("data", (c) => (body += c));
      req.on("end", () => {
        chats += 1;
        if (hang) return; // giữ kết nối (giả lập lượt đang chạy khi app bị giết)
        res.end(JSON.stringify({ message: { content: ANSWER }, done: true }));
      });
      return;
    }
    if (req.url === "/api/show") {
      res.statusCode = 404;
      res.end("{}");
      return;
    }
    res.end(JSON.stringify({ models: [{ name: "fake:1b", size: 1 }] }));
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const { port } = server.address() as AddressInfo;
  return {
    server,
    url: `http://127.0.0.1:${port}`,
    chats: () => chats,
    hang: (on) => (hang = on),
  };
}

async function doc(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "sc-236-doc-"));
  const file = join(dir, "hop-dong.txt");
  await writeFile(
    file,
    "Hợp đồng cung ứng A. Điều 5: Mức phạt vi phạm là 8% giá trị phần nghĩa vụ bị vi phạm. Điều 6: Bồi thường thiệt hại.",
  );
  return file;
}

async function readyNotebook(win: Page, file: string): Promise<string> {
  const nbId = await win.evaluate(async (f) => {
    await window.api.aiSetSelectedModels({
      chatModel: "fake:1b",
      embeddingModel: null,
    });
    const nb = await window.api.notebookCreate({
      name: "Hợp đồng 2026",
      color: "#1E6B57",
    });
    await window.api.sourceAdd({ notebookId: nb.id, kind: "txt", filePath: f });
    return nb.id;
  }, file);
  await expect
    .poll(
      () =>
        win.evaluate(
          async (id) => (await window.api.sourceListByNotebook(id))[0]?.status,
          nbId,
        ),
      { timeout: 30_000 },
    )
    .toBe("ready");
  return nbId;
}

const ask = (win: Page, nbId: string, question: string, scope?: "all") =>
  win.evaluate(
    ({ id, q, s }) =>
      window.api.ragAsk({
        notebookId: id,
        question: q,
        mode: "grounded",
        history: [],
        ...(s ? { scope: s } : {}),
      }),
    { id: nbId, q: question, s: scope },
  );

const askError = (win: Page, nbId: string) =>
  win.evaluate(
    (id) =>
      window.api
        .ragAsk({
          notebookId: id,
          question: "Mức phạt?",
          mode: "grounded",
          history: [],
        })
        .then(() => "ok")
        .catch((e: Error) => e.message),
    nbId,
  );

async function close(
  app: ElectronApplication | undefined,
  fake: Fake | undefined,
) {
  await app?.close().catch(() => {});
  fake?.server.close();
}

test("236 — bật audit: cặp start/end mỗi lượt, câu hỏi mã hoá, không có câu trả lời, xuất + xoá chat", async () => {
  test.setTimeout(120_000);
  const fake = await fakeOllama();
  const run = await launchAudit({ OLLAMA_HOST: fake.url });
  try {
    const win = await readyWindow(run.app);
    await dismissOnboarding(win);
    const nbId = await readyNotebook(win, await doc());

    const QS = [
      "Mức phạt vi phạm là bao nhiêu?",
      "Điều 6 nói gì?",
      "Tổng hợp mọi hợp đồng?",
    ];
    await ask(win, nbId, QS[0]!);
    await ask(win, nbId, QS[1]!);
    await ask(win, nbId, QS[2]!, "all");
    await win.evaluate(
      (id) =>
        window.api.studioGenerate({
          notebookId: id,
          // 248: loại core (bản stub không có "custom"); mã hoá yêu cầu custom test ở unit (interaction-outcome).
          kind: "summary",
        }),
      nbId,
    );

    // Xuất: thay hộp thoại lưu ở main bằng đường dẫn tạm (export.ts gọi dialog.showSaveDialog lúc chạy).
    const exportPath = join(
      await mkdtemp(join(tmpdir(), "sc-236-exp-")),
      "Bao cao.md",
    );
    await run.app.evaluate(({ dialog }, p) => {
      dialog.showSaveDialog = (async () => ({
        canceled: false,
        filePath: p,
      })) as typeof dialog.showSaveDialog;
    }, exportPath);
    await win.evaluate(
      (id) =>
        window.api.studioExport({
          content: "x",
          suggestedName: "Bao cao",
          format: "md",
          notebookId: id,
          studioKind: "summary",
        }),
      nbId,
    );

    const recs = await readAuditRecords(run.auditDir);
    const starts = recs.filter((r) => r["type"] === "interaction.start");
    const ends = recs.filter((r) => r["type"] === "interaction.end");
    expect(starts).toHaveLength(4);
    expect(ends).toHaveLength(4);
    expect(ends.map((e) => e["interactionId"])).toEqual(
      starts.map((s) => s["interactionId"]),
    );
    expect(starts[2]!["scope"]).toEqual({ kind: "all" });
    expect(starts[0]!["scope"]).toMatchObject({
      kind: "notebook",
      notebookName: "Hợp đồng 2026",
    });
    expect(starts[0]!["model"]).toMatchObject({
      category: "local",
      providerId: "ollama",
      model: "fake:1b",
    });

    // Tóm tắt (summary) không có câu hỏi người dùng ⇒ bản ghi Studio không mang trường question.
    expect(starts[3]).not.toHaveProperty("question");
    const plain = starts
      .slice(0, 3)
      .map((s) =>
        decryptQuestion(
          s["question"] as EncryptedText,
          run.orgPrivateKeyPem,
          questionAad(s["seq"] as number, s["interactionId"] as string),
        ),
      );
    expect(plain).toEqual(QS);

    const raw = JSON.stringify(recs);
    expect(raw).not.toContain("Mức phạt vi phạm là bao nhiêu"); // câu hỏi chỉ ở dạng mã hoá
    expect(raw).not.toContain("8% giá trị phần vi phạm"); // câu trả lời không bao giờ ghi (FR-012)

    expect(recs.at(-1)).toMatchObject({
      type: "export.saved",
      format: "md",
      notebookName: "Hợp đồng 2026",
      studioKind: "summary",
      fileName: "Bao cao.md",
    });

    const before = JSON.stringify(await readAuditRecords(run.auditDir));
    await win.evaluate((id) => window.api.chatClear(id), nbId);
    expect(JSON.stringify(await readAuditRecords(run.auditDir))).toBe(before); // FR-021
  } finally {
    await close(run.app, fake);
  }
});

test("236 — policy chỉ ở userData ⇒ không ghi; policy hệ thống hỏng ⇒ chặn, 0 request tới model", async () => {
  test.setTimeout(120_000);
  const fake = await fakeOllama();
  // (b) chỉ tệp userData bật audit, tệp "hệ thống" không tồn tại.
  const userData = await mkdtemp(join(tmpdir(), "sc-236-ud-"));
  const userPolicyDir = await mkdtemp(join(tmpdir(), "sc-236-up-"));
  const { writeAuditPolicy } = await import("./helper");
  const up = await writeAuditPolicy(userPolicyDir, {
    auditDir: join(userPolicyDir, "audit"),
  });
  const { readFile } = await import("node:fs/promises");
  await writeFile(
    join(userData, "enterprise-policy.json"),
    await readFile(up.policyPath, "utf8"),
  );
  let app: ElectronApplication | undefined;
  try {
    ({ app } = await launchFreshAt(
      {
        OLLAMA_HOST: fake.url,
        IV_E2E_POLICY_SYSTEM_PATH: join(userPolicyDir, "khong-co.json"),
        IV_E2E_AUDIT_KEYSTORE: "memory",
      },
      userData,
    ));
    const win = await readyWindow(app);
    await dismissOnboarding(win);
    const nbId = await readyNotebook(win, await doc());
    await ask(win, nbId, "Mức phạt?");
    expect(await readAuditRecords(join(userPolicyDir, "audit"))).toEqual([]);
    expect(await readAuditRecords(join(userData, "audit"))).toEqual([]);
  } finally {
    await app?.close().catch(() => {});
  }

  // (c) tệp hệ thống hỏng ⇒ auditPolicyInvalid, model không nhận request nào.
  const broken = await launchAudit(
    { OLLAMA_HOST: fake.url },
    { brokenPolicy: true },
  );
  try {
    const win = await readyWindow(broken.app);
    await dismissOnboarding(win);
    const nbId = await readyNotebook(win, await doc());
    const before = fake.chats();
    expect(await askError(win, nbId)).toContain("auditPolicyInvalid");
    expect(fake.chats()).toBe(before);
  } finally {
    await close(broken.app, fake);
  }
});

test("236 — thư mục không ghi được ⇒ chặn (fail-closed), 0 request; trả quyền ⇒ chạy + audit.recovered", async () => {
  test.skip(
    process.platform === "win32" || process.getuid?.() === 0,
    "chmod không chặn ghi (Windows / root)",
  );
  test.setTimeout(120_000);
  const fake = await fakeOllama();
  const run = await launchAudit({ OLLAMA_HOST: fake.url });
  try {
    const win = await readyWindow(run.app);
    await dismissOnboarding(win);
    const nbId = await readyNotebook(win, await doc());
    await ask(win, nbId, "Lượt đầu?");
    await chmod(run.auditDir, 0o500);
    for (const n of await readdir(run.auditDir))
      await chmod(join(run.auditDir, n), 0o400);
    const before = fake.chats();
    expect(await askError(win, nbId)).toContain("auditWriteFailed");
    expect(fake.chats()).toBe(before);
    // PR C: chip header chuyển sang cảnh báo khi không ghi được.
    await expect(win.getByTestId("audit-status-chip")).toHaveAttribute(
      "data-state",
      "blocked",
    );
    await chmod(run.auditDir, 0o700);
    for (const n of await readdir(run.auditDir))
      await chmod(join(run.auditDir, n), 0o600);
    expect(await askError(win, nbId)).toBe("ok");
    await expect(win.getByTestId("audit-status-chip")).toHaveAttribute(
      "data-state",
      "active",
    );
    const types = (await readAuditRecords(run.auditDir)).map((r) => r["type"]);
    expect(types.slice(-3)).toEqual([
      "audit.recovered",
      "interaction.start",
      "interaction.end",
    ]);
  } finally {
    await chmod(run.auditDir, 0o700).catch(() => {});
    await close(run.app, fake);
  }
});

test("236 — bản quyền free ⇒ AI chạy, không có tệp audit", async () => {
  test.setTimeout(90_000);
  const fake = await fakeOllama();
  const run = await launchAudit({
    OLLAMA_HOST: fake.url,
    IV_E2E_LICENSE_TIER: "free",
  });
  try {
    const win = await readyWindow(run.app);
    await dismissOnboarding(win);
    const nbId = await readyNotebook(win, await doc());
    expect(await askError(win, nbId)).toBe("ok");
    expect(await readAuditRecords(run.auditDir)).toEqual([]);
  } finally {
    await close(run.app, fake);
  }
});

test("236 — vòng đời: started / stopped khi thoát; bị giết giữa lượt ⇒ sessionAborted lần mở sau (T049)", async () => {
  test.setTimeout(150_000);
  const fake = await fakeOllama();
  const root = await mkdtemp(join(tmpdir(), "sc-236-life-"));
  const auditDir = join(root, "audit");
  await mkdir(auditDir);
  const { writeAuditPolicy } = await import("./helper");
  const policy = await writeAuditPolicy(root, { auditDir });

  const first = await launchAudit(
    { OLLAMA_HOST: fake.url },
    { auditDir, policyPath: policy.policyPath },
  );
  const win = await readyWindow(first.app);
  await dismissOnboarding(win);
  const nbId = await readyNotebook(win, await doc());
  await first.app.close();
  let types = (await readAuditRecords(auditDir)).map((r) => r["type"]);
  expect(types[0]).toBe("audit.chainStarted");
  expect(types).toContain("audit.started");
  expect(types.at(-1)).toBe("audit.stopped");

  const second = await launchAudit(
    { OLLAMA_HOST: fake.url },
    { auditDir, policyPath: policy.policyPath, userData: first.userData },
  );
  const win2 = await readyWindow(second.app);
  fake.hang(true);
  // Promise này bị huỷ khi tiến trình bị giết (đúng ý) ⇒ nuốt lỗi.
  void win2
    .evaluate(
      (id) =>
        window.api
          .ragAsk({
            notebookId: id,
            question: "Mức phạt vi phạm là bao nhiêu?",
            mode: "grounded",
            history: [],
          })
          .catch(() => {}),
      nbId,
    )
    .catch(() => {});
  const chatsBefore = fake.chats();
  // Chờ model THẬT nhận request (lượt đang treo ở bước gọi model, không phải notFound sớm).
  await expect
    .poll(() => fake.chats(), { timeout: 15_000 })
    .toBeGreaterThan(chatsBefore);
  const open = (await readAuditRecords(auditDir)).find(
    (r) => r["type"] === "interaction.start",
  )!;
  second.app.process().kill("SIGKILL");
  fake.hang(false);

  const third = await launchAudit(
    { OLLAMA_HOST: fake.url },
    { auditDir, policyPath: policy.policyPath, userData: first.userData },
  );
  try {
    await readyWindow(third.app);
    await expect
      .poll(
        async () =>
          (await readAuditRecords(auditDir)).some(
            (r) => r["type"] === "audit.sessionAborted",
          ),
        {
          timeout: 15_000,
        },
      )
      .toBe(true);
    const aborted = (await readAuditRecords(auditDir)).find(
      (r) => r["type"] === "audit.sessionAborted",
    )!;
    expect(aborted["openInteractions"]).toEqual([open["interactionId"]]);
    types = (await readAuditRecords(auditDir)).map((r) => r["type"]);
    expect(types).toContain("audit.keyRotated"); // khoá bộ nhớ mất cùng tiến trình ⇒ đổi khoá có ghi nhận
  } finally {
    await close(third.app, fake);
  }
});

test("236 — chi phí audit tới lúc nhận câu trả lời ≤ 50 ms (trung vị, SC-005)", async () => {
  test.setTimeout(180_000);
  const fake = await fakeOllama();
  const measure = async (withAudit: boolean): Promise<number> => {
    const app = withAudit
      ? (await launchAudit({ OLLAMA_HOST: fake.url })).app
      : (await launchFreshAt({ OLLAMA_HOST: fake.url })).app;
    try {
      const win = await readyWindow(app);
      await dismissOnboarding(win);
      const nbId = await readyNotebook(win, await doc());
      await ask(win, nbId, "khởi động"); // làm nóng
      const times: number[] = [];
      for (let i = 0; i < 20; i++) {
        const t = Date.now();
        await ask(win, nbId, `Câu ${i}?`);
        times.push(Date.now() - t);
      }
      times.sort((a, b) => a - b);
      return times[10]!;
    } finally {
      await app.close().catch(() => {});
    }
  };
  try {
    const off = await measure(false);
    const on = await measure(true);
    expect(on - off).toBeLessThanOrEqual(50);
  } finally {
    fake.server.close();
  }
});

// 236 (PR C, T076): minh bạch với người dùng — chip header + Cài đặt chỉ đọc, đổi theo trạng thái và ngôn ngữ.
async function openSettings(win: Page): Promise<void> {
  await win.getByTestId("nav-settings").click();
  await expect(win.getByTestId("placeholder-settings")).toBeVisible();
}

test("236 — chip + Cài đặt: active hiện chip, vị trí theo nhãn, không có điều khiển, đổi vi↔en", async () => {
  test.setTimeout(90_000);
  const run = await launchAudit({});
  try {
    const win = await readyWindow(run.app);
    await dismissOnboarding(win);
    const chip = win.getByTestId("audit-status-chip");
    await expect(chip).toBeVisible();
    await expect(chip).toHaveAttribute("data-state", "active");
    await expect(chip).toContainText("Đang ghi nhật ký kiểm toán");
    // Tooltip đọc được bằng bàn phím (focus ⇒ hiện, gắn aria-describedby).
    await chip.focus();
    const tipId = await chip.getAttribute("aria-describedby");
    await expect(win.locator(`[id="${tipId}"]`)).toBeVisible();

    await openSettings(win);
    const section = win.getByTestId("settings-audit-section");
    await expect(win.getByTestId("settings-audit-state")).toHaveText(
      "Đang ghi",
    );
    await expect(win.getByTestId("settings-audit-directory")).toHaveText(
      "Do bộ phận IT chỉ định",
    );
    // Không bao giờ hiện đường dẫn thư mục nhật ký.
    await expect(section).not.toContainText(run.auditDir);
    expect(
      await section.locator("button, input, select, textarea").count(),
    ).toBe(0);

    await win.evaluate(() => window.api.setUiLanguage("en"));
    await expect(chip).toContainText("Audit logging on");
    await expect(win.getByTestId("settings-audit-state")).toHaveText(
      "Recording",
    );
  } finally {
    await run.app.close().catch(() => {});
  }
});

test("236 — chip + Cài đặt: free ⇒ không chip, báo cần Enterprise; policy hỏng ⇒ không chip, báo lý do", async () => {
  test.setTimeout(120_000);
  const free = await launchAudit({ IV_E2E_LICENSE_TIER: "free" });
  try {
    const win = await readyWindow(free.app);
    await dismissOnboarding(win);
    await openSettings(win);
    await expect(win.getByTestId("settings-audit-state")).toContainText(
      "cần bản quyền Enterprise",
    );
    await expect(win.getByTestId("audit-status-chip")).toHaveCount(0);
  } finally {
    await free.app.close().catch(() => {});
  }

  const broken = await launchAudit({}, { brokenPolicy: true });
  try {
    const win = await readyWindow(broken.app);
    await dismissOnboarding(win);
    await openSettings(win);
    await expect(win.getByTestId("settings-audit-state")).toHaveText(
      "Lỗi chính sách — AI tạm khoá",
    );
    await expect(win.getByTestId("settings-audit-reason")).toBeVisible();
    await expect(win.getByTestId("audit-status-chip")).toHaveCount(0);
  } finally {
    await broken.app.close().catch(() => {});
  }
});
