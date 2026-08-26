import { describe, expect, it } from "vitest";
import { assessSafety } from "@/lib/domain/safety";
import type { CreditProfile } from "@/lib/domain/types";

const base: CreditProfile = {
  userId: "u1",
  dateOfBirth: "1990-01-01",
  employmentStatus: "employed",
  incomeBand: "30_50k",
  housingStatus: "rent",
  electoralRoll: true,
  utilisationPct: 30,
  missedPaymentsLast12m: 0,
  hardApplicationsLast6m: 0,
  hasRevolvingCredit: true,
  hasDirectDebitForCredit: true,
};

describe("assessSafety", () => {
  it("does not treat unknown data as distress", () => {
    const result = assessSafety({ ...base, missedPaymentsLast12m: null, hardApplicationsLast6m: null });
    expect(result.mode).toBe("normal");
    expect(result.suppressOffers).toBe(false);
  });

  it("enters safe mode for repeated missed payments plus repeated recent applications", () => {
    const result = assessSafety({ ...base, missedPaymentsLast12m: 2, hardApplicationsLast6m: 4 });
    expect(result.mode).toBe("safe_mode");
    expect(result.suppressOffers).toBe(true);
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it("uses caution for one meaningful stress signal", () => {
    expect(assessSafety({ ...base, missedPaymentsLast12m: 2 }).mode).toBe("caution");
  });
});
