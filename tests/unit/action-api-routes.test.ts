import { describe, expect, it } from "vitest";
import { accountInputSchema } from "@/app/api/accounts/route";
import { accountUpdateSchema } from "@/app/api/accounts/[id]/route";
import { actionResolveSchema } from "@/app/api/actions/resolve/route";
import { actionStartSchema } from "@/app/api/actions/start/route";
import {
  actionAttemptResponseSchema,
  actionEvidenceAllowedForMission,
} from "@/app/api/actions/attempts/[id]/route";
import { canUseLegacyMissionAction } from "@/app/api/missions/[slug]/route";
import { MISSION_CATALOGUE } from "@/lib/data/missions";
import { isMissionInstanceActionable } from "@/lib/server/action-service";
import type { MissionInstance } from "@/lib/domain/types";

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

describe("mission action api validation", () => {
  const valid = { missionInstanceId: "11111111-1111-4111-8111-111111111111" };

  it("accepts only a mission instance id for resolve and start", () => {
    expect(actionResolveSchema.safeParse(valid).success).toBe(true);
    expect(actionStartSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects a client supplied destination url", () => {
    const malicious = { ...valid, destinationUrl: "https://evil.example/phish" };
    expect(actionResolveSchema.safeParse(malicious).success).toBe(false);
    expect(actionStartSchema.safeParse(malicious).success).toBe(false);
  });

  it("accepts only explicit return confirmation and utilisation evidence fields", () => {
    expect(actionAttemptResponseSchema.safeParse({ response: "submitted" }).success).toBe(true);
    expect(actionAttemptResponseSchema.safeParse({
      response: "completed",
      balanceMinor: 28000,
      creditLimitMinor: 100000,
    }).success).toBe(true);
    expect(actionAttemptResponseSchema.safeParse({
      response: "completed",
      destinationUrl: "https://evil.example",
    }).success).toBe(false);
  });

  it("allows balance or limit evidence only for the utilisation mission", () => {
    const evidence = { response: "completed" as const, balanceMinor: 28000, creditLimitMinor: 100000 };
    expect(actionEvidenceAllowedForMission("reduce-utilisation", evidence)).toBe(true);
    expect(actionEvidenceAllowedForMission("set-up-direct-debit", evidence)).toBe(false);
    expect(actionEvidenceAllowedForMission("register-electoral-roll", evidence)).toBe(false);
    expect(actionEvidenceAllowedForMission("build-revolving-history", evidence)).toBe(false);
    expect(actionEvidenceAllowedForMission("application-cooldown", evidence)).toBe(false);
    expect(actionEvidenceAllowedForMission("set-up-direct-debit", { response: "completed" })).toBe(true);
  });
});

describe("review-due mission action availability", () => {
  const base: MissionInstance = {
    id: "11111111-1111-4111-8111-111111111111",
    userId: "u1",
    missionSlug: "application-cooldown",
    subject: { kind: "profile" },
    state: "cooldown",
    startedAt: "2026-08-01T12:00:00.000Z",
    completedAt: null,
    nextReviewAt: "2026-08-26T12:00:00.000Z",
  };

  it("keeps cooldown blocked before review but allows it once due", () => {
    expect(isMissionInstanceActionable(base, new Date("2026-08-26T11:59:59.000Z"))).toBe(false);
    expect(isMissionInstanceActionable(base, new Date("2026-08-26T12:00:00.000Z"))).toBe(true);
  });

  it("never reopens terminal states", () => {
    expect(isMissionInstanceActionable({ ...base, state: "completed" }, new Date("2026-09-01T12:00:00.000Z"))).toBe(false);
    expect(isMissionInstanceActionable({ ...base, state: "dismissed" }, new Date("2026-09-01T12:00:00.000Z"))).toBe(false);
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
