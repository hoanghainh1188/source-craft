import {
  _electron as electron,
  type ElectronApplication,
  type Page,
} from "@playwright/test";
import { join } from "node:path";
import { mkdtemp } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";

export const MAIN = join(process.cwd(), "out/main/index.js");

/**
 * 248: bản đang test có module Pro thật không (đã chép đè src/main/pro/ bằng repo source-craft-pro). Repo public chạy
 * với stub ⇒ e2e của chức năng Pro (vd Studio "custom") bị bỏ qua; luồng chung dùng loại core (summary, keyPoints).
 */
export function isProBuild(): boolean {
  return readFileSync(
    join(process.cwd(), "src/main/pro/index.ts"),
    "utf8",
  ).includes("LicenseRef-SourceCraft-Pro");
}

/** Launch app với userData TẠM (cô lập trạng thái, không đụng store thật của người dùng). */
export async function launchFresh(
  env?: Record<string, string>,
): Promise<ElectronApplication> {
  return (await launchFreshAt(env)).app;
}

/**
 * Như launchFresh nhưng trả kèm đường dẫn userData tạm — test cần đọc tệp trong userData (nhật ký…) dùng cái này
 * thay vì hỏi main qua app.evaluate ngay sau launch (đua với lần điều hướng đầu của cửa sổ ⇒ "Execution context
 * was destroyed" chập chờn trên CI).
 */
export async function launchFreshAt(
  env?: Record<string, string>,
  existingUserData?: string,
): Promise<{ app: ElectronApplication; userData: string }> {
  const userData =
    existingUserData ?? (await mkdtemp(join(tmpdir(), "iv-e2e-")));
  const app = await electron.launch({
    args: [MAIN, `--user-data-dir=${userData}`],
    // 059: embedding fake tất định trong E2E → không tải model e5 (~120MB), offline, nhanh, ổn định.
    env: {
      ...process.env,
      IV_EMBED_FAKE: "1",
      // 109: bộ chấm độ liên quan giả tất định — KHÔNG tải model ~119 MB trong e2e (nguồn ready ⇒ prefetch).
      IV_RERANK_FAKE: "1",
      IV_UI_LANG: "vi",
      // 226: mở khoá tầng enterprise mặc định cho các bài test tính năng E2E (Studio 9 loại, đa phương tiện, >3 notebooks).
      // Các bài test kiểm tra giới hạn gói Free có thể truyền { IV_E2E_LICENSE_TIER: "free" } để ghi đè.
      IV_E2E_LICENSE_TIER: "enterprise",
      ...(env ?? {}),
    } as Record<string, string>,
  });
  return { app, userData };
}

/**
 * 196: chờ cửa sổ đầu tải xong DOM rồi mới trả — gọi trước mọi app.evaluate ở đầu test. app.evaluate ngay sau launch
 * đua với lần điều hướng đầu ⇒ "Execution context was destroyed" chập chờn trên CI (ubuntu + xvfb).
 */
export async function readyWindow(app: ElectronApplication): Promise<Page> {
  const win = await app.firstWindow();
  await win.waitForLoadState("domcontentloaded");
  return win;
}

/**
 * 196: app.evaluate ở main process, thử lại đúng 1 lần nếu ngữ cảnh bị huỷ do điều hướng. `fn` PHẢI idempotent (lần
 * đầu có thể đã chạy một phần trước khi lỗi ném về) và không dùng biến đóng gói — truyền qua `arg` (hàm bị tuần tự hoá).
 */
export async function evaluateMain<R, A = undefined>(
  app: ElectronApplication,
  fn: (electron: typeof import("electron"), arg: A) => R | Promise<R>,
  arg?: A,
): Promise<R> {
  try {
    return await app.evaluate(fn, arg as A);
  } catch (e) {
    if (!String(e).includes("Execution context was destroyed")) throw e;
    return await app.evaluate(fn, arg as A);
  }
}

/** Đặt kích thước cửa sổ đầu (chờ cửa sổ sẵn sàng trước — xem readyWindow). Trả cửa sổ. */
export async function sizedWindow(
  app: ElectronApplication,
  width: number,
  height: number,
): Promise<Page> {
  const win = await readyWindow(app);
  await evaluateMain(
    app,
    ({ BrowserWindow }, [w, h]) =>
      BrowserWindow.getAllWindows()[0]!.setSize(w, h),
    [width, height] as const,
  );
  return win;
}

/** OLLAMA_HOST trỏ cổng chắc chắn không có service → ping fail → ollamaReady=false (tất định). */
export const UNREACHABLE_OLLAMA = { OLLAMA_HOST: "http://127.0.0.1:1" };

/** Đóng onboarding modal lần đầu (chờ nó xuất hiện do IPC async, rồi bấm "Bắt đầu"). */
export async function dismissOnboarding(win: Page): Promise<void> {
  const onboarding = win.getByTestId("onboarding");
  await onboarding.waitFor({ state: "visible", timeout: 5000 }).catch(() => {});
  if (await onboarding.isVisible().catch(() => false)) {
    await win.getByTestId("onboarding-start").click();
    await onboarding.waitFor({ state: "hidden", timeout: 5000 });
  }
}

