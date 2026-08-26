import { describe, expect, it } from "vitest";
import { MISSION_CATALOGUE } from "@/lib/data/missions";
import { getOffersForMission } from "@/lib/domain/offer-matcher";
import { getNextBestMission } from "@/lib/domain/mission-engine";
import type { CreditProfile } from "@/lib/domain/types";

const base: CreditProfile = {
  userId: "u1", dateOfBirth: "1990-01-01", employmentStatus: "employed", incomeBand: "30_50k",
  housingStatus: "rent", electoralRoll: true, utilisationPct: null, missedPaymentsLast12m: 0,
  hardApplicationsLast6m: 0, hasRevolvingCredit: false, hasDirectDebitForCredit: false,
};
const mission = MISSION_CATALOGUE.find((item) => item.slug === "build-revolving-history")!;

describe("offer matching", () => {
  it("returns no credit offers for a 17 year old", () => {
    expect(getOffersForMission({ ...base, dateOfBirth: "2009-08-26" }, mission, new Date("2026-08-25T12:00:00Z"))).toEqual([]);
  });

  it("returns active matching offers for an adult", () => {
    expect(getOffersForMission(base, mission).length).toBeGreaterThan(0);
  });

  it("returns no offers when mission has no referral category", () => {
    const nonReferral = MISSION_CATALOGUE.find((item) => item.slug === "register-electoral-roll")!;
    expect(getOffersForMission(base, nonReferral)).toEqual([]);
  });

  it("suppresses all offers in safe mode", () => {
    const stressed = { ...base, missedPaymentsLast12m: 2, hardApplicationsLast6m: 4 };
    expect(getOffersForMission(stressed, mission)).toEqual([]);
  });

  it("does not use commission to choose the mission", () => {
    expect(getNextBestMission(base)?.mission.slug).toBe("build-revolving-history");
  });
});
