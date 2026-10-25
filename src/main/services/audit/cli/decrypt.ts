import { createPrivateKey, createPublicKey } from "node:crypto";
import { decryptQuestion, questionAad } from "../question-cipher";
import { keyIdOf } from "../record-chain";
import { AuditCliError } from "./cli-error";
import {
  readAuditRecords,
  verifyAuditDir,
  type AuditReadFs,
  type AuditVerifyReport,
} from "./verify";

// 236 (PR B) — giải mã câu hỏi trong nhật ký bằng khoá BÍ MẬT của tổ chức (FR-010b). Chỉ IT chạy, offline.
// Kiểm toàn vẹn TRƯỚC; bị can thiệp ⇒ vẫn giải mã nhưng dòng đầu là cảnh báo. Không ghi gì vào thư mục nhật ký;
// khoá bí mật chỉ nằm trong bộ nhớ của lời gọi này.

export interface DecryptResult {
  report: AuditVerifyReport;
  /** JSONL: mỗi bản ghi một dòng; interaction.start có question ⇒ thêm `questionText`. */
  lines: string[];
  decrypted: number;
}

function orgKeyIdOf(orgPrivateKeyPem: string): string {
  try {
    const priv = createPrivateKey(orgPrivateKeyPem);
    if (priv.asymmetricKeyType !== "x25519") throw new Error("not x25519");
    return keyIdOf(
      createPublicKey(priv).export({ type: "spki", format: "pem" }) as string,
    );
  } catch {
    throw new AuditCliError(3, "badKey");
  }
}

export function decryptAuditDir(
  fs: AuditReadFs,
  dir: string,
  orgPrivateKeyPem: string,
): DecryptResult {
  const orgKeyId = orgKeyIdOf(orgPrivateKeyPem);
  const report = verifyAuditDir(fs, dir);
  const lines: string[] = [];
  if (report.result === "tampered") {
    lines.push(
      JSON.stringify({
        warning: "tampered",
        firstFailure: report.firstFailure,
      }),
    );
  }
  let decrypted = 0;
  let questions = 0;
  let matching = 0;
  for (const r of readAuditRecords(fs, dir)) {
    if (r.type !== "interaction.start" || !r.question) {
      lines.push(JSON.stringify(r));
      continue;
    }
    questions += 1;
    // Review bảo mật S2: lệch khoá ở MỘT bản ghi (bị sửa, hoặc tổ chức đổi khoá giữa chừng) không chặn cả lần giải mã.
    if (typeof r.question !== "object" || r.question.orgKeyId !== orgKeyId) {
      lines.push(
        JSON.stringify({
          ...r,
          questionText: null,
          questionError: "orgKeyMismatch",
        }),
      );
      continue;
    }
    matching += 1;
    let questionText: string | null = null;
    try {
      questionText = decryptQuestion(
        r.question,
        orgPrivateKeyPem,
        questionAad(r.seq, r.interactionId),
      );
      decrypted += 1;
    } catch {
      questionText = null; // bản mã bị sửa: giữ dòng, đánh dấu không giải được
    }
    lines.push(
      JSON.stringify({
        ...r,
        questionText,
        ...(questionText === null ? { questionError: "decryptFailed" } : {}),
      }),
    );
  }
  // Không bản ghi nào dùng khoá này ⇒ gần như chắc chắn IT chọn sai khoá tổ chức.
  if (questions > 0 && matching === 0)
    throw new AuditCliError(3, "orgKeyMismatch");
  return { report, lines, decrypted };
}
