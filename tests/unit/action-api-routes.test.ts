import { describe, expect, it } from "vitest";
import { accountInputSchema } from "@/app/api/accounts/route";
import { accountUpdateSchema } from "@/app/api/accounts/[id]/route";
import { canUseLegacyMissionAction } from "@/app/api/missions/[slug]/route";
import { MISSION_CATALOGUE } from "@/lib/data/missions";

describe("account api validation", () => {
  const valid = {
    providerId: null,
    accountType: "credit_card" as const,
    nickname: "Main card",
    lastFour: "1234",
    balanceMinor: 20000,
    creditLimitMinor: 100000,
    directDebitStatus: "no" as const,
  };

  it("accepts optional last four digits", () => {
    expect(accountInputSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects a client-supplied full card number field", () => {
    expect(accountInputSchema.safeParse({
      ...valid,
      cardNumber: "1234567890123456",
    }).success).toBe(false);
  });

  it("rejects malformed last four digits", () => {
    expect(accountInputSchema.safeParse({ ...valid, lastFour: "123456" }).success).toBe(false);
  });

  it("rejects negative money values", () => {
    expect(accountInputSchema.safeParse({ ...valid, balanceMinor: -1 }).success).toBe(false);
  });

  it("allows a partial owner-account update but no user id override", () => {
    expect(accountUpdateSchema.safeParse({ nickname: "Travel card" }).success).toBe(true);
    expect(accountUpdateSchema.safeParse({ nickname: "Travel card", userId: "someone-else" }).success).toBe(false);
  });
});

describe("legacy mission api boundary", () => {
  const bySlug = Object.fromEntries(MISSION_CATALOGUE.map((mission) => [mission.slug, mission]));

  it("rejects account-scoped missions from the legacy route", () => {
    expect(canUseLegacyMissionAction(bySlug["reduce-utilisation"], "start")).toBe(false);
    expect(canUseLegacyMissionAction(bySlug["set-up-direct-debit"], "complete")).toBe(false);
  });

  it("does not allow electoral roll to complete directly", () => {
    expect(canUseLegacyMissionAction(bySlug["register-electoral-roll"], "complete")).toBe(false);
    expect(canUseLegacyMissionAction(bySlug["register-electoral-roll"], "start")).toBe(true);
  });
});
