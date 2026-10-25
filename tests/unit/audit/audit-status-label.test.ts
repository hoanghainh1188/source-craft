import { describe, it, expect } from "vitest";
import { auditStatusLabel } from "../../../src/renderer/features/audit-status/audit-status-label";
import { createTranslator } from "../../../src/shared/i18n/translate";
import type { AuditStatus } from "../../../src/shared/ipc/types";

// 236 (PR C, T070) — ánh xạ AuditStatus ⇒ khoá i18n cho chip header + mục Cài đặt. Chip chỉ khi active/blocked;
// mục Cài đặt chỉ khi tổ chức đã cấu hình (off không có organization ⇒ ẩn).

const vi = createTranslator("vi");
const en = createTranslator("en");

describe("auditStatusLabel", () => {
  it("null (đang tải) ⇒ không chip, không mục Cài đặt", () => {
    const v = auditStatusLabel(null);
    expect(v.showChip).toBe(false);
    expect(v.showSettings).toBe(false);
  });

  it("off ⇒ ẩn hết; off kèm organization ⇒ hiện mục Cài đặt", () => {
    expect(auditStatusLabel({ state: "off" })).toMatchObject({
      showChip: false,
      showSettings: false,
    });
    expect(
      auditStatusLabel({ state: "off", organization: "Công ty A" }),
    ).toMatchObject({ showChip: false, showSettings: true });
  });

  it("active ⇒ chip thông tin + vị trí theo directoryKind", () => {
    const v = auditStatusLabel({
      state: "active",
      organization: "Công ty A",
      directoryKind: "custom",
    });
    expect(v).toMatchObject({
      showChip: true,
      tone: "info",
      chipKey: "audit.status.chip.active",
      tooltipKey: "audit.status.tooltip.active",
      stateWarn: false,
      stateKey: "audit.status.state.active",
      reasonKey: null,
      directoryKey: "audit.status.directory.custom",
      organization: "Công ty A",
      showSettings: true,
    });
    expect(
      auditStatusLabel({ state: "active", directoryKind: "default" })
        .directoryKey,
    ).toBe("audit.status.directory.default");
  });

  it.each(["writeFailed", "keyUnavailable"])(
    "blocked/%s ⇒ chip cảnh báo + lý do riêng",
    (reason) => {
      const v = auditStatusLabel({ state: "blocked", reason });
      expect(v).toMatchObject({
        showChip: true,
        tone: "warn",
        chipKey: "audit.status.chip.blocked",
        tooltipKey: "audit.status.tooltip.blocked",
        stateWarn: true,
        stateKey: "audit.status.state.blocked",
        reasonKey: `audit.status.reason.${reason}`,
        showSettings: true,
      });
    },
  );

  it.each([
    "unreadableSystemPolicy",
    "invalidAuditPublicKey",
    "invalidAuditLogDirectory",
  ])("policyError/%s ⇒ không chip, Cài đặt báo lý do", (reason) => {
    const v = auditStatusLabel({ state: "policyError", reason });
    expect(v).toMatchObject({
      showChip: false,
      showSettings: true,
      stateWarn: true,
      stateKey: "audit.status.state.policyError",
      reasonKey: `audit.status.reason.${reason}`,
      directoryKey: null,
    });
  });

  it("licenseInactive ⇒ không chip, Cài đặt báo cần Enterprise", () => {
    const v = auditStatusLabel({
      state: "licenseInactive",
      organization: "Công ty A",
    });
    expect(v).toMatchObject({
      showChip: false,
      showSettings: true,
      stateKey: "audit.status.state.licenseInactive",
    });
  });

  it("trạng thái lạ từ main ⇒ ẩn hết", () => {
    expect(
      auditStatusLabel({ state: "paused" } as unknown as AuditStatus),
    ).toMatchObject({ showChip: false, showSettings: false });
  });

  it("lý do lạ từ main ⇒ khoá dự phòng, không ghép chuỗi tuỳ ý", () => {
    expect(
      auditStatusLabel({ state: "blocked", reason: "<script>" }).reasonKey,
    ).toBe("audit.status.reason.unknown");
  });

  it("mọi khoá trả về đều có bản dịch vi + en", () => {
    const all: AuditStatus[] = [
      { state: "off", organization: "A" },
      { state: "licenseInactive", organization: "A" },
      { state: "active", directoryKind: "default" },
      { state: "active", directoryKind: "custom" },
      { state: "blocked", reason: "writeFailed" },
      { state: "blocked", reason: "keyUnavailable" },
      { state: "blocked", reason: "x" },
      { state: "policyError", reason: "unreadableSystemPolicy" },
      { state: "policyError", reason: "invalidAuditPublicKey" },
      { state: "policyError", reason: "invalidAuditLogDirectory" },
    ];
    for (const s of all) {
      const v = auditStatusLabel(s);
      const keys = [
        v.chipKey,
        v.tooltipKey,
        v.stateKey,
        v.reasonKey,
        v.directoryKey,
      ].filter((k): k is NonNullable<typeof k> => k !== null);
      for (const k of keys) {
        expect(vi.t(k)).not.toBe(k);
        expect(en.t(k)).not.toBe(k);
      }
    }
  });
});
