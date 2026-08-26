import { describe, expect, it } from "vitest";
import { getNextBestMission, rankMissions } from "@/lib/domain/mission-engine";
import type { CreditProfile } from "@/lib/domain/types";

const clean: CreditProfile = {
  userId: "u1", dateOfBirth: "1990-01-01", employmentStatus: "employed", incomeBand: "30_50k",
  housingStatus: "rent", electoralRoll: true, utilisationPct: 20, missedPaymentsLast12m: 0,
  hardApplicationsLast6m: 0, hasRevolvingCredit: true, hasDirectDebitForCredit: true,
};

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
});
