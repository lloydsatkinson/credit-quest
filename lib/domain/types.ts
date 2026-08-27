export type JourneyStage = "setup" | "stabilise" | "build" | "optimise" | "maintain";
export type ImpactLevel = "low" | "medium" | "high";
export type AgeMode = "education" | "adult";
export type MissionState =
  | "eligible"
  | "shown"
  | "not_started"
  | "started"
  | "completed"
  | "deferred"
  | "dismissed"
  | "in_review"
  | "cooldown"
  | "no_longer_eligible";

export type MissionScope = "profile" | "account";
export type AccountType = "credit_card" | "current_account" | "loan" | "other";
export type DirectDebitStatus = "yes" | "no" | "unknown";
export type AccountSource = "manual" | "open_banking";
export type ProviderType = "government" | "bank" | "card_issuer" | "partner" | "generic";
export type ActionMode = "external_link" | "internal_flow" | "referral" | "api";
export type VerificationMode =
  | "internal_state"
  | "self_confirm"
  | "self_confirm_review"
  | "api_verified"
  | "partner_callback";
export type ActionAttemptStatus =
  | "started"
  | "returned"
  | "submitted"
  | "self_confirmed"
  | "verified"
  | "cancelled"
  | "failed";

export interface CreditProfile {
  userId: string;
  dateOfBirth: string;
  employmentStatus: "employed" | "self_employed" | "student" | "unemployed" | "other";
  incomeBand: "under_15k" | "15_30k" | "30_50k" | "50k_plus" | "not_applicable";
  housingStatus: "owner" | "mortgage" | "rent" | "family" | "other";
  electoralRoll: boolean | null;
  utilisationPct: number | null;
  missedPaymentsLast12m: number | null;
  hardApplicationsLast6m: number | null;
  hasRevolvingCredit: boolean | null;
  hasDirectDebitForCredit: boolean | null;
}

export type BarrierType =
  | "credit_invisible"
  | "thin_file"
  | "new_to_uk"
  | "credit_rebuilder"
  | "affordability_constrained"
  | "optimiser";

export interface DiagnosisFactor {
  code: string;
  label: string;
  evidence: string;
}

export interface BarrierDiagnosis {
  primary: BarrierType | null;
  secondary: BarrierType[];
  confidence: "low" | "medium" | "high";
  factors: DiagnosisFactor[];
}

export type PassportStatus = "green" | "amber" | "red" | "unknown";

export interface PassportPillar {
  id: "identity" | "payment_health" | "debt_headroom" | "affordability_stability" | "application_readiness";
  title: string;
  status: PassportStatus;
  strength: string;
  helping: string[];
  hurting: string[];
  unknowns: string[];
  nextActions: string[];
}

export interface CreditPassport {
  pillars: PassportPillar[];
}

export type ReadinessState = "red" | "amber" | "green" | "unknown";

export interface ApplicationReadiness {
  state: ReadinessState;
  headline: string;
  reasons: string[];
  avoid: string[];
  actions: string[];
  reassessAt: string | null;
  daysUntilReassessment: number | null;
}

export interface MissionProgress {
  state: MissionState;
  startedAt?: string | null;
  completedAt?: string | null;
  nextReviewAt?: string | null;
}

export type MissionProgressMap = Record<string, MissionProgress | undefined>;

export type MissionSubject =
  | { kind: "profile" }
  | { kind: "account"; accountId: string };

export interface MissionInstance {
  id: string;
  userId: string;
  missionSlug: string;
  subject: MissionSubject;
  state: MissionState;
  startedAt: string | null;
  completedAt: string | null;
  nextReviewAt: string | null;
}

export interface UserAccount {
  id: string;
  userId: string;
  providerId: string | null;
  providerName?: string | null;
  accountType: AccountType;
  nickname: string | null;
  lastFour: string | null;
  balanceMinor: number | null;
  creditLimitMinor: number | null;
  currency: string;
  directDebitStatus: DirectDebitStatus;
  source: AccountSource;
  active: boolean;
  lastVerifiedAt: string | null;
}

export interface ProviderDefinition {
  id: string;
  slug: string;
  displayName: string;
  providerType: ProviderType;
  allowedHosts: string[];
  active: boolean;
}

export interface ActionDefinition {
  id: string;
  actionKey: string;
  missionSlug: string;
  providerId: string | null;
  accountType: AccountType | null;
  mode: ActionMode;
  destinationUrl: string | null;
  instructions: string;
  verificationMode: VerificationMode;
  safeModeAllowed: boolean;
  minAge: number | null;
  priority: number;
  active: boolean;
}

export interface ResolvedAction {
  actionId: string;
  mode: ActionMode;
  providerName: string | null;
  destinationUrl: string | null;
  instructions: string;
  verificationMode: VerificationMode;
  fallbackUsed: boolean;
}

export interface ActionAttempt {
  id: string;
  userId: string;
  missionInstanceId: string;
  actionRegistryId: string;
  accountId: string | null;
  status: ActionAttemptStatus;
  startedAt: string;
  returnedAt: string | null;
  selfConfirmedAt: string | null;
  verifiedAt: string | null;
  nextReviewAt: string | null;
}

export type CompletionEffect =
  | { type: "set_profile_value"; field: "electoralRoll"; value: true }
  | { type: "set_profile_value"; field: "hasDirectDebitForCredit"; value: true }
  | { type: "set_profile_value"; field: "hasRevolvingCredit"; value: true };

export interface MissionDefinition {
  id: string;
  slug: string;
  title: string;
  description: string;
  rationale: string;
  stage: JourneyStage;
  impact: ImpactLevel;
  questScoreDelta: number;
  priorityWeight: number;
  safeModeAllowed: boolean;
  scope: MissionScope;
  reviewPeriodDays?: number;
  completionEffect?: CompletionEffect;
  referralCategory?: "credit_builder_card";
  isEligible(profile: CreditProfile, now: Date): boolean;
}

export interface RankedMission {
  mission: MissionDefinition;
  priorityScore: number;
  reasons: string[];
}

export interface RankedMissionInstance extends RankedMission {
  instance: MissionInstance;
}

export interface OfferDefinition {
  id: string;
  provider: string;
  productName: string;
  category: "credit_builder_card";
  affiliateUrl: string;
  disclosure: string;
  minAge: number;
  active: boolean;
  commissionPence?: number;
}
