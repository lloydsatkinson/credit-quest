import { describe, expect, it } from "vitest";
import { calculateQuestScore } from "@/lib/domain/quest-score";
import type { CreditProfile } from "@/lib/domain/types";

const base: CreditProfile = {
  userId: "u1", dateOfBirth: "1990-01-01", employmentStatus: "employed", incomeBand: "30_50k",
  housingStatus: "rent", electoralRoll: false, utilisationPct: 70, missedPaymentsLast12m: 1,
  hardApplicationsLast6m: 3, hasRevolvingCredit: true, hasDirectDebitForCredit: false,
};

describe("calculateQuestScore", () => {
  it("returns a bounded score and explainable factors", () => {
    const result = calculateQuestScore(base);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.factors.length).toBeGreaterThan(0);
  });

  it("improves when utilisation falls", () => {
    expect(calculateQuestScore({ ...base, utilisationPct: 20 }).score).toBeGreaterThan(calculateQuestScore(base).score);
  });

  it("never leaves the 0 to 100 range", () => {
    const stressed = calculateQuestScore({ ...base, missedPaymentsLast12m: 20, hardApplicationsLast6m: 20 });
    expect(stressed.score).toBeGreaterThanOrEqual(0);
    expect(stressed.score).toBeLessThanOrEqual(100);
  });
});
