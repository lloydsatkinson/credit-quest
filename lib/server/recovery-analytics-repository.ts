import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface RecoveryAnalyticsHandoff {
  partnerId: string;
  partnerDisplayName: string;
  createdAt: string;
  consumedAt: string | null;
}

export interface RecoveryAnalyticsJourney {
  journeyId: string;
  userId: string;
  partnerId: string | null;
  startedAt: string;
  lastReassessedAt: string | null;
  readinessState: string | null;
}

export interface RecoveryAnalyticsActionStart {
  userId: string;
  startedAt: string;
}

export interface RecoveryAnalyticsReturn {
  partnerId: string;
  customerChoice: string;
  outcome: string;
  suppressionReason: string | null;
}

export interface RecoveryAnalyticsInput {
  handoffs: RecoveryAnalyticsHandoff[];
  journeys: RecoveryAnalyticsJourney[];
  actionStarts: RecoveryAnalyticsActionStart[] | null;
  returns: RecoveryAnalyticsReturn[];
}

export interface RecoveryAnalyticsTotals {
  handoffs: number;
  activations: number;
  firstActions: number | null;
  reassessments: number;
  readyToCheck: number;
  voluntaryReturns: number;
}

export interface RecoveryPartnerAnalytics {
  partnerId: string;
  partnerDisplayName: string;
  handoffs: number;
  activations: number;
  readyToCheck: number;
  voluntaryReturns: number;
}

export interface RecoveryAnalyticsAggregate {
  totals: RecoveryAnalyticsTotals;
  averageTimeToFirstActionHours: number | null;
  suppressionReasons: Record<string, number>;
  partners: RecoveryPartnerAnalytics[];
  sources: {
    recovery: "available";
    actions: "available" | "unavailable";
  };
}

export type RecoveryAnalyticsResult =
  | ({ available: true; windowDays: number } & RecoveryAnalyticsAggregate)
  | { available: false; reason: "unavailable" };

function isVoluntaryReturn(row: RecoveryAnalyticsReturn): boolean {
  return row.customerChoice === "continue"
    && (row.outcome === "redirected" || row.outcome === "callback_sent");
}

function firstActionForJourney(
  journey: RecoveryAnalyticsJourney,
  actionStarts: RecoveryAnalyticsActionStart[],
): RecoveryAnalyticsActionStart | null {
  const journeyStart = Date.parse(journey.startedAt);
  if (!Number.isFinite(journeyStart)) return null;

  let earliest: RecoveryAnalyticsActionStart | null = null;
  let earliestTime = Number.POSITIVE_INFINITY;
  for (const action of actionStarts) {
    if (action.userId !== journey.userId) continue;
    const actionTime = Date.parse(action.startedAt);
    if (!Number.isFinite(actionTime) || actionTime < journeyStart) continue;
    if (actionTime < earliestTime) {
      earliest = action;
      earliestTime = actionTime;
    }
  }
  return earliest;
}

function partnerNameMap(handoffs: RecoveryAnalyticsHandoff[]): Map<string, string> {
  const names = new Map<string, string>();
  for (const handoff of handoffs) {
    if (!names.has(handoff.partnerId)) names.set(handoff.partnerId, handoff.partnerDisplayName);
  }
  return names;
}

export function aggregateRecoveryAnalytics(
  input: RecoveryAnalyticsInput,
): RecoveryAnalyticsAggregate {
  const voluntaryReturns = input.returns.filter(isVoluntaryReturn);
  const suppressionReasons: Record<string, number> = {};
  for (const row of input.returns) {
    if (!row.suppressionReason) continue;
    suppressionReasons[row.suppressionReason] = (suppressionReasons[row.suppressionReason] ?? 0) + 1;
  }

  let firstActions: number | null = null;
  let averageTimeToFirstActionHours: number | null = null;
  if (input.actionStarts !== null) {
    const durations: number[] = [];
    for (const journey of input.journeys) {
      const action = firstActionForJourney(journey, input.actionStarts);
      if (!action) continue;
      const journeyStart = Date.parse(journey.startedAt);
      const actionTime = Date.parse(action.startedAt);
      durations.push((actionTime - journeyStart) / 3_600_000);
    }
    firstActions = durations.length;
    averageTimeToFirstActionHours = durations.length
      ? Number((durations.reduce((sum, hours) => sum + hours, 0) / durations.length).toFixed(2))
      : null;
  }

  const partnerNames = partnerNameMap(input.handoffs);
  const partnerIds = Array.from(new Set(input.handoffs.map((row) => row.partnerId)));
  const partners = partnerIds.map((partnerId) => ({
    partnerId,
    partnerDisplayName: partnerNames.get(partnerId) ?? "Unknown partner",
    handoffs: input.handoffs.filter((row) => row.partnerId === partnerId).length,
    activations: input.handoffs.filter((row) => row.partnerId === partnerId && row.consumedAt !== null).length,
    readyToCheck: input.journeys.filter(
      (row) => row.partnerId === partnerId && row.readinessState === "ready_to_check",
    ).length,
    voluntaryReturns: voluntaryReturns.filter((row) => row.partnerId === partnerId).length,
  })).sort((a, b) => a.partnerDisplayName.localeCompare(b.partnerDisplayName));

  return {
    totals: {
      handoffs: input.handoffs.length,
      activations: input.handoffs.filter((row) => row.consumedAt !== null).length,
      firstActions,
      reassessments: input.journeys.filter((row) => row.lastReassessedAt !== null).length,
      readyToCheck: input.journeys.filter((row) => row.readinessState === "ready_to_check").length,
      voluntaryReturns: voluntaryReturns.length,
    },
    averageTimeToFirstActionHours,
    suppressionReasons,
    partners,
    sources: {
      recovery: "available",
      actions: input.actionStarts === null ? "unavailable" : "available",
    },
  };
}

