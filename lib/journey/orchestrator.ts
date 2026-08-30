import type { ApplicationReadiness, MissionInstance } from "@/lib/domain/types";
import { deriveJourneyLifecycle } from "@/lib/journey/state-machine";
import type {
  JourneyOutcome,
  JourneyOutcomeInput,
  JourneyOutcomeSource,
  JourneyOutcomeType,
  JourneyState,
} from "@/lib/journey/types";

export interface JourneyReassessmentResult {
  before: JourneyState["lastReadinessBand"];
  after: JourneyState["lastReadinessBand"];
  changed: boolean;
  state: JourneyState;
}

interface JourneyMissionContext {
  activeMission: MissionInstance | null;
  hasCompletedMission: boolean;
  onboardingComplete: boolean;
}

interface JourneyGuidance {
  readiness: ApplicationReadiness;
}

export interface JourneyOrchestratorDeps {
  appendOutcome: (input: JourneyOutcomeInput) => Promise<JourneyOutcome>;
  upsertState: (state: JourneyState) => Promise<JourneyState>;
  getState: (userId: string) => Promise<JourneyState | null>;
  getGuidance: (userId: string, now: Date) => Promise<JourneyGuidance | null>;
  getMissionContext: (userId: string) => Promise<JourneyMissionContext>;
}

function fallbackReadiness(
  state: JourneyState["lastReadinessBand"] | null,
): ApplicationReadiness {
  return {
    state: state ?? "unknown",
    headline: "",
    reasons: [],
    avoid: [],
    actions: [],
    reassessAt: null,
    daysUntilReassessment: null,
  };
}

export function createJourneyOrchestrator(deps: JourneyOrchestratorDeps) {
  return {
    async observeJourneyEvent(input: {
      userId: string;
      eventType: JourneyOutcomeType;
      source: JourneyOutcomeSource;
      sourceKey: string;
      missionInstanceId?: string | null;
      nextReviewAt?: string | null;
      metadata?: Record<string, unknown>;
      now?: Date;
    }): Promise<JourneyOutcome> {
      const now = input.now ?? new Date();
      const [existing, context, guidance] = await Promise.all([
        deps.getState(input.userId),
        deps.getMissionContext(input.userId),
        deps.getGuidance(input.userId, now),
      ]);
      const currentBand = existing?.lastReadinessBand ?? guidance?.readiness.state ?? null;

      const outcome = await deps.appendOutcome({
        userId: input.userId,
        eventType: input.eventType,
        source: input.source,
        sourceKey: input.sourceKey,
        missionInstanceId: input.missionInstanceId ?? null,
        readinessBefore: currentBand,
        readinessAfter: currentBand,
        metadata: input.metadata ?? {},
        occurredAt: now.toISOString(),
      });

      const nextReassessmentAt = input.nextReviewAt ?? existing?.nextReassessmentAt ?? null;
      const readiness = guidance?.readiness ?? fallbackReadiness(currentBand);
      const stage = deriveJourneyLifecycle({
        readiness,
        activeMission: context.activeMission,
        nextReassessmentAt,
        hasCompletedMission: context.hasCompletedMission,
        onboardingComplete: context.onboardingComplete,
        now,
      });

      await deps.upsertState({
        userId: input.userId,
        stage,
        activeMissionId: context.activeMission?.id ?? null,
        nextReassessmentAt,
        lastReassessedAt: existing?.lastReassessedAt ?? null,
        lastReadinessBand: currentBand,
        updatedAt: now.toISOString(),
      });
      return outcome;
    },

    async reassessJourneyForUser(input: {
      userId: string;
      sourceKey: string;
      now?: Date;
    }): Promise<JourneyReassessmentResult | null> {
      const now = input.now ?? new Date();
      const existing = await deps.getState(input.userId);
      if (!existing?.nextReassessmentAt) return null;
      if (new Date(existing.nextReassessmentAt).getTime() > now.getTime()) return null;

      const guidance = await deps.getGuidance(input.userId, now);
      if (!guidance) return null;
      const context = await deps.getMissionContext(input.userId);
      const before = existing.lastReadinessBand;
      const after = guidance.readiness.state;
      const changed = before !== null && before !== after;

      await deps.appendOutcome({
        userId: input.userId,
        eventType: "reassessment_performed",
        source: "reassessment",
        sourceKey: input.sourceKey,
        missionInstanceId: context.activeMission?.id ?? null,
        readinessBefore: before,
        readinessAfter: after,
        metadata: {},
        occurredAt: now.toISOString(),
      });

      if (changed) {
        await deps.appendOutcome({
          userId: input.userId,
          eventType: "readiness_changed",
          source: "reassessment",
          sourceKey: `${input.sourceKey}:readiness:${before}:${after}`,
          missionInstanceId: context.activeMission?.id ?? null,
          readinessBefore: before,
          readinessAfter: after,
          metadata: {},
          occurredAt: now.toISOString(),
        });
      }

      const stage = deriveJourneyLifecycle({
        readiness: guidance.readiness,
        activeMission: context.activeMission,
        nextReassessmentAt: null,
        hasCompletedMission: context.hasCompletedMission,
        onboardingComplete: context.onboardingComplete,
        now,
      });

      const state = await deps.upsertState({
        userId: input.userId,
        stage,
        activeMissionId: context.activeMission?.id ?? null,
        nextReassessmentAt: null,
        lastReassessedAt: now.toISOString(),
        lastReadinessBand: after,
        updatedAt: now.toISOString(),
      });

      return { before, after, changed, state };
    },
  };
}
