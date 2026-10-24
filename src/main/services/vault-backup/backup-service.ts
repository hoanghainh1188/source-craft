import { randomUUID } from "node:crypto";
import { readFile, mkdir, rm } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import type {
  BackupCreateResult,
  RestoreConfirmResult,
  RestorePickResult,
  RestorePrepareResult,
  RestoreResult,
  VaultBackupError,
  VaultBackupProgress,
  VaultBackupState,
} from "@shared/ipc/types";
import type { Db } from "../../db/database";
import { packToFile, readContainerHeader, unpackToDir } from "./archive";
import type { KdfParams } from "./container";
import { VaultBackupFailure, toFailure } from "./errors";
import { validateManifest } from "./manifest";
import { prepareStaged } from "./prepare";
import { consumeRestoreResult, writeRestoreState } from "./restore-swap";
import {
  PRE_RESTORE_KEEP,
  preRestoreFileName,
  pruneBackups,
} from "./retention";
import { createSnapshot } from "./snapshot";
import { sanitizeConfig } from "./config-sanitize";
import { MAX_PASSWORD_LEN, MIN_PASSWORD_LEN } from "./constants";
import type { VaultLock } from "./vault-lock";

// Điều phối sao lưu/khôi phục (085). Đường dẫn file CHỈ đến từ hộp thoại do main mở; renderer cầm token.
// Log chỉ gồm tên sự kiện + mã lỗi — KHÔNG path, KHÔNG mật khẩu, KHÔNG nội dung (FR-022/027).

export { MIN_PASSWORD_LEN, MAX_PASSWORD_LEN } from "./constants";

export interface BackupDialogs {
  chooseSavePath(defaultName: string): Promise<string | null>;
  chooseOpenPath(): Promise<string | null>;
}

export interface BackupServiceDeps {
  dataDir: string;
  db: Db;
  appVersion: string;
  /** `store.store` — cấu hình hiện tại (không chứa API key). */
  getConfig: () => Record<string, unknown>;
  lock: VaultLock;
  dialogs: BackupDialogs;
  emit: (p: VaultBackupProgress) => void;
  /** `app.relaunch(); app.exit(0)` ở production. */
  relaunch: () => void;
  log: (event: string, meta?: Record<string, unknown>) => void;
  now?: () => Date;
  /** Chỉ để test chạy nhanh; production dùng DEFAULT_KDF. */
  kdf?: KdfParams;
  /**
   * 116: chờ bảo trì kho vector đang chạy xong (có trần thời gian) trước khi chụp `vectors/`. Gọi TRONG khoá ⇒
   * không lần bảo trì mới nào bắt đầu được. false ⇒ báo bận. Không truyền ⇒ hành vi cũ.
   */
  waitVectorIdle?: () => Promise<boolean>;
}

interface PendingRestore {
  token: string;
  filePath: string;
  encrypted: boolean;
  prepared: { createdAt: string } | null;
}

export interface BackupService {
  getState(): VaultBackupState;
  createBackup(req: { password?: string }): Promise<BackupCreateResult>;
  pickRestore(): Promise<RestorePickResult>;
  prepareRestore(req: {
    token: string;
    password?: string;
  }): Promise<RestorePrepareResult>;
  confirmRestore(req: { token: string }): Promise<RestoreConfirmResult>;
  cancelRestore(req: { token: string }): Promise<{ ok: true }>;
  /** Renderer reload/crash giữa phiên khôi phục ⇒ huỷ phiên (không để kẹt "bận"). No-op khi đang giải nén. */
  abandonRestore(): Promise<void>;
  getRestoreResult(): Promise<RestoreResult | null>;
}

const pad = (n: number): string => String(n).padStart(2, "0");

export function suggestedBackupName(d: Date): string {
  const date = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
  return `SourceCraft-${date}-${pad(d.getHours())}${pad(d.getMinutes())}.ivbackup`;
}