/**
 * 186: app cho e2e Ghi cuộc họp — ASR giả + tín hiệu thử thay micro (IV_E2E_FAKE_MIC; spike S1: cờ fake audio của Chromium
 * treo chờ quyền micro macOS). `denied` ⇒ giả lập hệ điều hành từ chối quyền micro. Chỉ có hiệu lực ở bản chưa đóng gói.
 */
export async function launchMeeting(
  opts: {
    denied?: boolean;
    env?: Record<string, string>;
    /** 186 PR C1: mở lại trên cùng userData (phục hồi sau sự cố / sau khi thoát). */
    userData?: string;
  } = {},
): Promise<{ app: ElectronApplication; userData: string }> {
  return launchFreshAt(
    {
      IV_ASR_FAKE: "1",
      ...(opts.denied ? { IV_E2E_MIC_DENIED: "1" } : { IV_E2E_FAKE_MIC: "1" }),
      ...(opts.env ?? {}),
    },
    opts.userData,
  );
}

/** Tạo notebook qua API rồi mở Workspace của nó. Trả id. */
export async function openNewWorkspace(
  win: Page,
  name = "Họp e2e",
): Promise<string> {
  const id = await win.evaluate(
    async (n) =>
      (await window.api.notebookCreate({ name: n, color: "#1E6B57" })).id,
    name,
  );
  await win.evaluate((nb) => {
    window.location.hash = `#/workspace/${nb}`;
  }, id);
  await win.getByTestId("workspace").waitFor({ state: "visible" });
  return id;
}

/**
 * 236: app với nhật ký kiểm toán bật — policy "hệ thống" giả (seam IV_E2E_POLICY_SYSTEM_PATH) + khoá ký trong bộ nhớ
 * (IV_E2E_AUDIT_KEYSTORE=memory). Khoá tổ chức sinh lúc chạy (không commit khoá bí mật). Seam chỉ có hiệu lực ở bản dev.
 */
export interface AuditLaunch {
  app: ElectronApplication;
  userData: string;
  auditDir: string;
  policyPath: string;
  orgPrivateKeyPem: string;
}

export async function writeAuditPolicy(
  dir: string,
  opts: { auditDir?: string; broken?: boolean; enable?: boolean } = {},
): Promise<{ policyPath: string; orgPrivateKeyPem: string }> {
  const { generateKeyPairSync } = await import("node:crypto");
  const { writeFile } = await import("node:fs/promises");
  const { privateKey, publicKey } = generateKeyPairSync("x25519");
  const policyPath = join(dir, "enterprise-policy.json");
  await writeFile(
    policyPath,
    opts.broken
      ? "{broken"
      : JSON.stringify({
          schemaVersion: 1,
          policyId: "pol-e2e",
          organization: "Ngân hàng E2E",
          forceLocalOnly: true,
          enableAuditLogging: opts.enable ?? true,
          auditPublicKey: publicKey.export({ type: "spki", format: "pem" }),
          ...(opts.auditDir ? { auditLogDirectory: opts.auditDir } : {}),
        }),
  );
  return {
    policyPath,
    orgPrivateKeyPem: privateKey.export({
      type: "pkcs8",
      format: "pem",
    }) as string,
  };
}

export async function launchAudit(
  env: Record<string, string>,
  opts: {
    auditDir?: string;
    brokenPolicy?: boolean;
    userData?: string;
    policyPath?: string;
  } = {},
): Promise<AuditLaunch> {
  const root = await mkdtemp(join(tmpdir(), "sc-audit-e2e-"));
  const auditDir = opts.auditDir ?? join(root, "audit");
  const policy = opts.policyPath
    ? { policyPath: opts.policyPath, orgPrivateKeyPem: "" }
    : await writeAuditPolicy(root, {
        auditDir,
        broken: opts.brokenPolicy ?? false,
      });
  const { app, userData } = await launchFreshAt(
    {
      IV_E2E_POLICY_SYSTEM_PATH: policy.policyPath,
      IV_E2E_AUDIT_KEYSTORE: "memory",
      ...env,
    },
    opts.userData,
  );
  return { app, userData, auditDir, ...policy };
}

/** Đọc mọi bản ghi kiểm toán (bỏ dòng dở). */
export async function readAuditRecords(
  auditDir: string,
): Promise<Record<string, unknown>[]> {
  const { readdir, readFile } = await import("node:fs/promises");
  let names: string[] = [];
  try {
    names = (await readdir(auditDir))
      .filter((n) => n.endsWith(".jsonl"))
      .sort();
  } catch {
    return [];
  }
  const out: Record<string, unknown>[] = [];
  for (const n of names) {
    for (const line of (await readFile(join(auditDir, n), "utf8")).split(
      "\n",
    )) {
      if (!line) continue;
      try {
        out.push(JSON.parse(line) as Record<string, unknown>);
      } catch {
        /* dòng dở */
      }
    }
  }
  return out;
}
