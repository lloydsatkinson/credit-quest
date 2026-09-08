import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  RecoveryAnalyticsInput,
  RecoveryAnalyticsActionStart,
  RecoveryAnalyticsHandoff,
  RecoveryAnalyticsJourney,
  RecoveryAnalyticsReturn,
} from "@/lib/server/recovery-analytics-repository";

const LENDER_STATUS_FLAGS = [
  "partner_decline_intake_enabled",
  "return_to_origin_enabled",
  "commercial_gateway_enabled",
  "commercial_sandbox_enabled",
  "email_reminders_enabled",
] as const;

const OPEN_MISSION_STATES = [
  "eligible",
  "shown",
  "not_started",
  "started",
  "deferred",
  "in_review",
  "cooldown",
] as const;

export interface LenderRecoveryPartner {
  id: string;
  partnerKey: string;
  displayName: string;
  enabled: boolean;
  sandboxEnabled: boolean;
  liveEnabled: boolean;
}

export interface LenderPipelineJourneySource {
  journeyId: string;
  userId: string;
  startedAt: string;
  completedAt: string | null;
  updatedAt: string;
  stage: string;
  readinessState: string | null;
  nextReassessmentAt: string | null;
  lastReassessedAt: string | null;
  intakeSessionId: string | null;
}

export interface LenderJourneyStateSource {
  userId: string;
  stage: string;
  activeMissionId: string | null;
  nextReassessmentAt: string | null;
  lastReassessedAt: string | null;
  lastReadinessBand: string | null;
}

export interface LenderMissionSource {
  id: string;
  userId: string;
  state: string;
  startedAt: string | null;
  completedAt: string | null;
  nextReviewAt: string | null;
}

export interface LenderActionAttemptSource {
  userId: string;
  missionInstanceId: string;
  status: string;
  startedAt: string;
  nextReviewAt: string | null;
  verifiedAt: string | null;
}

export interface LenderReturnAttemptSource {
  userId: string;
  recoveryJourneyId: string;
  partnerId: string;
  customerChoice: string;
  outcome: string;
  suppressionReason: string | null;
  createdAt: string;
}

export interface LenderPipelineSources {
  journeys: LenderPipelineJourneySource[];
  journeyStates: LenderJourneyStateSource[];
  missions: LenderMissionSource[];
  actionAttempts: LenderActionAttemptSource[];
  returnAttempts: LenderReturnAttemptSource[];
}

export interface LenderPilotFeatureFlagSource {
  flagKey: string;
  enabled: boolean;
}

export interface LenderReturnContractStatusSource {
  id: string;
  environment: string;
  productCategory: string;
  disclosureKey: string;
  disclosureVersion: number;
  callbackPolicy: string;
  enabled: boolean;
  expiresAt: string;
}

export interface LenderDisclosureStatusSource {
  disclosureKey: string;
  version: number;
  status: string;
  publishedAt: string | null;
}

export interface LenderPilotStatusSources {
  partner: LenderRecoveryPartner | null;
  flags: LenderPilotFeatureFlagSource[];
  contracts: LenderReturnContractStatusSource[];
  disclosures: LenderDisclosureStatusSource[];
}

function relationObject(value: unknown): Record<string, unknown> | null {
  if (Array.isArray(value)) {
    return (value[0] as Record<string, unknown> | undefined) ?? null;
  }
  if (value && typeof value === "object") return value as Record<string, unknown>;
  return null;
}

function partnerFromRow(row: Record<string, unknown>): LenderRecoveryPartner {
  return {
    id: String(row.id),
    partnerKey: String(row.partner_key),
    displayName: String(row.display_name),
    enabled: row.enabled === true,
    sandboxEnabled: row.sandbox_enabled === true,
    liveEnabled: row.live_enabled === true,
  };
}

async function readRows(query: PromiseLike<{ data: unknown[] | null; error: unknown }>) {
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Record<string, unknown>[];
}

export async function listLenderRecoveryPartners(
  admin: SupabaseClient,
): Promise<LenderRecoveryPartner[]> {
  const rows = await readRows(
    admin
      .from("decline_partners")
      .select("id,partner_key,display_name,enabled,sandbox_enabled,live_enabled")
      .order("display_name", { ascending: true }),
  );
  return rows.map(partnerFromRow);
}

async function readPartnerHandoffs(
  admin: SupabaseClient,
  partnerId: string,
  fromIso: string,
): Promise<RecoveryAnalyticsHandoff[]> {
  const rows = await readRows(
    admin
      .from("decline_intake_sessions")
      .select("partner_id,created_at,consumed_at,decline_partners!inner(display_name)")
      .eq("partner_id", partnerId)
      .gte("created_at", fromIso),
  );

  return rows.map((row) => {
    const partner = relationObject(row.decline_partners);
    return {
      partnerId: String(row.partner_id),
      partnerDisplayName: String(partner?.display_name ?? "Unknown partner"),
      createdAt: String(row.created_at),
      consumedAt: row.consumed_at ? String(row.consumed_at) : null,
    };
  });
}

