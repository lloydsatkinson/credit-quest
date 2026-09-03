import "server-only";
import type { CreditProfile } from "@/lib/domain/types";
import { rankMissionInstances } from "@/lib/domain/mission-engine";
import { assessSafety, type SafetyMode } from "@/lib/domain/safety";
import {
  buildRecoveryPlan,
  type RecoveryMissionSummary,
  type RecoveryPlanProjection,
} from "@/lib/recovery/plan";
import { listUserAccounts } from "@/lib/server/account-repository";
import {
  getCreditGuidanceForUser,
  type CreditGuidance,
} from "@/lib/server/credit-guidance-service";
import { syncMissionInstances } from "@/lib/server/mission-repository";
import { persistRecoveryProjection } from "@/lib/server/recovery-repository";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export interface RecoveryProjectionWrite {
  recoveryJourneyId: string;
  userId: string;
  projection: RecoveryPlanProjection;
  now: Date;
}

export interface RecoveryOrchestratorDeps {
  getGuidance(userId: string, now: Date): Promise<CreditGuidance | null>;
  getSafetyMode(profile: CreditProfile): SafetyMode;
  getNextMission(userId: string, profile: CreditProfile, now: Date): Promise<RecoveryMissionSummary | null>;
  persistProjection(input: RecoveryProjectionWrite): Promise<void>;
}

export function createRecoveryOrchestrator(deps: RecoveryOrchestratorDeps) {
  return {
    async projectForUser(input: {
      recoveryJourneyId: string;
      userId: string;
      now?: Date;
    }): Promise<RecoveryPlanProjection> {
      const now = input.now ?? new Date();
      const guidance = await deps.getGuidance(input.userId, now);
      if (!guidance) {
        throw new Error("Credit guidance unavailable for recovery projection");
      }

      const safetyMode = deps.getSafetyMode(guidance.profile);
      const nextMission = await deps.getNextMission(input.userId, guidance.profile, now);
      const projection = buildRecoveryPlan({
        safetyMode,
        readiness: guidance.readiness,
        diagnosis: guidance.diagnosis,
        passport: guidance.passport,
        nextMission,
      });

      await deps.persistProjection({
        recoveryJourneyId: input.recoveryJourneyId,
        userId: input.userId,
        projection,
        now,
      });
      return projection;
    },
  };
}

async function productionOrchestrator() {
  const server = await createServerSupabaseClient();
  const admin = createAdminSupabaseClient();

  return createRecoveryOrchestrator({
    getGuidance: (userId, now) => getCreditGuidanceForUser(server, userId, now),
    getSafetyMode: (profile) => assessSafety(profile).mode,
    getNextMission: async (userId, profile, now) => {
      const accounts = await listUserAccounts(server, userId);
      const instances = await syncMissionInstances(server, profile, accounts, now);
      const next = rankMissionInstances(profile, instances, accounts, now)[0] ?? null;
      if (!next) return null;
      return {
        slug: next.mission.slug,
        title: next.mission.title,
        nextReviewAt: next.instance.nextReviewAt,
      };
    },
    persistProjection: (input) => persistRecoveryProjection(admin, input),
  });
}

export async function projectRecoveryForUser(input: {
  recoveryJourneyId: string;
  userId: string;
  now?: Date;
}): Promise<RecoveryPlanProjection> {
  const orchestrator = await productionOrchestrator();
  return orchestrator.projectForUser(input);
}
