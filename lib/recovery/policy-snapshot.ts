import type { RecoveryPolicyParameterValue } from "@/lib/recovery/decline-policy";
import type { RecoveryTreatmentClass, SolveabilityClass } from "@/lib/recovery/decline-taxonomy";
import type { RecoveryProductCategory } from "@/lib/recovery/types";

export type RecoveryContextConfirmation = "confirmed" | "corrected" | "unknown" | "optional_use_declined";

export interface RecoveryPolicySnapshotReason {
  externalCode: string;
  mappingId: string | null;
  mappingVersion: number | null;
  canonicalCode: string | null;
  treatment: RecoveryTreatmentClass;
  solveability: SolveabilityClass;
  restricted: boolean;
  parameters: Record<string, RecoveryPolicyParameterValue>;
  templateId: string | null;
  templateVersion: number | null;
  reassessmentRuleId: string | null;
  reassessmentRuleVersion: number | null;
  alternativeRoutePolicyIds: string[];
}

export interface RecoveryPolicySnapshot {
  schemaVersion: 1;
  partnerId: string;
  productCategory: RecoveryProductCategory;
  capturedAt: string;
  contextConfirmation: RecoveryContextConfirmation;
  customerCorrectionCode: string | null;
  usePartnerReasonsForTreatment: boolean;
  partnerReasons: RecoveryPolicySnapshotReason[];
  unmappedExternalCodes: string[];
}

const UNMAPPED_REASON_PREFIX = "__UNMAPPED_LENDER_REASON__:";

/**
 * Converts a frozen policy snapshot into the resolver input without allowing an
 * unmapped lender code to masquerade as one of Credit Quest's canonical codes.
 * The snapshot's canonicalCode field is the sole authority for a known reason.
 */
export function recoverySnapshotBarrierReasonCodes(snapshot: RecoveryPolicySnapshot): string[] {
  return snapshot.partnerReasons.map((reason) => (
    reason.canonicalCode ?? `${UNMAPPED_REASON_PREFIX}${reason.externalCode}`
  ));
}

export function buildRecoveryPolicySnapshot(input: {
  partnerId: string;
  productCategory: RecoveryProductCategory;
  capturedAt: string;
  contextConfirmation: RecoveryContextConfirmation;
  customerCorrectionCode: string | null;
  partnerReasons: RecoveryPolicySnapshotReason[];
}): RecoveryPolicySnapshot {
  return {
    schemaVersion: 1,
    partnerId: input.partnerId,
    productCategory: input.productCategory,
    capturedAt: input.capturedAt,
    contextConfirmation: input.contextConfirmation,
    customerCorrectionCode: input.customerCorrectionCode,
    usePartnerReasonsForTreatment: input.contextConfirmation === "confirmed",
    partnerReasons: input.partnerReasons.map((reason) => ({
      ...reason,
      parameters: { ...reason.parameters },
      alternativeRoutePolicyIds: [...reason.alternativeRoutePolicyIds],
    })),
    unmappedExternalCodes: input.partnerReasons
      .filter((reason) => reason.canonicalCode === null)
      .map((reason) => reason.externalCode),
  };
}
