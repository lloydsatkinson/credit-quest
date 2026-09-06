import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ActionAttemptStatus } from "@/lib/domain/types";
import type { JourneyLifecycleStage } from "@/lib/journey/types";
import {
  buildLenderOverviewProjection,
  deriveLenderRecoveryState,
  shouldIncludeLenderPipelineJourney,
  summariseLenderEvidenceConfidence,
  type LenderDemoWindowDays,
} from "@/lib/recovery/lender-projection";
import type { RecoveryStage } from "@/lib/recovery/plan";
import type { RecoveryReadinessState } from "@/lib/recovery/types";
import {
  createLenderPilotCaseReference,
  getLenderPilotReferenceSecret,
} from "@/lib/server/lender-pilot-reference";
import {
  listLenderRecoveryPartners,
  readPartnerCohortSources,
  readPartnerPipelineSources,
  readPartnerPilotStatus,
  readPartnerRecoveryAnalyticsInput,
  type LenderActionAttemptSource,
  type LenderPipelineJourneySource,
  type LenderReturnAttemptSource,
} from "@/lib/server/lender-recovery-repository";
import { aggregateRecoveryAnalytics } from "@/lib/server/recovery-analytics-repository";
import {
  getReturnOriginAvailability,
  LIVE_RETURN_TO_ORIGIN_ALLOWED,
  type ReturnOriginAvailability,
} from "@/lib/server/return-origin-gateway";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export type LenderReturnAvailability = "available" | "blocked" | "unavailable";

export interface LenderPipelineRow {
  caseReference: string;
  state: "action_required" | "waiting_for_evidence" | "reassessment_due" | "not_ready" | "ready_to_check";
  stage: string;
  timeInRecoveryDays: number | null;
  nextMilestone: string;
  evidenceConfidence: "verified" | "confirmed" | "pending" | "unknown";
  reassessmentAt: string | null;
  readinessState: string | null;
  returnAvailability: LenderReturnAvailability;
  returnOutcome: string | null;
}

export type LenderPipelineResult =
  | { available: true; rows: LenderPipelineRow[] }
  | { available: false; reason: "reference_secret_unavailable" | "unavailable" };

export type LenderOverviewResult =
  | {
      available: true;
      overview: ReturnType<typeof buildLenderOverviewProjection>;
    }
  | { available: false; reason: "unavailable" };

export type LenderStatusResult =
  | {
      available: true;
      partner: Awaited<ReturnType<typeof readPartnerPilotStatus>>["partner"];
      flags: Awaited<ReturnType<typeof readPartnerPilotStatus>>["flags"];
      contracts: Awaited<ReturnType<typeof readPartnerPilotStatus>>["contracts"];
      disclosures: Awaited<ReturnType<typeof readPartnerPilotStatus>>["disclosures"];
      liveCreditReferralsAllowed: boolean;
      liveReturnToOriginAllowed: boolean;
    }
  | { available: false; reason: "unavailable" };

export type LenderCohortResult =
  | { available: true; rows: never[] }
  | { available: false; reason: "cohort_projection_unavailable" | "unavailable" };

export interface LenderRecoveryServiceDependencies {
  admin: SupabaseClient;
  getReferenceSecret(): string | null;
  getReturnAvailability(input: {
    userId: string;
    recoveryJourneyId: string;
    now: Date;
  }): Promise<ReturnOriginAvailability>;
  liveCreditReferralsAllowed: boolean;
  liveReturnToOriginAllowed: boolean;
}

const OPEN_ACTION_STATUSES: ActionAttemptStatus[] = ["started", "returned", "submitted"];

function fromForWindow(now: Date, windowDays: LenderDemoWindowDays): Date {
  return new Date(now.getTime() - windowDays * 86_400_000);
}

function latestReturnForJourney(
  attempts: LenderReturnAttemptSource[],
  journeyId: string,
): LenderReturnAttemptSource | null {
  let latest: LenderReturnAttemptSource | null = null;
  let latestTime = Number.NEGATIVE_INFINITY;

  for (const attempt of attempts) {
    if (attempt.recoveryJourneyId !== journeyId) continue;
    const time = Date.parse(attempt.createdAt);
    if (!Number.isFinite(time) || time <= latestTime) continue;
    latest = attempt;
    latestTime = time;
  }
  return latest;
}

