import type { CreditProfile } from "@/lib/domain/types";

export type SafetyMode = "normal" | "caution" | "safe_mode";

export interface SafetyAssessment {
  mode: SafetyMode;
  reasons: string[];
  suppressOffers: boolean;
}

export function assessSafety(profile: CreditProfile): SafetyAssessment {
  const reasons: string[] = [];
  const repeatedMissedPayments = (profile.missedPaymentsLast12m ?? 0) >= 2;
  const repeatedApplications = (profile.hardApplicationsLast6m ?? 0) >= 3;

  if (repeatedMissedPayments) {
    reasons.push("You reported multiple missed payments in the last 12 months.");
  }
  if (repeatedApplications) {
    reasons.push("You reported several recent hard credit applications.");
  }

  if (repeatedMissedPayments && repeatedApplications) {
    return { mode: "safe_mode", reasons, suppressOffers: true };
  }

  if (repeatedMissedPayments || repeatedApplications) {
    return { mode: "caution", reasons, suppressOffers: false };
  }

  return { mode: "normal", reasons: [], suppressOffers: false };
}