async function readPartnerAnalyticsJourneys(
  admin: SupabaseClient,
  partnerId: string,
  fromIso: string,
): Promise<RecoveryAnalyticsJourney[]> {
  const rows = await readRows(
    admin
      .from("decline_recovery_journeys")
      .select("id,user_id,started_at,last_reassessed_at,readiness_snapshot,decline_intake_sessions!inner(partner_id)")
      .eq("origin", "partner")
      .eq("decline_intake_sessions.partner_id", partnerId)
      .gte("started_at", fromIso),
  );

  return rows.map((row) => {
    const intake = relationObject(row.decline_intake_sessions);
    return {
      journeyId: String(row.id),
      userId: String(row.user_id),
      partnerId: intake?.partner_id ? String(intake.partner_id) : null,
      startedAt: String(row.started_at),
      lastReassessedAt: row.last_reassessed_at ? String(row.last_reassessed_at) : null,
      readinessState: row.readiness_snapshot ? String(row.readiness_snapshot) : null,
    };
  });
}

async function readPartnerReturns(
  admin: SupabaseClient,
  partnerId: string,
  fromIso: string,
): Promise<RecoveryAnalyticsReturn[]> {
  const rows = await readRows(
    admin
      .from("return_attempts")
      .select("partner_id,customer_choice,outcome,suppression_reason,created_at")
      .eq("partner_id", partnerId)
      .gte("created_at", fromIso),
  );

  return rows.map((row) => ({
    partnerId: String(row.partner_id),
    customerChoice: String(row.customer_choice),
    outcome: String(row.outcome),
    suppressionReason: row.suppression_reason ? String(row.suppression_reason) : null,
  }));
}

async function readPartnerActionStarts(
  admin: SupabaseClient,
  userIds: string[],
  fromIso: string,
): Promise<RecoveryAnalyticsActionStart[]> {
  if (!userIds.length) return [];
  const rows = await readRows(
    admin
      .from("user_missions")
      .select("user_id,started_at")
      .in("user_id", userIds)
      .gte("started_at", fromIso),
  );

  return rows.flatMap((row) => row.started_at
    ? [{ userId: String(row.user_id), startedAt: String(row.started_at) }]
    : []);
}

export async function readPartnerRecoveryAnalyticsInput(
  admin: SupabaseClient,
  partnerId: string,
  fromIso: string,
): Promise<RecoveryAnalyticsInput> {
  const [handoffs, journeys, returns] = await Promise.all([
    readPartnerHandoffs(admin, partnerId, fromIso),
    readPartnerAnalyticsJourneys(admin, partnerId, fromIso),
    readPartnerReturns(admin, partnerId, fromIso),
  ]);

  const userIds = Array.from(new Set(journeys.map((journey) => journey.userId)));
  let actionStarts: RecoveryAnalyticsActionStart[] | null;
  try {
    actionStarts = await readPartnerActionStarts(admin, userIds, fromIso);
  } catch {
    actionStarts = null;
  }

  return { handoffs, journeys, actionStarts, returns };
}

export async function readPartnerCohortSources(
  admin: SupabaseClient,
  partnerId: string,
  fromIso: string,
): Promise<RecoveryAnalyticsInput> {
  return readPartnerRecoveryAnalyticsInput(admin, partnerId, fromIso);
}

