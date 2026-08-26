import { describe, expect, it } from "vitest";
import { mergeMissionSyncResults, shouldMarkNoLongerEligible } from "@/lib/server/mission-repository";
import type { CreditProfile, MissionInstance, UserAccount } from "@/lib/domain/types";

const profile: CreditProfile = {
  userId: "u1",
  dateOfBirth: "1990-01-01",
  employmentStatus: "employed",
  incomeBand: "30_50k",
  housingStatus: "rent",
  electoralRoll: false,
  utilisationPct: null,
  missedPaymentsLast12m: 0,
  hardApplicationsLast6m: 0,
  hasRevolvingCredit: true,
  hasDirectDebitForCredit: null,
};

const instance = (missionSlug: string, accountId?: string): MissionInstance => ({
  id: `mi-${missionSlug}`,
  userId: "u1",
  missionSlug,
  subject: accountId ? { kind: "account", accountId } : { kind: "profile" },
  state: "started",
  startedAt: "2026-08-26T12:00:00.000Z",
  completedAt: null,
  nextReviewAt: null,
});

const card = (overrides: Partial<UserAccount> = {}): UserAccount => ({
  id: "a1",
  userId: "u1",
  providerId: null,
  providerName: null,
  accountType: "credit_card",
  nickname: "Main card",
  lastFour: null,
  balanceMinor: null,
  creditLimitMinor: null,
  currency: "GBP",
  directDebitStatus: "unknown",
  source: "manual",
  active: true,
  lastVerifiedAt: null,
  ...overrides,
});

describe("mission persistence eligibility", () => {
  it("does not close an account mission when its supporting data is unknown", () => {
    expect(shouldMarkNoLongerEligible(instance("reduce-utilisation", "a1"), profile, [card()])).toBe(false);
    expect(shouldMarkNoLongerEligible(instance("set-up-direct-debit", "a1"), profile, [card()])).toBe(false);
  });

  it("closes utilisation only when known account data proves the target is met", () => {
    expect(shouldMarkNoLongerEligible(
      instance("reduce-utilisation", "a1"),
      profile,
      [card({ balanceMinor: 25000, creditLimitMinor: 100000 })],
    )).toBe(true);
  });

  it("closes electoral roll only when the profile confirms registration", () => {
    expect(shouldMarkNoLongerEligible(instance("register-electoral-roll"), profile, [])).toBe(false);
    expect(shouldMarkNoLongerEligible(instance("register-electoral-roll"), { ...profile, electoralRoll: true }, [])).toBe(true);
  });
});

describe("mission sync history", () => {
  it("retains a completed mission even after its eligibility condition is resolved", () => {
    const completed: MissionInstance = {
      ...instance("register-electoral-roll"),
      state: "completed",
      completedAt: "2026-08-26T12:10:00.000Z",
    };

    expect(mergeMissionSyncResults([completed], [])).toEqual([completed]);
  });

  it("uses a newly synchronized state instead of the older stored version", () => {
    const stored = instance("application-cooldown");
    const updated: MissionInstance = {
      ...stored,
      state: "no_longer_eligible",
      nextReviewAt: null,
    };

    expect(mergeMissionSyncResults([stored], [updated])).toEqual([updated]);
  });
});
