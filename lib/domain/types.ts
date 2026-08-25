export type JourneyStage = "setup" | "stabilise" | "build" | "optimise" | "maintain";
export type ImpactLevel = "low" | "medium" | "high";
export type AgeMode = "education" | "adult";
export type MissionState = "not_started" | "started" | "completed" | "dismissed" | "deferred";

export interface CreditProfile {
  userId: string;
  dateOfBirth: string;
  employmentStatus: "employed" | "self_employed" | "student" | "unemployed" | "other";
  incomeBand: "under_15k" | "15_30k" | "30_50k" | "50k_plus";
  housingStatus: "owner" | "mortgage" | "rent" | "family" | "other";
  electoralRoll: boolean;
  utilisationPct: number | null;
  missedPaymentsLast12m: number;
  hardApplicationsLast6m: number;
  hasRevolvingCredit: boolean;
  hasDirectDebitForCredit: boolean;
}

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
