import type { AgeMode } from "@/lib/domain/types";
import type { SafetyMode } from "@/lib/domain/safety";

export type RecoveryEnvironment = "sandbox" | "live";

export type RecoveryProductCategory =
  | "credit_card"
  | "loan"
  | "overdraft"
  | "mortgage"
  | "other";

export type DeclineOrigin = "direct" | "partner";
export type DeclineReasonSource = "partner" | "customer" | "unknown";

export interface DeclineReasonContext {
  known: boolean;
  code: string | null;
  source: DeclineReasonSource;
}

export interface DeclineContext {
  origin: DeclineOrigin;
  productCategory: RecoveryProductCategory;
  declinedAt: string;
  providerName: string | null;
  reason: DeclineReasonContext;
  additionalSupportMayBeNeeded: boolean | null;
}

export type RecoveryReadinessState =
  | "not_ready"
  | "getting_closer"
  | "ready_to_check"
  | "unknown";

export type SupportNeedCode =
  | "simpler_explanations"
  | "larger_text"
  | "fewer_steps"
  | "more_time"
  | "reduced_motion"
  | "reminder_support"
  | "human_support"
  | "digital_support";

export interface SupportAdaptations {
  simplerExplanations: boolean;
  largerText: boolean;
  fewerSteps: boolean;
  moreTime: boolean;
  reducedMotion: boolean;
  reminderSupport: boolean;
  humanSupport: boolean;
  digitalSupport: boolean;
  consequentialActionConfirmation: boolean;
}

export type ReturnGateReason =
  | "gateway_disabled"
  | "live_not_allowed"
  | "under_18"
  | "safe_mode"
  | "missing_evidence"
  | "readiness_not_ready_to_check"
  | "cooldown_active"
  | "suppressed"
  | "disclosure_stale"
  | "customer_choice_missing"
  | "partner_disabled"
  | "contract_disabled"
  | "environment_not_permitted"
  | "contract_expired";

export type ReturnGateResult =
  | { permitted: true }
  | { permitted: false; reason: ReturnGateReason };

export interface ReturnGateContext {
  enabled: boolean;
  liveAllowed: boolean;
  environment: RecoveryEnvironment;
  ageMode: AgeMode;
  safetyMode: SafetyMode;
  evidenceComplete: boolean;
  readinessState: RecoveryReadinessState;
  cooldownComplete: boolean;
  suppressionClear: boolean;
  disclosureCurrent: boolean;
  customerChoseReturn: boolean;
  partnerEnabled: boolean;
  partnerEnvironmentEnabled: boolean;
  contractEnabled: boolean;
  contractEnvironment: RecoveryEnvironment;
  contractExpiresAt: string;
  now: Date;
}
