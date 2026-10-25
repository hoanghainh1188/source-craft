import { UserFacingError } from "@shared/codes/user-error";
import type { AuditStatus, ExportFormat, StudioKind } from "@shared/ipc/types";
import type { KeytarLike } from "../ai-runtime/online/secret-store";
import type {
  AuditFs,
  AuditPolicyState,
  AuditRecordBody,
  DeviceKey,
  ExportMeta,
  InteractionMeta,
  InteractionOutcome,
} from "./audit-types";
import { STUDIO_KINDS } from "../studio/constants";
import { createAuditWriter, type AuditWriter } from "./audit-writer";
import { loadOrCreateDeviceKey } from "./device-key";
import {
  blocksAi,
  computeAuditState,
  type WriterHealth,
} from "./effective-state";
import { errorOutcome } from "./interaction-outcome";
import { encryptQuestion, questionAad } from "./question-cipher";

// 236 — Nhật ký kiểm toán (contracts/audit-ipc.md). Write-ahead + fail-closed (Q3): interaction.start phải ghi + fsync xong
// TRƯỚC khi gọi model; không ghi được ⇒ ném UserFacingError, KHÔNG gọi run(). Hiệu lực đánh giá lại MỖI lượt (FR-002).
// Không log nội dung: app-log chỉ nhận mã / loại lỗi.

export interface AuditLicenseSnapshot {
  valid: boolean;
  itPolicy: boolean;
  licenseId?: string;
}

export interface AuditServiceDeps {
  fs: AuditFs;
  keyStore: KeytarLike;
  clock: () => number;
  randomId: () => string;
  policy: () => AuditPolicyState;
  license: () => AuditLicenseSnapshot;
  identity: () => { osUser: string; host: string };
  appVersion: string;
  defaultDirectory: string;
  notebookName: (notebookId: string) => string | null;
  logEvent: (event: string, meta?: Record<string, unknown>) => void;
}

// Loại Studio hợp lệ = danh sách của Studio (một nguồn sự thật — 233 thêm documentDiff) + yêu cầu tuỳ chỉnh.
const AUDIT_STUDIO_KINDS: readonly StudioKind[] = [...STUDIO_KINDS, "custom"];

const errorTypeOf = (e: unknown): string =>
  (e as NodeJS.ErrnoException | null)?.code ??
  (e instanceof Error ? e.constructor.name : typeof e);

const EXPORT_FORMATS: readonly ExportFormat[] = ["md", "docx", "pdf"];

/** Định danh do renderer gửi: chuỗi không rỗng, ≤ 128 ký tự; khác ⇒ null. */
export const safeId = (v: unknown): string | null =>
  typeof v === "string" && v.length > 0 && v.length <= 128 ? v : null;

const baseName = (p: string): string => p.split(/[\\/]/).pop() ?? "";

