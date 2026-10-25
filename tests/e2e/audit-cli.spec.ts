import { test, expect } from "@playwright/test";
import { spawnSync } from "node:child_process";
import { mkdtemp, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import electronPath from "electron";
import { MAIN, launchAudit, readyWindow, dismissOnboarding } from "./helper";

// 236 (PR B, T068): chế độ dòng lệnh của chính binary — kiểm tra / sinh khoá, mã thoát, không đụng userData.

function cli(args: string[], userData: string) {
  const r = spawnSync(
    electronPath as unknown as string,
    [MAIN, `--user-data-dir=${userData}`, ...args],
    {
      encoding: "utf8",
      timeout: 60_000,
    },
  );
  // Tiến trình chết vì signal / không spawn được ⇒ status null; in đủ ngữ cảnh để chẩn đoán trên CI (Linux + xvfb).
  if (r.status === null) {
    console.error(
      `[audit-cli] status=null signal=${r.signal} error=${r.error?.message ?? "-"}\nstderr:\n${r.stderr}`,
    );
  }
  return { code: r.status, out: r.stdout, err: r.stderr };
}

test("236 — CLI: --audit-verify nguyên vẹn ⇒ 0; sửa 1 ký tự ⇒ 1; keygen ⇒ 0; không ghi userData", async () => {
  test.setTimeout(120_000);
  // Sinh nhật ký thật: mở app với audit bật rồi thoát (chainStarted, started, stopped).
  const run = await launchAudit({});
  const win = await readyWindow(run.app);
  await dismissOnboarding(win);
  await run.app.close();
  const files = (await readdir(run.auditDir)).filter((n) =>
    n.endsWith(".jsonl"),
  );
  expect(files.length).toBeGreaterThan(0);

  const ud = await mkdtemp(join(tmpdir(), "sc-236-cli-ud-"));
  const outDir = await mkdtemp(join(tmpdir(), "sc-236-cli-out-"));

  const ok = cli(
    [
      "--audit-verify",
      run.auditDir,
      "--json",
      "--out",
      join(outDir, "r.json"),
      "--lang",
      "en",
    ],
    ud,
  );
  expect(ok.code).toBe(0);
  expect(ok.out).toContain("INTACT");
  expect(
    JSON.parse(await readFile(join(outDir, "r.json"), "utf8")),
  ).toMatchObject({ result: "intact" });

  const path = join(run.auditDir, files[0]!);
  const text = await readFile(path, "utf8");
  await writeFile(path, text.replace("Ngân hàng E2E", "Ngân hàng E2F"));
  const bad = cli(["--audit-verify", run.auditDir, "--lang", "vi"], ud);
  expect(bad.code).toBe(1);
  expect(bad.out).toContain("BỊ CAN THIỆP");

  const kg = cli(["--audit-keygen", "--out-dir", join(outDir, "keys")], ud);
  expect(kg.code).toBe(0);
  expect(kg.out).toContain('"auditPublicKey"');
  expect(kg.out).not.toContain("PRIVATE KEY");

  expect(cli(["--audit-verify"], ud).code).toBe(2);
  expect(await readdir(ud)).toEqual([]); // không DB, không log, không audit trong userData
});
