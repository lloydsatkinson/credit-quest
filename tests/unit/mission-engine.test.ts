import { describe, expect, it } from "vitest";
import { canStartMission, getNextBestMission, rankMissionInstances, rankMissions } from "@/lib/domain/mission-engine";
import type { CreditProfile, MissionDefinition, MissionInstance, UserAccount } from "@/lib/domain/types";

const clean: CreditProfile = {
  userId: "u1", dateOfBirth: "1990-01-01", employmentStatus: "employed", incomeBand: "30_50k",
  housingStatus: "rent", electoralRoll: true, utilisationPct: 20, missedPaymentsLast12m: 0,
  hardApplicationsLast6m: 0, hasRevolvingCredit: true, hasDirectDebitForCredit: true,
};
const now = new Date("2026-08-26T12:00:00Z");

const card = (id: string, balanceMinor: number, creditLimitMinor: number): UserAccount => ({
  id,
  userId: "u1",
  providerId: null,
  providerName: null,
  accountType: "credit_card",
  nickname: id,
  lastFour: null,
  balanceMinor,
  creditLimitMinor,
  currency: "GBP",
  directDebitStatus: "no",
  source: "manual",
  active: true,
  lastVerifiedAt: null,
});

describe("mission ranking", () => {
  it("prioritises electoral roll when it is the main gap", () => {
    expect(getNextBestMission({ ...clean, electoralRoll: false })?.mission.slug).toBe("register-electoral-roll");
  });

  it("prioritises utilisation reduction when utilisation is high", () => {
    expect(getNextBestMission({ ...clean, electoralRoll: false, utilisationPct: 80 })?.mission.slug).toBe("reduce-utilisation");
  });

  it("returns application cooldown when recent hard applications are excessive", () => {
    expect(getNextBestMission({ ...clean, hardApplicationsLast6m: 3 })?.mission.slug).toBe("application-cooldown");
  });

  it("is independent of affiliate economics", () => {
    expect(getNextBestMission({ ...clean, hasRevolvingCredit: false })?.mission.slug).toBe("build-revolving-history");
  });

  it("does not manufacture missions from unknown answers", () => {
    const unknown: CreditProfile = {
      ...clean,
      electoralRoll: null,
      utilisationPct: null,
      missedPaymentsLast12m: null,
      hardApplicationsLast6m: null,
      hasRevolvingCredit: null,
      hasDirectDebitForCredit: null,
    };

    expect(rankMissions(unknown)).toEqual([]);
  });

  it("keeps stability actions available in safe mode", () => {
    const stressed: CreditProfile = {
      ...clean,
      missedPaymentsLast12m: 2,
      hardApplicationsLast6m: 4,
      hasRevolvingCredit: false,
    };
    const missions = rankMissions(stressed).map((item) => item.mission.slug);

    expect(missions).toContain("application-cooldown");
    expect(missions).not.toContain("build-revolving-history");
  });

  it("does not return a completed mission even when profile eligibility still matches", () => {
    const progress = { "reduce-utilisation": { state: "completed" as const } };
    const missions = rankMissions({ ...clean, utilisationPct: 60 }, now, progress);
    expect(missions.some((item) => item.mission.slug === "reduce-utilisation")).toBe(false);
  });

  it("keeps a started mission ahead of other eligible missions", () => {
    const profile = {
      ...clean,
      electoralRoll: false,
      utilisationPct: 60,
      hasDirectDebitForCredit: false,
    };
    const progress = { "set-up-direct-debit": { state: "started" as const } };
    expect(getNextBestMission(profile, now, progress)?.mission.slug).toBe("set-up-direct-debit");
  });

  it("ranks separate account mission instances independently and boosts only the started target", () => {
    const instances: MissionInstance[] = [
      {
        id: "mi-a1",
        userId: "u1",
        missionSlug: "reduce-utilisation",
        subject: { kind: "account", accountId: "a1" },
        state: "started",
        startedAt: now.toISOString(),
        completedAt: null,
        nextReviewAt: null,
      },
      {
        id: "mi-a2",
        userId: "u1",
        missionSlug: "reduce-utilisation",
        subject: { kind: "account", accountId: "a2" },
        state: "not_started",
        startedAt: null,
        completedAt: null,
        nextReviewAt: null,
      },
    ];
    const ranked = rankMissionInstances(clean, instances, [
      card("a1", 80000, 100000),
      card("a2", 60000, 100000),
    ], now);

    expect(ranked.map((item) => item.instance.id)).toEqual(["mi-a1", "mi-a2"]);
    expect(ranked[0].priorityScore).toBeGreaterThan(ranked[1].priorityScore);
    expect(ranked[0].reasons[0]).toMatch(/80%/);
    expect(ranked[1].reasons[0]).toMatch(/60%/);
  });

  it("rejects a direct start when the mission is not eligible", () => {
    const mission: MissionDefinition = {
      id: "m-test",
      slug: "test-ineligible",
      title: "Test",
      description: "Test",
      rationale: "Test",
      stage: "build",
      impact: "low",
      questScoreDelta: 0,
      priorityWeight: 1,
      safeModeAllowed: true,
      scope: "profile",
      isEligible: () => false,
    };

    expect(canStartMission(clean, mission, now)).toEqual({
      allowed: false,
      reason: "This mission is not currently eligible for your profile.",
    });
  });

  it("rejects a borrowing-oriented direct start while safe mode is active", () => {
    const mission: MissionDefinition = {
      id: "m-test",
      slug: "test-borrowing",
      title: "Test",
      description: "Test",
      rationale: "Test",
      stage: "build",
      impact: "low",
      questScoreDelta: 0,
      priorityWeight: 1,
      safeModeAllowed: false,
      scope: "profile",
      isEligible: () => true,
    };
    const stressed = { ...clean, missedPaymentsLast12m: 2, hardApplicationsLast6m: 4 };

    expect(canStartMission(stressed, mission, now)).toEqual({
      allowed: false,
      reason: "This mission is paused while Credit Quest prioritises financial stability.",
    });
  });
});
