import type { SafetyAssessment } from "@/lib/domain/safety";
import type {
  AgeMode,
  ApplicationReadiness,
  BarrierDiagnosis,
  BarrierType,
  CreditPassport,
  PassportPillar,
  ReadinessState,
} from "@/lib/domain/types";

export type AcademyStatus = "draft" | "reviewed" | "published" | "superseded" | "archived";
export type AcademyAudience = "general" | "adult" | "under18";
export type AcademySafetyTag = "general" | "under18_safe" | "safe_mode_safe" | "application_oriented" | "borrowing_oriented";
export type AcademySensitivity = "standard" | "sensitive" | "regulated_adjacent";
export type AcademySourceContext = "quest_feed" | "learn_home" | "article" | "related_article" | "mission";
export type AcademyProgressAction = "shown" | "opened" | "completed" | "still_confused";
export type AcademyMatchReason = "mission" | "barrier" | "passport" | "readiness" | "fallback";

export interface AcademyArticle {
  id: string;
  contentKey: string;
  slug: string;
  version: number;
  status: AcademyStatus;
  supersedesId: string | null;
  title: string;
  summary20s: string;
  bodyMarkdown: string;
  readingMinutes: number;
  topicTags: string[];
  audiences: AcademyAudience[];
  missionKeys: string[];
  barrierTypes: BarrierType[];
  passportPillars: PassportPillar["id"][];
  readinessStates: ReadinessState[];
  safetyTags: AcademySafetyTag[];
  sensitivity: AcademySensitivity;
  sourceName: string;
  sourceUrl: string | null;
  reviewer: string;
  reviewedAt: string;
  reviewDueAt: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AcademyProgress {
  userId: string;
  contentKey: string;
  lastArticleId: string;
  firstShownAt: string | null;
  lastShownAt: string | null;
  openedAt: string | null;
  completedAt: string | null;
  stillConfusedAt: string | null;
  lastSourceContext: AcademySourceContext | null;
  updatedAt: string;
}

export interface AcademySelectionContext {
  ageMode: AgeMode;
  safety: SafetyAssessment;
  missionKey: string | null;
  diagnosis: BarrierDiagnosis;
  passport: CreditPassport;
  readiness: ApplicationReadiness;
  seenContentKeys: string[];
}

export interface AcademySelection {
  article: AcademyArticle;
  reasonType: AcademyMatchReason;
  reasonKey: string | null;
  whyThisMatters: string;
}
