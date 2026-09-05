import { describe, expect, it } from "vitest";
import { buildRecoveryEvidence } from "@/lib/recovery/evidence";
import type {
  ActionAttempt,
  CreditPassport,
  CreditProfile,
  MissionInstance,
  UserAccount,
} from "@/lib/domain/types";

const profile: CreditProfile = {
  userId: "user-1",
  dateOfBirth: "1990-01-01",
  employmentStatus: "employed",
  incomeBand: "30_50k",
  housingStatus: "rent",
  electoralRoll: true,
  utilisationPct: 20,
  missedPaymentsLast12m: 0,
  hardApplicationsLast6m: 1,
  hasRevolvingCredit: true,
  hasDirectDebitForCredit: true,
};

const passport: CreditPassport = {
  pillars: [
    {
      id: "identity",
      title: "Identity & Traceability",
      status: "green",
      strength: "Known",
      helping: [],
      hurting: [],
      unknowns: [],
      nextActions: [],
    },
    {
      id: "application_readiness",
      title: "Application Readiness",
      status: "amber",
      strength: "More evidence needed",
      helping: [],
      hurting: [],
      unknowns: [],
      nextActions: [],
    },
  ],
};

function card(overrides: Partial<UserAccount> = {}): UserAccount {
  return {
    id: "card-1",
    userId: "user-1",
    providerId: null,
    providerName: "Example Card",
    accountType: "credit_card",
    nickname: null,
    lastFour: "1234",
    balanceMinor: 20_000,
    creditLimitMinor: 100_000,
    currency: "GBP",
    directDebitStatus: "yes",
    source: "manual",
    active: true,
    lastVerifiedAt: null,
    ...overrides,
  };
}

const electoralMission: MissionInstance = {
  id: "mission-instance-roll",
  userId: "user-1",
  missionSlug: "register-electoral-roll",
  subject: { kind: "profile" },
  state: "in_review",
  startedAt: "2026-09-01T09:00:00.000Z",
  completedAt: null,
  nextReviewAt: "2026-10-05T09:00:00.000Z",
};

function attempt(overrides: Partial<ActionAttempt> = {}): ActionAttempt {
  return {
    id: "attempt-1",
    userId: "user-1",
    missionInstanceId: electoralMission.id,
    actionRegistryId: "action-1",
    accountId: null,
    status: "submitted",
    startedAt: "2026-09-01T09:00:00.000Z",
    returnedAt: "2026-09-01T09:05:00.000Z",
    selfConfirmedAt: "2026-09-01T09:05:00.000Z",
    verifiedAt: null,
    nextReviewAt: "2026-10-05T09:00:00.000Z",
    ...overrides,
  };
}

function byKey(items: ReturnType<typeof buildRecoveryEvidence>, key: string) {
  return items.find((item) => item.key === key);
}

describe("recovery evidence confidence and provenance", () => {
  it("treats a known electoral-roll answer as customer-confirmed rather than verified", () => {
    const result = buildRecoveryEvidence({
      profile,
      accounts: [],
      missionInstances: [],
      actionAttempts: [],
      passport,
    });

    expect(byKey(result, "electoral_roll")).toMatchObject({
      confidence: "confirmed",
      source: "customer",
    });
    expect(byKey(result, "electoral_roll")?.statusText).toMatch(/electoral roll/i);
  });

  it("prefers a submitted electoral-roll action as pending government-action evidence", () => {
    const result = buildRecoveryEvidence({
      profile: { ...profile, electoralRoll: false },
      accounts: [],
      missionInstances: [electoralMission],
      actionAttempts: [attempt()],
      passport,
    });

    expect(byKey(result, "electoral_roll")).toMatchObject({
      confidence: "pending",
      source: "government_action",
    });
    expect(byKey(result, "electoral_roll")?.statusText).toMatch(/waiting|review|pending/i);
  });

  it("uses tracked account data as confirmed utilisation evidence without claiming external verification", () => {
    const result = buildRecoveryEvidence({
      profile,
      accounts: [card()],
      missionInstances: [],
      actionAttempts: [],
      passport,
    });

    expect(byKey(result, "utilisation")).toMatchObject({
      confidence: "confirmed",
      source: "account",
    });
    expect(byKey(result, "utilisation")?.statusText).toContain("20%");
    expect(result.some((item) => item.confidence === "verified")).toBe(false);
  });

  it("keeps missing application evidence explicitly unknown", () => {
    const unknownPassport: CreditPassport = {
      pillars: passport.pillars.map((pillar) => pillar.id === "application_readiness"
        ? {
            ...pillar,
            status: "unknown",
            unknowns: ["We do not yet know enough about recent applications."],
          }
        : pillar),
    };

    const result = buildRecoveryEvidence({
      profile: { ...profile, hardApplicationsLast6m: null },
      accounts: [],
      missionInstances: [],
      actionAttempts: [],
      passport: unknownPassport,
    });

    expect(byKey(result, "application_evidence")).toMatchObject({
      confidence: "unknown",
      source: "unknown",
    });
  });

  it("never exposes partner decline context or commercial data through this evidence projection", () => {
    const result = buildRecoveryEvidence({
      profile,
      accounts: [card()],
      missionInstances: [electoralMission],
      actionAttempts: [attempt()],
      passport,
    });

    expect(JSON.stringify(result)).not.toMatch(/decline_reason|commission|affiliate|payout|support_need|vulnerab/i);
  });
});
