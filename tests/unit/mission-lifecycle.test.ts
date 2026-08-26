import { describe, expect, it } from "vitest";
import { MISSION_CATALOGUE } from "@/lib/data/missions";
import { completeMission, startMission } from "@/lib/domain/mission-lifecycle";
import type { CreditProfile } from "@/lib/domain/types";

const baseProfile: CreditProfile = {
  userId: "u1",
  dateOfBirth: "1990-01-01",
  employmentStatus: "employed",
  incomeBand: "30_50k",
  housingStatus: "rent",
  electoralRoll: true,
  utilisationPct: 60,
  missedPaymentsLast12m: 0,
  hardApplicationsLast6m: 0,
  hasRevolvingCredit: true,
  hasDirectDebitForCredit: false,
};

const now = new Date("2026-08-26T12:00:00Z");

describe("mission lifecycle", () => {
  it("starting a mission does not complete it", () => {
    const progress = startMission(undefined, now);
    expect(progress.state).toBe("started");
    expect(progress.startedAt).toBe(now.toISOString());
    expect(progress.completedAt).toBeNull();
  });

  it("completing the direct-debit mission updates the underlying profile", () => {
    const mission = MISSION_CATALOGUE.find((item) => item.slug === "set-up-direct-debit")!;
    const result = completeMission(baseProfile, mission, { state: "started" }, now);
    expect(result.progress.state).toBe("completed");
    expect(result.profile.hasDirectDebitForCredit).toBe(true);
  });

  it("completion does not fabricate a profile change when no effect exists", () => {
    const mission = MISSION_CATALOGUE.find((item) => item.slug === "reduce-utilisation")!;
    const result = completeMission(baseProfile, mission, { state: "started" }, now);
    expect(result.profile.utilisationPct).toBe(baseProfile.utilisationPct);
  });
});