function maxIso(values: Array<string | null | undefined>): string | null {
  let latest: string | null = null;
  let latestTime = Number.NEGATIVE_INFINITY;
  for (const value of values) {
    if (!value) continue;
    const time = Date.parse(value);
    if (!Number.isFinite(time) || time <= latestTime) continue;
    latest = new Date(time).toISOString();
    latestTime = time;
  }
  return latest;
}

function openAttemptForUser(
  attempts: LenderActionAttemptSource[],
  userId: string,
) {
  const found = attempts.find((attempt) => (
    attempt.userId === userId
    && OPEN_ACTION_STATUSES.includes(attempt.status as ActionAttemptStatus)
    && attempt.verifiedAt === null
  ));

  return found
    ? {
        status: found.status as ActionAttemptStatus,
        nextReviewAt: found.nextReviewAt,
        verifiedAt: found.verifiedAt,
      }
    : null;
}

function evidenceAttemptsForUser(
  attempts: LenderActionAttemptSource[],
  userId: string,
) {
  return attempts
    .filter((attempt) => attempt.userId === userId)
    .map((attempt) => ({
      status: attempt.status as ActionAttemptStatus,
      nextReviewAt: attempt.nextReviewAt,
      verifiedAt: attempt.verifiedAt,
    }));
}

function timeInRecoveryDays(startedAt: string, now: Date): number | null {
  const started = Date.parse(startedAt);
  if (!Number.isFinite(started)) return null;
  return Math.max(0, Number(((now.getTime() - started) / 86_400_000).toFixed(1)));
}

function nextMilestoneFor(
  state: LenderPipelineRow["state"],
): string {
  switch (state) {
    case "action_required":
      return "Recovery action";
    case "waiting_for_evidence":
      return "Evidence review";
    case "reassessment_due":
      return "Reassessment";
    case "ready_to_check":
      return "Eligibility check";
    case "not_ready":
      return "Further recovery";
  }
}

function safeReturnAvailability(
  settled: PromiseSettledResult<ReturnOriginAvailability>,
): LenderReturnAvailability {
  return settled.status === "fulfilled" ? settled.value.status : "unavailable";
}

function buildPipelineRow(input: {
  journey: LenderPipelineJourneySource;
  sources: Awaited<ReturnType<typeof readPartnerPipelineSources>>;
  availability: PromiseSettledResult<ReturnOriginAvailability>;
  secret: string;
  now: Date;
}): LenderPipelineRow {
  const journeyState = input.sources.journeyStates.find(
    (state) => state.userId === input.journey.userId,
  ) ?? null;
  const latestReturn = latestReturnForJourney(
    input.sources.returnAttempts,
    input.journey.journeyId,
  );
  const openAttempt = openAttemptForUser(
    input.sources.actionAttempts,
    input.journey.userId,
  );

  const state = deriveLenderRecoveryState({
    recoveryStage: input.journey.stage as RecoveryStage,
    readinessState: input.journey.readinessState as RecoveryReadinessState | null,
    journeyStage: journeyState?.stage as JourneyLifecycleStage | null,
    activeMissionId: journeyState?.activeMissionId ?? null,
    openAttempt,
    now: input.now,
  });

  return {
    caseReference: createLenderPilotCaseReference(
      input.secret,
      input.journey.journeyId,
    ),
    state,
    stage: input.journey.stage,
    timeInRecoveryDays: timeInRecoveryDays(input.journey.startedAt, input.now),
    nextMilestone: nextMilestoneFor(state),
    evidenceConfidence: summariseLenderEvidenceConfidence(
      evidenceAttemptsForUser(input.sources.actionAttempts, input.journey.userId),
      input.now,
    ),
    reassessmentAt: journeyState?.nextReassessmentAt ?? input.journey.nextReassessmentAt,
    readinessState: input.journey.readinessState,
    returnAvailability: safeReturnAvailability(input.availability),
    returnOutcome: latestReturn?.outcome ?? null,
  };
}

