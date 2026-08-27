import { describe, expect, it } from "vitest";
import { diagnoseBarrier } from "@/lib/domain/diagnosis";
import type { BarrierType, CreditProfile } from "@/lib/domain/types";

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

const unsupported: BarrierType[] = ["new_to_uk", "affordability_constrained", "credit_invisible"];

describe("diagnoseBarrier", () => {
  it("classifies repeated missed payments as credit rebuilding with high confidence", () => {
    const result = diagnoseBarrier({ ...baseProfile, missedPaymentsLast12m: 2 });
    expect(result.primary).toBe("credit_rebuilder");
    expect(result.confidence).toBe("high");
    expect(result.factors.some((factor) => /missed payments/i.test(factor.evidence))).toBe(true);
  });

  it("uses a conservative thin-file label when revolving credit is explicitly absent", () => {
    const result = diagnoseBarrier({ ...baseProfile, hasRevolvingCredit: false, utilisationPct: null });
    expect(result.primary).toBe("thin_file");
    expect(result.confidence).toBe("medium");
    expect(result.primary).not.toBe("credit_invisible");
  });

  it("classifies known optimisation factors without turning them into adverse-credit labels", () => {
    const utilisation = diagnoseBarrier({ ...baseProfile, utilisationPct: 62 });
    const applications = diagnoseBarrier({ ...baseProfile, hardApplicationsLast6m: 2 });
    expect(utilisation.primary).toBe("optimiser");
    expect(applications.primary).toBe("optimiser");
    expect(utilisation.confidence).toBe("medium");
  });

  it("returns low-confidence no diagnosis when the current evidence is insufficient", () => {
    const result = diagnoseBarrier({
      ...baseProfile,
      hasRevolvingCredit: null,
      utilisationPct: null,
      missedPaymentsLast12m: null,
      hardApplicationsLast6m: null,
    });
    expect(result.primary).toBeNull();
    expect(result.confidence).toBe("low");
  });

  it("never infers unsupported diagnoses from the current profile fields", () => {
    const profiles: CreditProfile[] = [
      baseProfile,
      { ...baseProfile, employmentStatus: "unemployed", incomeBand: "not_applicable" },
      { ...baseProfile, incomeBand: "under_15k", housingStatus: "family" },
      { ...baseProfile, hasRevolvingCredit: false, utilisationPct: null },
      { ...baseProfile, hasRevolvingCredit: null, utilisationPct: null },
    ];

    for (const profile of profiles) {
      expect(unsupported).not.toContain(diagnoseBarrier(profile).primary);
    }
  });
});
