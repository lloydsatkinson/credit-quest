import { describe, expect, it } from "vitest";
import { buildRecoveryEvidence } from "@/lib/recovery/evidence";
import type { CreditPassport, CreditProfile } from "@/lib/domain/types";
import type { RecoveryEvidenceItem } from "@/lib/recovery/experience";

const profile: CreditProfile = {
  userId: "user-1",
  dateOfBirth: "1990-01-01",
  employmentStatus: "employed",
  incomeBand: "30_50k",
  housingStatus: "rent",
  electoralRoll: true,
  utilisationPct: 20,
  missedPaymentsLast12m: 0,
  hardApplicationsLast6m: 1,
  hasRevolvingCredit: true,
  hasDirectDebitForCredit: true,
};

const passport: CreditPassport = { pillars: [] };

function consumeExperienceEvidence(items: RecoveryEvidenceItem[]) {
  return items;
}

describe("recovery evidence experience contract", () => {
  it("returns evidence that can be consumed directly by RecoveryExperienceProjection", () => {
    const result = buildRecoveryEvidence({
      profile,
      accounts: [],
      missionInstances: [],
      actionAttempts: [],
      passport,
    });

    const experienceEvidence = consumeExperienceEvidence(result);
    expect(experienceEvidence).toHaveLength(3);
    expect(experienceEvidence.every((item) => item.label.trim().length > 0)).toBe(true);
    expect(experienceEvidence.every((item) => [
      "customer",
      "account",
      "government_action",
      "unknown",
    ].includes(item.source))).toBe(true);
  });
});