function relationObject(value: unknown): Record<string, unknown> | null {
  if (Array.isArray(value)) return (value[0] as Record<string, unknown> | undefined) ?? null;
  if (value && typeof value === "object") return value as Record<string, unknown>;
  return null;
}

async function readHandoffs(
  admin: SupabaseClient,
  fromIso: string,
): Promise<RecoveryAnalyticsHandoff[]> {
  const { data, error } = await admin
    .from("decline_intake_sessions")
    .select("partner_id,created_at,consumed_at,decline_partners!inner(display_name)")
    .gte("created_at", fromIso);
  if (error) throw error;

  return (data ?? []).map((raw) => {
    const row = raw as unknown as Record<string, unknown>;
    const partner = relationObject(row.decline_partners);
    return {
      partnerId: String(row.partner_id),
      partnerDisplayName: String(partner?.display_name ?? "Unknown partner"),
      createdAt: String(row.created_at),
      consumedAt: row.consumed_at ? String(row.consumed_at) : null,
    };
  });
}

async function readJourneys(
  admin: SupabaseClient,
  fromIso: string,
): Promise<RecoveryAnalyticsJourney[]> {
  const { data, error } = await admin
    .from("decline_recovery_journeys")
    .select("id,user_id,started_at,last_reassessed_at,readiness_snapshot,decline_intake_sessions(partner_id)")
    .gte("started_at", fromIso);
  if (error) throw error;

  return (data ?? []).map((raw) => {
    const row = raw as unknown as Record<string, unknown>;
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

async function readReturns(
  admin: SupabaseClient,
  fromIso: string,
): Promise<RecoveryAnalyticsReturn[]> {
  const { data, error } = await admin
    .from("return_attempts")
    .select("partner_id,customer_choice,outcome,suppression_reason,created_at")
    .gte("created_at", fromIso);
  if (error) throw error;

  return (data ?? []).map((raw) => {
    const row = raw as unknown as Record<string, unknown>;
    return {
      partnerId: String(row.partner_id),
      customerChoice: String(row.customer_choice),
      outcome: String(row.outcome),
      suppressionReason: row.suppression_reason ? String(row.suppression_reason) : null,
    };
  });
}

async function readActionStarts(
  admin: SupabaseClient,
  fromIso: string,
): Promise<RecoveryAnalyticsActionStart[]> {
  const { data, error } = await admin
    .from("user_missions")
    .select("user_id,started_at")
    .gte("started_at", fromIso);
  if (error) throw error;

  return (data ?? []).flatMap((raw) => {
    const row = raw as unknown as Record<string, unknown>;
    if (!row.started_at) return [];
    return [{ userId: String(row.user_id), startedAt: String(row.started_at) }];
  });
}

export async function getRecoveryAnalytics(
  admin: SupabaseClient,
  options: { now?: Date; windowDays?: number } = {},
): Promise<RecoveryAnalyticsResult> {
  const now = options.now ?? new Date();
  const windowDays = Math.max(1, Math.min(90, options.windowDays ?? 30));
  const fromIso = new Date(now.getTime() - windowDays * 86_400_000).toISOString();

  let handoffs: RecoveryAnalyticsHandoff[];
  let journeys: RecoveryAnalyticsJourney[];
  let returns: RecoveryAnalyticsReturn[];
  try {
    [handoffs, journeys, returns] = await Promise.all([
      readHandoffs(admin, fromIso),
      readJourneys(admin, fromIso),
      readReturns(admin, fromIso),
    ]);
  } catch {
    return { available: false, reason: "unavailable" };
  }

  let actionStarts: RecoveryAnalyticsActionStart[] | null;
  try {
    actionStarts = await readActionStarts(admin, fromIso);
  } catch {
    actionStarts = null;
  }

  return {
    available: true,
    windowDays,
    ...aggregateRecoveryAnalytics({ handoffs, journeys, returns, actionStarts }),
  };
}