export function createLenderRecoveryService(
  deps: LenderRecoveryServiceDependencies,
) {
  return {
    async listPartners() {
      return listLenderRecoveryPartners(deps.admin);
    },

    async getOverview(
      partnerId: string,
      windowDays: LenderDemoWindowDays,
      now: Date = new Date(),
    ): Promise<LenderOverviewResult> {
      try {
        const analyticsInput = await readPartnerRecoveryAnalyticsInput(
          deps.admin,
          partnerId,
          fromForWindow(now, windowDays).toISOString(),
        );
        const aggregate = aggregateRecoveryAnalytics(analyticsInput);
        return {
          available: true,
          overview: buildLenderOverviewProjection({
            handoffs: aggregate.totals.handoffs,
            activations: aggregate.totals.activations,
            firstActions: aggregate.totals.firstActions,
            reassessments: aggregate.totals.reassessments,
            readyToCheck: aggregate.totals.readyToCheck,
            voluntaryReturns: aggregate.totals.voluntaryReturns,
            averageTimeToFirstActionHours: aggregate.averageTimeToFirstActionHours,
            suppressionReasons: aggregate.suppressionReasons,
          }),
        };
      } catch {
        return { available: false, reason: "unavailable" };
      }
    },

    async getPipeline(
      partnerId: string,
      windowDays: LenderDemoWindowDays,
      now: Date = new Date(),
    ): Promise<LenderPipelineResult> {
      const secret = deps.getReferenceSecret();
      if (!secret) {
        return { available: false, reason: "reference_secret_unavailable" };
      }

      try {
        const sources = await readPartnerPipelineSources(deps.admin, partnerId);
        const from = fromForWindow(now, windowDays);
        const included = sources.journeys.filter((journey) => {
          const latestReturn = latestReturnForJourney(
            sources.returnAttempts,
            journey.journeyId,
          );
          return shouldIncludeLenderPipelineJourney({
            completedAt: journey.completedAt,
            finalActivityAt: maxIso([
              journey.updatedAt,
              journey.completedAt,
              latestReturn?.createdAt,
            ]),
          }, from);
        });

        const availability = await Promise.allSettled(
          included.map((journey) => deps.getReturnAvailability({
            userId: journey.userId,
            recoveryJourneyId: journey.journeyId,
            now,
          })),
        );

        return {
          available: true,
          rows: included.map((journey, index) => buildPipelineRow({
            journey,
            sources,
            availability: availability[index],
            secret,
            now,
          })),
        };
      } catch {
        return { available: false, reason: "unavailable" };
      }
    },

    async getCohorts(
      partnerId: string,
      windowDays: LenderDemoWindowDays,
      now: Date = new Date(),
    ): Promise<LenderCohortResult> {
      try {
        await readPartnerCohortSources(
          deps.admin,
          partnerId,
          fromForWindow(now, windowDays).toISOString(),
        );
        return { available: false, reason: "cohort_projection_unavailable" };
      } catch {
        return { available: false, reason: "unavailable" };
      }
    },

    async getStatus(partnerId: string): Promise<LenderStatusResult> {
      try {
        const sources = await readPartnerPilotStatus(deps.admin, partnerId);
        return {
          available: true,
          partner: sources.partner,
          flags: sources.flags,
          contracts: sources.contracts,
          disclosures: sources.disclosures,
          liveCreditReferralsAllowed: deps.liveCreditReferralsAllowed,
          liveReturnToOriginAllowed: deps.liveReturnToOriginAllowed,
        };
      } catch {
        return { available: false, reason: "unavailable" };
      }
    },
  };
}

export function createProductionLenderRecoveryService() {
  const admin = createAdminSupabaseClient();
  return createLenderRecoveryService({
    admin,
    getReferenceSecret: () => getLenderPilotReferenceSecret(),
    getReturnAvailability: ({ userId, recoveryJourneyId, now }) =>
      getReturnOriginAvailability({ userId, recoveryJourneyId, now }),
    liveCreditReferralsAllowed: process.env.LIVE_CREDIT_REFERRALS_ALLOWED === "true",
    liveReturnToOriginAllowed: LIVE_RETURN_TO_ORIGIN_ALLOWED,
  });
}
