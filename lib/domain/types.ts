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

export interface MissionProgress {
  state: MissionState;
  startedAt?: string | null;
  completedAt?: string | null;
  nextReviewAt?: string | null;
}

export type MissionProgressMap = Record<string, MissionProgress | undefined>;

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
