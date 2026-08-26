import { describe, expect, it } from "vitest";
import { normaliseOnboardingAnswers, type OnboardingAnswers } from "@/lib/domain/onboarding";

const answers: OnboardingAnswers = {
  dateOfBirth: "1990-01-01",
  employmentStatus: "employed",
  incomeBand: "30_50k",
  housingStatus: "rent",
  electoralRoll: false,
  utilisationPct: 45,
  missedPaymentsLast12m: 0,
  hardApplicationsLast6m: 1,
  hasRevolvingCredit: true,
  hasDirectDebitForCredit: true,
};
const now = new Date("2026-08-25T12:00:00Z");

describe("progressive onboarding", () => {
  it("maps onboarding answers into a valid CreditProfile", () => {
    const result = normaliseOnboardingAnswers(answers, "u1", now);
    expect(result.profile.userId).toBe("u1");
    expect(result.profile.utilisationPct).toBe(45);
    expect(result.ageMode).toBe("adult");
  });

  it("does not retain an income band for unemployed profiles", () => {
    const result = normaliseOnboardingAnswers({ ...answers, employmentStatus: "unemployed" }, "u1", now);
    expect(result.profile.incomeBand).toBe("not_applicable");
  });

  it("rejects under-16 date of birth", () => {
    expect(() => normaliseOnboardingAnswers({ ...answers, dateOfBirth: "2011-08-26" }, "u1", now)).toThrow(/age 16/i);
  });

  it("accepts 16-17 in education mode", () => {
    expect(normaliseOnboardingAnswers({ ...answers, dateOfBirth: "2009-08-26" }, "u1", now).ageMode).toBe("education");
  });
});
