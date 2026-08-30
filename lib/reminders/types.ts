import type { ReadinessState } from "@/lib/domain/types";
import type { JourneyOutcomeType } from "@/lib/journey/types";

export type ReminderReason =
  | "mission_incomplete"
  | "cooldown_ending"
  | "reassessment_due"
  | "readiness_changed";

export type ReminderChannel = "in_app" | "email";
export type ReminderStatus =
  | "scheduled"
  | "processing"
  | "sent"
  | "suppressed"
  | "failed"
  | "cancelled";
export type ReminderTemplateKey =
  | "mission-incomplete-v1"
  | "cooldown-ending-v1"
  | "reassessment-due-v1"
  | "readiness-changed-v1";

export interface ReminderCandidate {
  reason: ReminderReason;
  dueAt: string;
  sourceKey: string;
  sourceOutcomeId: string;
  templateKey: ReminderTemplateKey;
}

export interface ReminderRuleInput {
  eventType: JourneyOutcomeType;
  sourceOutcomeId: string;
  sourceKey: string;
  occurredAt: string;
  nextReassessmentAt: string | null;
  readinessBefore: ReadinessState | null;
  readinessAfter: ReadinessState | null;
}

export interface ApprovedReminderCopyInput {
  templateKey: ReminderTemplateKey;
  dueAt: string;
  missionTitle?: string | null;
  readinessBefore?: ReadinessState | null;
  readinessAfter?: ReadinessState | null;
  safeMode: boolean;
  ageMode: "adult" | "education";
}
