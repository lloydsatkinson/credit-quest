import type { ReadinessState } from "@/lib/domain/types";

export type JourneyLifecycleStage =
  | "onboarding"
  | "active_mission"
  | "waiting"
  | "cooldown"
  | "reassessment_due"
  | "ready"
  | "optimising";

export type JourneyOutcomeType =
  | "onboarding_completed"
  | "mission_started"
  | "mission_completed"
  | "mission_deferred"
  | "action_submitted"
  | "action_verified"
  | "cooldown_started"
  | "cooldown_ended"
  | "reassessment_performed"
  | "readiness_changed";

export type JourneyOutcomeSource =
  | "onboarding"
  | "mission"
  | "action"
  | "reassessment";

export interface JourneyState {
  userId: string;
  stage: JourneyLifecycleStage;
  activeMissionId: string | null;
  nextReassessmentAt: string | null;
  lastReassessedAt: string | null;
  lastReadinessBand: ReadinessState | null;
  updatedAt: string;
}

export interface JourneyOutcome {
  id: string;
  userId: string;
  eventType: JourneyOutcomeType;
  source: JourneyOutcomeSource;
  sourceKey: string;
  missionInstanceId: string | null;
  readinessBefore: ReadinessState | null;
  readinessAfter: ReadinessState | null;
  metadata: Record<string, unknown>;
  occurredAt: string;
}

export interface JourneyOutcomeInput {
  userId: string;
  eventType: JourneyOutcomeType;
  source: JourneyOutcomeSource;
  sourceKey: string;
  missionInstanceId?: string | null;
  readinessBefore?: ReadinessState | null;
  readinessAfter?: ReadinessState | null;
  metadata?: Record<string, unknown>;
  occurredAt: string;
}
