import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const readme = readFileSync(resolve(root, "README.md"), "utf8");
const recoverySpec = readFileSync(resolve(root, "tests/e2e/recovery.spec.ts"), "utf8");

describe("V2.3 final tranche documentation and preservation contract", () => {
  it("documents the governed V2.3 lender decline recovery platform", () => {
    for (const marker of [
      "V2.3 — Lender Decline Recovery",
      "canonical decline taxonomy",
      "Journey Builder",
      "Simulator",
      "read-only lender console",
      "historical Ready-to-Check",
      "alternative eligibility",
      "fraud/AML",
    ]) {
      expect(readme).toContain(marker);
    }
  });

  it("documents that lender parameters stay hidden from customer copy and existing CQ authority remains independent", () => {
    expect(readme).toMatch(/lender-configurable.*threshold/i);
    expect(readme).toMatch(/not disclosed to customers|never disclosed to customers/i);
    expect(readme).toMatch(/Application Readiness.*authoritative|authoritative.*Application Readiness/i);
    expect(readme).toMatch(/multi-reason.*snapshot/i);
  });

  it("documents V2.3 dark defaults as remaining off", () => {
    for (const marker of [
      "partner_decline_intake_enabled=false",
      "return_to_origin_enabled=false",
      "commercial_gateway_enabled=false",
      "email_reminders_enabled=false",
      "LIVE_CREDIT_REFERRALS_ALLOWED=false",
    ]) {
      expect(readme).toContain(marker);
    }
  });

  it("keeps browser recovery preservation coverage against lender-policy and approval leakage", () => {
    expect(recoverySpec).toContain("lender cut-off");
    expect(recoverySpec).toContain("approval probability");
    expect(recoverySpec).toContain("pre-approved");
    expect(recoverySpec).toContain("seven-card Quest Feed");
  });
});
