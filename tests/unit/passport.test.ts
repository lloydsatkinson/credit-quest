import { describe, expect, it } from "vitest";
import { buildCreditPassport } from "@/lib/domain/passport";
import type { ApplicationReadiness, CreditProfile, PassportPillar } from "@/lib/domain/types";

const baseProfile: CreditProfile = {
  userId: "user-1",
  dateOfBirth: "1990-01-01",
  employmentStatus: "employed",
  incomeBand: "30_50k",
  housingStatus: "rent",
  electoralRoll: true,
  utilisationPct: 20,
  missedPaymentsLast12m: 0,
  hardApplicationsLast6m: 0,
  hasRevolvingCredit: true,
  hasDirectDebitForCredit: true,
};

const amberReadiness: ApplicationReadiness = {
  state: "amber",
  headline: "Getting closer",
  reasons: ["One current optimisation factor remains."],
  avoid: ["Avoid an unnecessary hard application."],
  actions: ["Complete your next mission."],
  reassessAt: null,
  daysUntilReassessment: null,
};

function pillar(profile: CreditProfile, id: PassportPillar["id"], readiness = amberReadiness) {
  const result = buildCreditPassport(profile, readiness);
  const found = result.pillars.find((item) => item.id === id);
  if (!found) throw new Error(`Missing pillar ${id}`);
  return found;
}

describe("buildCreditPassport", () => {
  it("always returns the five pillars in the stable product order", () => {
    expect(buildCreditPassport(baseProfile, amberReadiness).pillars.map((item) => item.id)).toEqual([
      "identity",
      "payment_health",
      "debt_headroom",
      "affordability_stability",
      "application_readiness",
    ]);
  });

  it("maps electoral-roll evidence to identity green, amber and unknown without a red shortcut", () => {
    expect(pillar({ ...baseProfile, electoralRoll: true }, "identity").status).toBe("green");
    expect(pillar({ ...baseProfile, electoralRoll: false }, "identity").status).toBe("amber");
    expect(pillar({ ...baseProfile, electoralRoll: null }, "identity").status).toBe("unknown");
  });

  it("maps missed-payment evidence to payment health boundaries", () => {
    expect(pillar({ ...baseProfile, missedPaymentsLast12m: 0 }, "payment_health").status).toBe("green");
    expect(pillar({ ...baseProfile, missedPaymentsLast12m: 1 }, "payment_health").status).toBe("amber");
    expect(pillar({ ...baseProfile, missedPaymentsLast12m: 2 }, "payment_health").status).toBe("red");
    expect(pillar({ ...baseProfile, missedPaymentsLast12m: null }, "payment_health").status).toBe("unknown");
  });

  it("uses Credit Quest utilisation planning bands for debt and headroom", () => {
    expect(pillar({ ...baseProfile, utilisationPct: 30 }, "debt_headroom").status).toBe("green");
    expect(pillar({ ...baseProfile, utilisationPct: 31 }, "debt_headroom").status).toBe("amber");
    expect(pillar({ ...baseProfile, utilisationPct: 75 }, "debt_headroom").status).toBe("amber");
    expect(pillar({ ...baseProfile, utilisationPct: 76 }, "debt_headroom").status).toBe("red");
    expect(pillar({ ...baseProfile, utilisationPct: null }, "debt_headroom").status).toBe("unknown");
    expect(pillar({ ...baseProfile, hasRevolvingCredit: false, utilisationPct: null }, "debt_headroom").status).toBe("unknown");
  });

  it("keeps affordability and stability unknown with the current data model", () => {
    const result = pillar(baseProfile, "affordability_stability");
    expect(result.status).toBe("unknown");
    expect(result.unknowns.join(" ")).toMatch(/not enough|not assessed|more information/i);
  });

  it("mirrors the readiness engine rather than recalculating application readiness", () => {
    for (const state of ["red", "amber", "green", "unknown"] as const) {
      const readiness: ApplicationReadiness = { ...amberReadiness, state };
      expect(pillar(baseProfile, "application_readiness", readiness).status).toBe(state);
    }
  });
});
