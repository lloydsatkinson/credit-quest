import { describe, expect, it } from "vitest";
import {
  buildRecoveryPolicySnapshot,
  type RecoveryPolicySnapshotReason,
} from "@/lib/recovery/policy-snapshot";

const mapped: RecoveryPolicySnapshotReason = {
  externalCode: "DSR_HIGH",
  mappingId: "mapping-1",
  mappingVersion: 4,
  canonicalCode: "DSR_HIGH",
  treatment: "create_headroom",
  solveability: "stabilise_first",
  restricted: false,
  parameters: { threshold: 0.5 },
  templateId: "template-1",
  templateVersion: 3,
  reassessmentRuleId: "rule-1",
  reassessmentRuleVersion: 2,
  alternativeRoutePolicyIds: [],
};

describe("V2.3 immutable recovery policy snapshot", () => {
  it("preserves exact lender policy provenance for the applicant", () => {
    const snapshot = buildRecoveryPolicySnapshot({
      partnerId: "partner-1",
      productCategory: "credit_card",
      capturedAt: "2026-09-09T10:00:00.000Z",
      contextConfirmation: "confirmed",
      customerCorrectionCode: null,
      partnerReasons: [mapped],
    });

    expect(snapshot).toEqual(expect.objectContaining({
      schemaVersion: 1,
      partnerId: "partner-1",
      productCategory: "credit_card",
      capturedAt: "2026-09-09T10:00:00.000Z",
      usePartnerReasonsForTreatment: true,
      partnerReasons: [mapped],
      unmappedExternalCodes: [],
    }));
  });

  it("preserves unmapped lender reasons as unknown rather than guessing", () => {
    const unknown: RecoveryPolicySnapshotReason = {
      externalCode: "LENDER_X_999",
      mappingId: null,
      mappingVersion: null,
      canonicalCode: null,
      treatment: "needs_evidence",
      solveability: "unknown_or_unmapped",
      restricted: false,
      parameters: {},
      templateId: null,
      templateVersion: null,
      reassessmentRuleId: null,
      reassessmentRuleVersion: null,
      alternativeRoutePolicyIds: [],
    };

    const snapshot = buildRecoveryPolicySnapshot({
      partnerId: "partner-1",
      productCategory: "credit_card",
      capturedAt: "2026-09-09T10:00:00.000Z",
      contextConfirmation: "confirmed",
      customerCorrectionCode: null,
      partnerReasons: [unknown],
    });

    expect(snapshot.unmappedExternalCodes).toEqual(["LENDER_X_999"]);
    expect(snapshot.partnerReasons[0].canonicalCode).toBeNull();
  });

  it("retains lender-reported provenance when the customer corrects the context", () => {
    const snapshot = buildRecoveryPolicySnapshot({
      partnerId: "partner-1",
      productCategory: "credit_card",
      capturedAt: "2026-09-09T10:00:00.000Z",
      contextConfirmation: "corrected",
      customerCorrectionCode: "customer_reason_other",
      partnerReasons: [mapped],
    });

    expect(snapshot.partnerReasons).toEqual([mapped]);
    expect(snapshot.customerCorrectionCode).toBe("customer_reason_other");
    expect(snapshot.usePartnerReasonsForTreatment).toBe(false);
  });

  it("does not use partner reasons for treatment when optional use was declined", () => {
    const snapshot = buildRecoveryPolicySnapshot({
      partnerId: "partner-1",
      productCategory: "credit_card",
      capturedAt: "2026-09-09T10:00:00.000Z",
      contextConfirmation: "optional_use_declined",
      customerCorrectionCode: null,
      partnerReasons: [mapped],
    });

    expect(snapshot.usePartnerReasonsForTreatment).toBe(false);
  });
});