export function createAuditService(deps: AuditServiceDeps) {
  type Configured = Extract<AuditPolicyState, { status: "configured" }>;

  let writer: AuditWriter | null = null;
  let writerDir: string | null = null;
  let key: DeviceKey | null = null;
  let activated = false; // đã ghi audit.started cho phiên hiệu lực hiện tại
  let health: WriterHealth = { healthy: true };
  let blockedSince: number | null = null;
  let stopped = false;
  let activation: Promise<void> | null = null;
  const open = new Map<string, InteractionMeta["model"]>();
  const listeners = new Set<(s: AuditStatus) => void>();
  let lastKey = "";
  let lastStatus: AuditStatus = { state: "off" };

  function evaluate() {
    const policy = deps.policy();
    const license = deps.license();
    return {
      policy,
      license,
      ...computeAuditState({ policy, license, writer: health }),
    };
  }

  function emit(): void {
    const { policy, state, reason } = evaluate();
    const status: AuditStatus = {
      state,
      ...(reason ? { reason } : {}),
      ...(policy.status === "configured"
        ? {
            organization: policy.organization,
            directoryKind: policy.directory
              ? ("custom" as const)
              : ("default" as const),
          }
        : {}),
      ...(state === "blocked" && blockedSince !== null ? { blockedSince } : {}),
    };
    if (
      state === "licenseInactive" ||
      state === "off" ||
      state === "policyError"
    ) {
      delete status.directoryKind;
    }
    lastStatus = status;
    // PR C: tổ chức / nhãn vị trí cũng nằm trong khoá ⇒ Cài đặt không hiện thông tin cũ (review bảo mật MEDIUM-1).
    const k = `${state}|${reason ?? ""}|${status.organization ?? ""}|${status.directoryKind ?? ""}`;
    if (k === lastKey) return;
    lastKey = k;
    for (const l of listeners) {
      try {
        l(status);
      } catch {
        /* chỉ báo không được làm hỏng nghiệp vụ */
      }
    }
  }

  function markBlocked(
    reason: "writeFailed" | "keyUnavailable",
    e?: unknown,
  ): void {
    health = { healthy: false, reason };
    if (blockedSince === null) blockedSince = deps.clock();
    if (reason === "writeFailed") {
      deps.logEvent("audit.writeFailed", { errorType: errorTypeOf(e) });
    } else {
      deps.logEvent("audit.keyUnavailable");
    }
    emit();
  }

  /** Ghi một bản ghi; lỗi ⇒ blocked + ném lại. */
  function append(build: (seq: number) => AuditRecordBody): void {
    if (!writer || !key) throw new Error("Audit writer not ready.");
    try {
      writer.append(build, key.privateKeyPem);
    } catch (e) {
      markBlocked("writeFailed", e);
      throw e;
    }
  }

  /** Mở writer + khoá + ghi các bản ghi khởi động. Lỗi ⇒ blocked (không ném). */
  async function activate(
    policy: Configured,
    license: AuditLicenseSnapshot,
  ): Promise<void> {
    const dir = policy.directory ?? deps.defaultDirectory;
    let tail;
    try {
      if (!writer || writerDir !== dir) {
        writer = createAuditWriter({ fs: deps.fs, dir, clock: deps.clock });
        writerDir = dir;
      }
      tail = writer.open();
    } catch (e) {
      writer = null;
      markBlocked("writeFailed", e);
      return;
    }
    const k = await loadOrCreateDeviceKey(deps.keyStore, tail.deviceKeyId);
    if (!k.ok) {
      markBlocked("keyUnavailable");
      return;
    }
    key = k.key;
    const id = deps.identity();
    try {
      // Mảnh dở ở đuôi: writer tự ghi audit.tailRepaired ở lần ghi đầu tiên (đứng trước mọi bản ghi khác).
      if (!tail.head) {
        append(() => ({
          type: "audit.chainStarted",
          devicePublicKey: k.key.publicKeyPem,
          deviceKeyId: k.key.deviceKeyId,
          orgKeyId: policy.orgKeyId,
        }));
      } else if (k.rotation) {
        append(() => ({
          type: "audit.keyRotated",
          previousDeviceKeyId: k.rotation!.previousDeviceKeyId,
          devicePublicKey: k.key.publicKeyPem,
          deviceKeyId: k.key.deviceKeyId,
          reason: k.rotation!.reason,
        }));
      }
      if (tail.sessionOpen && !activated) {
        append(() => ({
          type: "audit.sessionAborted",
          openInteractions: tail.openInteractions,
        }));
      }
      append(() => ({
        type: "audit.started",
        osUser: id.osUser,
        host: id.host,
        appVersion: deps.appVersion,
        policyId: policy.policyId,
        organization: policy.organization,
        ...(license.licenseId ? { licenseId: license.licenseId } : {}),
        deviceKeyId: k.key.deviceKeyId,
        orgKeyId: policy.orgKeyId,
      }));
      activated = true;
      recoverIfBlocked();
    } catch {
      /* markBlocked đã chạy trong append */
    }
  }

  function recoverIfBlocked(): void {
    if (blockedSince === null) {
      health = { healthy: true };
      return;
    }
    const since = new Date(blockedSince).toISOString();
    health = { healthy: true };
    try {
      append(() => ({ type: "audit.recovered", since }));
      blockedSince = null;
    } catch {
      return;
    }
    emit();
  }

  /** Đảm bảo phiên hiệu lực đã mở (khởi động muộn khi bản quyền có lại, hoặc thử lại sau blocked). */
  async function ensureActive(
    policy: Configured,
    license: AuditLicenseSnapshot,
  ): Promise<void> {
    if (activated && writer && key && health.healthy) return;
    if (!activation) {
      activation = (async () => {
        health = { healthy: true };
        if (activated && writer && key) {
          recoverIfBlocked();
        } else {
          await activate(policy, license);
        }
      })().finally(() => {
        activation = null;
      });
    }
    await activation;
    emit();
  }

  /** Rời trạng thái active: đóng tương tác mở (appQuit) rồi ghi audit.stopped nếu còn ghi được. */
  function deactivate(reason: "appQuit" | "licenseInactive"): void {
    if (!activated || !writer || !key) {
      activated = false;
      return;
    }
    try {
      if (reason === "appQuit") {
        for (const [interactionId, model] of open) {
          append(() => ({
            type: "interaction.end",
            interactionId,
            status: "cancelled",
            model,
            citations: [],
          }));
        }
        open.clear();
      }
      append(() => ({ type: "audit.stopped", reason }));
    } catch {
      /* đã blocked */
    }
    activated = false;
  }

  function errorFor(state: string, reason?: string): UserFacingError {
    if (state === "policyError")
      return new UserFacingError("auditPolicyInvalid");
    if (reason === "keyUnavailable")
      return new UserFacingError("auditKeyUnavailable");
    return new UserFacingError("auditWriteFailed");
  }

  return {
    status: (): AuditStatus => lastStatus,

    onStatusChange(cb: (s: AuditStatus) => void): () => void {
      listeners.add(cb);
      return () => void listeners.delete(cb);
    },

    async start(): Promise<void> {
      try {
        const { policy, license, state } = evaluate();
        if (policy.status === "configured" && state !== "licenseInactive") {
          await ensureActive(policy, license);
        }
      } catch (e) {
        deps.logEvent("audit.startError", { errorType: errorTypeOf(e) });
      }
      emit();
    },

    async runInteraction<T>(
      meta: InteractionMeta,
      run: () => Promise<T>,
      summarize: (r: T) => InteractionOutcome,
    ): Promise<T> {
      if (stopped) return run();
      let ev = evaluate();
      if (ev.state === "off" || ev.state === "licenseInactive") {
        if (activated) {
          deactivate("licenseInactive");
          emit();
        }
        return run();
      }
      if (ev.state === "policyError") {
        emit();
        throw errorFor(ev.state);
      }
      await ensureActive(ev.policy as Configured, ev.license);
      ev = evaluate();
      if (blocksAi(ev.state) || !activated) throw errorFor(ev.state, ev.reason);

      const policy = ev.policy as Configured;
      const interactionId = deps.randomId();
      const id = deps.identity();
      try {
        append((seq) => ({
          type: "interaction.start",
          interactionId,
          osUser: id.osUser,
          host: id.host,
          channel: meta.channel,
          scope: meta.scope,
          ...(meta.question !== undefined
            ? {
                question: encryptQuestion(
                  meta.question,
                  policy.orgPublicKeyPem,
                  policy.orgKeyId,
                  questionAad(seq, interactionId),
                ),
              }
            : {}),
          model: meta.model,
          ...(meta.studioKind ? { studioKind: meta.studioKind } : {}),
          ...(meta.sourceScope ? { sourceScope: meta.sourceScope } : {}),
        }));
      } catch {
        throw errorFor("blocked", "writeFailed");
      }
      open.set(interactionId, meta.model);

      const finish = (outcome: InteractionOutcome): void => {
        if (!open.has(interactionId)) return; // đã đóng lúc thoát (R6a)
        open.delete(interactionId);
        try {
          append(() => ({
            type: "interaction.end",
            interactionId,
            model: meta.model,
            ...outcome,
          }));
        } catch {
          /* blocked cho lượt sau; câu trả lời vẫn trả về */
        }
      };

      let result: T;
      try {
        result = await run();
      } catch (e) {
        finish(errorOutcome(e));
        throw e;
      }
      // summarize ném (kết quả lạ) không được làm mất câu trả lời hay để tương tác mở (review #236).
      let outcome: InteractionOutcome;
      try {
        outcome = summarize(result);
      } catch (e) {
        outcome = errorOutcome(e);
      }
      finish(outcome);
      return result;
    },

    async recordExport(meta: ExportMeta): Promise<void> {
      try {
        if (stopped) return;
        const ev = evaluate();
        if (ev.policy.status !== "configured" || ev.state === "licenseInactive")
          return;
        await ensureActive(ev.policy, ev.license);
        if (!activated || !health.healthy) return;
        // Trường từ renderer KHÔNG tin cậy: chuẩn hoá trước khi ký vào nhật ký (review S4).
        const notebookId = safeId(meta.notebookId);
        const studioKind = AUDIT_STUDIO_KINDS.find(
          (k) => k === meta.studioKind,
        );
        const id = deps.identity();
        append(() => ({
          type: "export.saved",
          osUser: id.osUser,
          format: EXPORT_FORMATS.find((f) => f === meta.format) ?? "md",
          notebookId,
          notebookName: notebookId ? deps.notebookName(notebookId) : null,
          ...(studioKind ? { studioKind } : {}),
          fileName: baseName(meta.fileName),
        }));
      } catch {
        /* best-effort: lỗi ⇒ blocked cho lượt AI sau */
      }
    },

    async reevaluate(): Promise<void> {
      if (stopped) return;
      const ev = evaluate();
      if (
        ev.state === "off" ||
        ev.state === "licenseInactive" ||
        ev.state === "policyError"
      ) {
        if (activated) deactivate("licenseInactive");
      } else if (ev.policy.status === "configured") {
        await ensureActive(ev.policy, ev.license);
      }
      emit();
    },

    /** Đồng bộ (gọi trong before-quit). Gọi lại không ghi lại. */
    stop(reason: "appQuit"): void {
      if (stopped) return;
      deactivate(reason);
      stopped = true;
    },
  };
}

export type AuditService = ReturnType<typeof createAuditService>;