export async function readPartnerPipelineSources(
  admin: SupabaseClient,
  partnerId: string,
): Promise<LenderPipelineSources> {
  const journeyRows = await readRows(
    admin
      .from("decline_recovery_journeys")
      .select([
        "id",
        "user_id",
        "started_at",
        "completed_at",
        "updated_at",
        "stage",
        "readiness_snapshot",
        "next_reassessment_at",
        "last_reassessed_at",
        "intake_session_id",
        "decline_intake_sessions!inner(partner_id)",
      ].join(","))
      .eq("origin", "partner")
      .eq("decline_intake_sessions.partner_id", partnerId),
  );

  const journeys = journeyRows.map((row): LenderPipelineJourneySource => ({
    journeyId: String(row.id),
    userId: String(row.user_id),
    startedAt: String(row.started_at),
    completedAt: row.completed_at ? String(row.completed_at) : null,
    updatedAt: String(row.updated_at),
    stage: String(row.stage),
    readinessState: row.readiness_snapshot ? String(row.readiness_snapshot) : null,
    nextReassessmentAt: row.next_reassessment_at ? String(row.next_reassessment_at) : null,
    lastReassessedAt: row.last_reassessed_at ? String(row.last_reassessed_at) : null,
    intakeSessionId: row.intake_session_id ? String(row.intake_session_id) : null,
  }));

  if (!journeys.length) {
    return {
      journeys: [],
      journeyStates: [],
      missions: [],
      actionAttempts: [],
      returnAttempts: [],
    };
  }

  const userIds = Array.from(new Set(journeys.map((journey) => journey.userId)));
  const journeyIds = journeys.map((journey) => journey.journeyId);

  const [stateRows, missionRows, attemptRows, returnRows] = await Promise.all([
    readRows(
      admin
        .from("journey_state")
        .select("user_id,stage,active_mission_id,next_reassessment_at,last_reassessed_at,last_readiness_band")
        .in("user_id", userIds),
    ),
    readRows(
      admin
        .from("user_missions")
        .select("id,user_id,state,started_at,completed_at,next_review_at")
        .in("user_id", userIds)
        .in("state", [...OPEN_MISSION_STATES]),
    ),
    readRows(
      admin
        .from("action_attempts")
        .select("user_id,mission_instance_id,status,started_at,next_review_at,verified_at")
        .in("user_id", userIds)
        .order("started_at", { ascending: false }),
    ),
    readRows(
      admin
        .from("return_attempts")
        .select("user_id,recovery_journey_id,partner_id,customer_choice,outcome,suppression_reason,created_at")
        .eq("partner_id", partnerId)
        .in("recovery_journey_id", journeyIds)
        .order("created_at", { ascending: false }),
    ),
  ]);

  return {
    journeys,
    journeyStates: stateRows.map((row) => ({
      userId: String(row.user_id),
      stage: String(row.stage),
      activeMissionId: row.active_mission_id ? String(row.active_mission_id) : null,
      nextReassessmentAt: row.next_reassessment_at ? String(row.next_reassessment_at) : null,
      lastReassessedAt: row.last_reassessed_at ? String(row.last_reassessed_at) : null,
      lastReadinessBand: row.last_readiness_band ? String(row.last_readiness_band) : null,
    })),
    missions: missionRows.map((row) => ({
      id: String(row.id),
      userId: String(row.user_id),
      state: String(row.state),
      startedAt: row.started_at ? String(row.started_at) : null,
      completedAt: row.completed_at ? String(row.completed_at) : null,
      nextReviewAt: row.next_review_at ? String(row.next_review_at) : null,
    })),
    actionAttempts: attemptRows.map((row) => ({
      userId: String(row.user_id),
      missionInstanceId: String(row.mission_instance_id),
      status: String(row.status),
      startedAt: String(row.started_at),
      nextReviewAt: row.next_review_at ? String(row.next_review_at) : null,
      verifiedAt: row.verified_at ? String(row.verified_at) : null,
    })),
    returnAttempts: returnRows.map((row) => ({
      userId: String(row.user_id),
      recoveryJourneyId: String(row.recovery_journey_id),
      partnerId: String(row.partner_id),
      customerChoice: String(row.customer_choice),
      outcome: String(row.outcome),
      suppressionReason: row.suppression_reason ? String(row.suppression_reason) : null,
      createdAt: String(row.created_at),
    })),
  };
}

export async function readPartnerPilotStatus(
  admin: SupabaseClient,
  partnerId: string,
): Promise<LenderPilotStatusSources> {
  const partnerResult = await admin
    .from("decline_partners")
    .select("id,partner_key,display_name,enabled,sandbox_enabled,live_enabled")
    .eq("id", partnerId)
    .maybeSingle();
  if (partnerResult.error) throw partnerResult.error;
  if (!partnerResult.data) {
    return { partner: null, flags: [], contracts: [], disclosures: [] };
  }

  const [flagRows, contractRows] = await Promise.all([
    readRows(
      admin
        .from("feature_flags")
        .select("flag_key,enabled")
        .in("flag_key", [...LENDER_STATUS_FLAGS]),
    ),
    readRows(
      admin
        .from("return_contracts")
        .select("id,environment,product_category,disclosure_key,disclosure_version,callback_policy,enabled,expires_at")
        .eq("partner_id", partnerId),
    ),
  ]);

  const disclosureKeys = Array.from(new Set(
    contractRows
      .map((row) => row.disclosure_key ? String(row.disclosure_key) : null)
      .filter((value): value is string => value !== null),
  ));

  const disclosureRows = disclosureKeys.length
    ? await readRows(
      admin
        .from("commercial_disclosures")
        .select("disclosure_key,version,status,published_at")
        .in("disclosure_key", disclosureKeys),
    )
    : [];

  return {
    partner: partnerFromRow(partnerResult.data as Record<string, unknown>),
    flags: flagRows.map((row) => ({
      flagKey: String(row.flag_key),
      enabled: row.enabled === true,
    })),
    contracts: contractRows.map((row) => ({
      id: String(row.id),
      environment: String(row.environment),
      productCategory: String(row.product_category),
      disclosureKey: String(row.disclosure_key),
      disclosureVersion: Number(row.disclosure_version),
      callbackPolicy: String(row.callback_policy),
      enabled: row.enabled === true,
      expiresAt: String(row.expires_at),
    })),
    disclosures: disclosureRows.map((row) => ({
      disclosureKey: String(row.disclosure_key),
      version: Number(row.version),
      status: String(row.status),
      publishedAt: row.published_at ? String(row.published_at) : null,
    })),
  };
}
