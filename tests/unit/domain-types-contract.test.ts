import { describe, expect, it } from "vitest";
import type {
  ApplicationReadiness,
  BarrierDiagnosis,
  CreditPassport,
} from "@/lib/domain/types";

describe("Passport and readiness domain contracts", () => {
  it("supports explainable serialisable outputs", () => {
    const diagnosis: BarrierDiagnosis = {
      primary: null,
      secondary: [],
      confidence: "low",
      factors: [],
    };
    const readiness: ApplicationReadiness = {
      state: "unknown",
      headline: "We need more information",
      reasons: [],
      avoid: [],
      actions: [],
      reassessAt: null,
      daysUntilReassessment: null,
    };
    const passport: CreditPassport = {
      pillars: [{
        id: "affordability_stability",
        title: "Affordability & Stability",
        status: "unknown",
        strength: "More evidence is needed.",
        helping: [],
        hurting: [],
        unknowns: ["Affordability is not assessed from the current profile."],
        nextActions: [],
      }],
    };

    expect(diagnosis.primary).toBeNull();
    expect(readiness.reassessAt).toBeNull();
    expect(passport.pillars[0].status).toBe("unknown");
  });
});