const fail = (code: VaultBackupError["code"]): VaultBackupError => ({
  status: "error",
  code,
});

function passwordError(password: string | undefined): VaultBackupError | null {
  if (password === undefined) return null;
  if (
    password.length < MIN_PASSWORD_LEN ||
    password.length > MAX_PASSWORD_LEN
  ) {
    return fail("passwordTooShort");
  }
  return null;
}

export function createBackupService(deps: BackupServiceDeps): BackupService {
  const now = deps.now ?? (() => new Date());
  const stagedDir = join(deps.dataDir, "restore", "staged");
  let pending: PendingRestore | null = null;
  let preparing = false;

  /** Chụp vault (trong vault lock) → đóng gói vào `outPath`. Dọn thư mục tạm dù thành công hay lỗi. */
  async function writeBackup(
    outPath: string,
    password: string | undefined,
    op: VaultBackupProgress["op"],
  ): Promise<number> {
    const tmp = join(deps.dataDir, "tmp", `backup-${randomUUID()}`);
    await mkdir(join(deps.dataDir, "tmp"), { recursive: true, mode: 0o700 });
    try {
      deps.emit({ op, step: "snapshot" });
      await deps.lock.withLock(async () => {
        if (deps.waitVectorIdle && !(await deps.waitVectorIdle())) {
          throw new VaultBackupFailure("busy");
        }
        await createSnapshot({
          db: deps.db,
          dataDir: deps.dataDir,
          // Chỉ khoá cấu hình đã biết (security S1) — không mang theo khoá lạ trong store.
          config: sanitizeConfig(deps.getConfig(), { restoring: false }),
          destDir: tmp,
          appVersion: deps.appVersion,
          encrypted: password !== undefined,
          now: now(),
        });
      });
      deps.emit({ op, step: "pack" });
      const { sizeBytes } = await packToFile(tmp, outPath, {
        password,
        kdf: deps.kdf,
      });
      return sizeBytes;
    } finally {
      await rm(tmp, { recursive: true, force: true }).catch(() => undefined);
    }
  }

  async function clearPending(): Promise<void> {
    pending = null;
    await rm(stagedDir, { recursive: true, force: true }).catch(
      () => undefined,
    );
    deps.lock.endOperation();
  }

  function errorOf(
    e: unknown,
    fallback: VaultBackupError["code"],
  ): VaultBackupError {
    const code = toFailure(e, fallback).code;
    deps.log("vaultBackup.error", { code });
    return fail(code);
  }

  return {
    getState: () => deps.lock.getState(),

    async createBackup({ password }) {
      const bad = passwordError(password);
      if (bad) return bad;
      try {
        deps.lock.beginOperation("backup");
      } catch {
        return fail("busy");
      }
      try {
        const outPath = await deps.dialogs.chooseSavePath(
          suggestedBackupName(now()),
        );
        if (!outPath) return { status: "cancelled" };
        const sizeBytes = await writeBackup(outPath, password, "backup");
        deps.log("vaultBackup.created", {
          sizeBytes,
          encrypted: password !== undefined,
        });
        return {
          status: "ok",
          fileName: basename(outPath),
          sizeBytes,
          dir: dirname(outPath),
        };
      } catch (e) {
        return errorOf(e, "ioError");
      } finally {
        deps.lock.endOperation();
      }
    },

    async pickRestore() {
      // Phiên khôi phục cũ bị bỏ dở (renderer reload/đóng hộp thoại không huỷ) ⇒ huỷ thay vì kẹt "bận" mãi.
      if (pending) await clearPending();
      try {
        deps.lock.beginOperation("restore");
      } catch {
        return fail("busy");
      }
      try {
        const filePath = await deps.dialogs.chooseOpenPath();
        if (!filePath) {
          await clearPending();
          return { status: "cancelled" };
        }
        const header = await readContainerHeader(filePath);
        pending = {
          token: randomUUID(),
          filePath,
          encrypted: header.encrypted,
          prepared: null,
        };
        return {
          status: "ok",
          token: pending.token,
          encrypted: header.encrypted,
        };
      } catch (e) {
        await clearPending();
        return errorOf(e, "notBackup");
      }
    },

    async prepareRestore({ token, password }) {
      if (!pending || pending.token !== token) return fail("tokenInvalid");
      const current = pending;
      if (current.encrypted && password === undefined) {
        return fail("passwordRequired");
      }
      // Chặn gọi chồng (vd React StrictMode chạy effect 2 lần) — lần 2 sẽ xoá staging lần 1 đang giải nén.
      if (preparing) return fail("busy");
      preparing = true;
      try {
        deps.emit({ op: "restore", step: "decrypt" });
        await unpackToDir(current.filePath, stagedDir, {
          password: current.encrypted ? password : undefined,
        });
        deps.emit({ op: "restore", step: "verify" });
        let raw: unknown;
        try {
          raw = JSON.parse(
            await readFile(join(stagedDir, "manifest.json"), "utf8"),
          );
        } catch {
          throw new VaultBackupFailure("notBackup");
        }
        const manifest = validateManifest(raw);
        const emv = deps.getConfig().embeddingModelVersion;
        const summary = await prepareStaged(stagedDir, manifest, {
          currentEmbeddingModelVersion:
            typeof emv === "string" ? emv : undefined,
          encrypted: current.encrypted,
        });
        current.prepared = { createdAt: manifest.createdAt };
        return { status: "ok", summary };
      } catch (e) {
        const err = errorOf(e, "badPasswordOrCorrupt");
        // File mã hoá + sai mật khẩu/hỏng ⇒ giữ token để nhập lại (US3-4). Lỗi khác ⇒ huỷ phiên.
        if (current.encrypted && err.code === "badPasswordOrCorrupt") {
          await rm(stagedDir, { recursive: true, force: true }).catch(
            () => undefined,
          );
          return err;
        }
        await clearPending();
        return err;
      } finally {
        preparing = false;
      }
    },

    async confirmRestore({ token }) {
      if (!pending || pending.token !== token || !pending.prepared) {
        return fail("tokenInvalid");
      }
      // Có thể đã có nguồn mới/reindex từ lúc prepare ⇒ kiểm lại (bản tự sao lưu phải nhất quán).
      if (deps.lock.externalBusy()) return fail("busy");
      const prepared = pending.prepared;
      try {
        // Giữ khoá liên tục từ lúc chụp vault hiện tại tới khi khoá vĩnh viễn — không có kẽ hở cho ghi mới.
        await deps.lock.withLock(async () => {
          deps.emit({ op: "restore", step: "preBackup" });
          const backupsDir = join(deps.dataDir, "backups");
          await mkdir(backupsDir, { recursive: true, mode: 0o700 });
          const prePath = join(backupsDir, preRestoreFileName(now()));
          await writeBackup(prePath, undefined, "restore");
          await pruneBackups(backupsDir, PRE_RESTORE_KEEP);
          await writeRestoreState(deps.dataDir, {
            phase: "staged",
            backupCreatedAt: prepared.createdAt,
            preRestorePath: prePath,
          });
          deps.lock.lockUntilExit();
        });
      } catch (e) {
        // Giữ phiên (token + staging) để người dùng thử lại hoặc huỷ.
        return errorOf(e, "ioError");
      }
      pending = null;
      deps.log("vaultBackup.restoreStaged");
      deps.relaunch();
      return { status: "relaunching" };
    },

    async cancelRestore({ token }) {
      if (pending && pending.token === token) await clearPending();
      return { ok: true };
    },

    async abandonRestore() {
      if (pending && !preparing) await clearPending();
    },

    getRestoreResult: () => consumeRestoreResult(deps.dataDir),
  };
}
