import { describe, expect, it } from "vitest";
import { assessApplicationReadiness } from "@/lib/domain/readiness";
import { assessSafety } from "@/lib/domain/safety";
import type { AgeMode, CreditProfile } from "@/lib/domain/types";

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

function readiness(profile: CreditProfile, ageMode: AgeMode = "adult") {
  return assessApplicationReadiness(profile, assessSafety(profile), ageMode);
}

function expectNoInventedDate(profile: CreditProfile, ageMode: AgeMode = "adult") {
  const result = readiness(profile, ageMode);
  expect(result.reassessAt).toBeNull();
  expect(result.daysUntilReassessment).toBeNull();
  return result;
}

describe("assessApplicationReadiness", () => {
  it("keeps under-18 users in education mode without product-readiness encouragement", () => {
    const result = expectNoInventedDate(baseProfile, "education");
    expect(result.state).toBe("unknown");
    expect(result.headline).toMatch(/products can wait/i);
    expect(result.actions.join(" ")).not.toMatch(/apply|eligibility check/i);
  });

  it("makes Safe Mode a protective red state before ordinary readiness rules", () => {
    const profile = { ...baseProfile, missedPaymentsLast12m: 2, hardApplicationsLast6m: 3 };
    const result = expectNoInventedDate(profile);
    expect(assessSafety(profile).mode).toBe("safe_mode");
    expect(result.state).toBe("red");
    expect(result.headline).toBe("Do not apply yet");
  });

  it("returns unknown when critical evidence is missing", () => {
    expect(readiness({ ...baseProfile, missedPaymentsLast12m: null }).state).toBe("unknown");
    expect(readiness({ ...baseProfile, hardApplicationsLast6m: null }).state).toBe("unknown");
    expect(readiness({ ...baseProfile, utilisationPct: null }).state).toBe("unknown");
  });

  it("returns red for repeated missed payments or three recent hard applications", () => {
    expect(expectNoInventedDate({ ...baseProfile, missedPaymentsLast12m: 2 }).state).toBe("red");
    expect(expectNoInventedDate({ ...baseProfile, hardApplicationsLast6m: 3 }).state).toBe("red");
  });

  it("returns amber for one missed payment, two applications or utilisation above 30%", () => {
    expect(expectNoInventedDate({ ...baseProfile, missedPaymentsLast12m: 1 }).state).toBe("amber");
    expect(expectNoInventedDate({ ...baseProfile, hardApplicationsLast6m: 2 }).state).toBe("amber");
    expect(expectNoInventedDate({ ...baseProfile, utilisationPct: 31 }).state).toBe("amber");
  });

  it("returns amber rather than green when revolving credit is explicitly absent", () => {
    const result = expectNoInventedDate({ ...baseProfile, hasRevolvingCredit: false, utilisationPct: null });
    expect(result.state).toBe("amber");
    expect(result.reasons.join(" ")).toMatch(/revolving|credit history/i);
  });

  it("returns green only for a clean, fully known adult profile", () => {
    const result = expectNoInventedDate(baseProfile);
    expect(result.state).toBe("green");
    expect(result.headline).toBe("Worth checking eligibility");
    expect(result.reasons.join(" ")).toMatch(/blockers Credit Quest currently checks/i);
    expect(result.actions.join(" ")).toMatch(/soft eligibility check/i);
  });
});
