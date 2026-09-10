import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface LenderPilotScope {
  partnerId: string;
  pilotIds: string[];
}

export interface LenderPilotContextItem {
  id: string;
  displayName: string;
  pilotType: "synthetic" | "sandbox" | "live";
  productCategory: string | null;
  startsAt: string;
  endsAt: string | null;
  enabled: boolean;
}

export interface LenderPilotAnalyticsAssignment {
  partnerId: string;
  pilotId: string;
  journeyId: string | null;
  canonicalCodes: string[];
  handoffAt: string;
  activatedAt: string | null;
  journeyStartedAt: string | null;
  firstActionAt: string | null;
  firstReassessedAt: string | null;
  firstReadyToCheckAt: string | null;
  currentReadiness: string | null;
}

export interface LenderPilotAnalyticsReturn {
  partnerId: string;
  pilotId: string;
  journeyId: string;
  routeType: "original" | "alternative";
  customerChoice: string;
  outcome: string;
}

export interface LenderPilotAnalyticsInput {
  assignments: LenderPilotAnalyticsAssignment[];
  returns: LenderPilotAnalyticsReturn[];
  actionSourceAvailable: boolean;
}

export interface LenderPilotAnalytics {
  totals: {
    handoffs: number;
    activated: number;
    startedRecovery: number | null;
    reassessed: number;
    readyToCheck: number;
    voluntaryReturns: number;
  };
  rates: {
    activation: number | null;
    action: number | null;
    recovery: number | null;
    return: number | null;
    endToEndYield: number | null;
  };
  medianTimeToFirstActionHours: number | null;
  medianTimeToReadyDays: number | null;
  returnOutcomes: {
    originalProductReturns: number;
    alternativeRouteChecks: number;
  };
  declineReasons: Array<{
    canonicalCode: string;
    handoffs: number;
    activated: number;
    ready: number;
    returned: number;
  }>;
}

export type LenderPilotAnalyticsResult =
  | { available: true; windowDays: number; analytics: LenderPilotAnalytics }
  | { available: false; reason: "unavailable" };

function scoped(scope: LenderPilotScope, partnerId: string, pilotId: string): boolean {
  return partnerId === scope.partnerId && scope.pilotIds.includes(pilotId);
}

function isVoluntaryReturn(row: LenderPilotAnalyticsReturn): boolean {
  return row.customerChoice === "continue"
    && (row.outcome === "redirected" || row.outcome === "callback_sent");
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const value = sorted.length % 2 === 1
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
  return Number(value.toFixed(2));
}

function ratio(numerator: number | null, denominator: number): number | null {
  if (numerator === null || denominator <= 0) return null;
  return Number((numerator / denominator).toFixed(4));
}

function durationHours(start: string | null, end: string | null): number | null {
  if (!start || !end) return null;
  const startMs = Date.parse(start);
  const endMs = Date.parse(end);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) return null;
  return (endMs - startMs) / 3_600_000;
}

export function aggregateLenderPilotAnalytics(
  scope: LenderPilotScope,
  input: LenderPilotAnalyticsInput,
): LenderPilotAnalytics {
  const pilotIds = new Set(scope.pilotIds);
  const assignments = input.assignments.filter((row) => row.partnerId === scope.partnerId && pilotIds.has(row.pilotId));
  const journeyIds = new Set(assignments.flatMap((row) => row.journeyId ? [row.journeyId] : []));
  const returns = input.returns.filter((row) => scoped(scope, row.partnerId, row.pilotId) && journeyIds.has(row.journeyId));
  const voluntary = returns.filter(isVoluntaryReturn);
  const voluntaryJourneyIds = new Set(voluntary.map((row) => row.journeyId));
  const originalJourneyIds = new Set(voluntary.filter((row) => row.routeType === "original").map((row) => row.journeyId));
  const alternativeJourneyIds = new Set(voluntary.filter((row) => row.routeType === "alternative").map((row) => row.journeyId));

  const activated = assignments.filter((row) => row.activatedAt !== null).length;
  const reassessed = assignments.filter((row) => row.firstReassessedAt !== null).length;
  const readyToCheck = assignments.filter((row) => row.firstReadyToCheckAt !== null).length;
  const startedRecovery = input.actionSourceAvailable
    ? assignments.filter((row) => row.firstActionAt !== null).length
    : null;

  const firstActionDurations = input.actionSourceAvailable
    ? assignments.flatMap((row) => {
      const hours = durationHours(row.journeyStartedAt, row.firstActionAt);
      return hours === null ? [] : [hours];
    })
    : [];
  const readyDurationsDays = assignments.flatMap((row) => {
    const hours = durationHours(row.journeyStartedAt, row.firstReadyToCheckAt);
    return hours === null ? [] : [hours / 24];
  });

  const declineMap = new Map<string, LenderPilotAnalytics["declineReasons"][number]>();
  for (const assignment of assignments) {
    const codes = [...new Set(assignment.canonicalCodes.map((code) => code.trim().toUpperCase()).filter(Boolean))];
    for (const canonicalCode of codes) {
      const current = declineMap.get(canonicalCode) ?? { canonicalCode, handoffs: 0, activated: 0, ready: 0, returned: 0 };
      current.handoffs += 1;
      if (assignment.activatedAt !== null) current.activated += 1;
      if (assignment.firstReadyToCheckAt !== null) current.ready += 1;
      if (assignment.journeyId && voluntaryJourneyIds.has(assignment.journeyId)) current.returned += 1;
      declineMap.set(canonicalCode, current);
    }
  }

  const handoffs = assignments.length;
  const voluntaryReturns = voluntaryJourneyIds.size;
  return {
    totals: {
      handoffs,
      activated,
      startedRecovery,
      reassessed,
      readyToCheck,
      voluntaryReturns,
    },
    rates: {
      activation: ratio(activated, handoffs),
      action: ratio(startedRecovery, activated),
      recovery: ratio(readyToCheck, activated),
      return: ratio(voluntaryReturns, readyToCheck),
      endToEndYield: ratio(voluntaryReturns, handoffs),
    },
    medianTimeToFirstActionHours: input.actionSourceAvailable ? median(firstActionDurations) : null,
    medianTimeToReadyDays: median(readyDurationsDays),
    returnOutcomes: {
      originalProductReturns: originalJourneyIds.size,
      alternativeRouteChecks: alternativeJourneyIds.size,
    },
    declineReasons: [...declineMap.values()].sort((a, b) => a.canonicalCode.localeCompare(b.canonicalCode)),
  };
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function firstActionAfter(
  userId: string,
  journeyStartedAt: string,
  actionRows: Array<Record<string, unknown>>,
): string | null {
  const start = Date.parse(journeyStartedAt);
  let earliest = Number.POSITIVE_INFINITY;
  let result: string | null = null;
  for (const row of actionRows) {
    if (String(row.user_id) !== userId || !row.started_at) continue;
    const time = Date.parse(String(row.started_at));
    if (!Number.isFinite(time) || time < start || time >= earliest) continue;
    earliest = time;
    result = String(row.started_at);
  }
  return result;
}

export async function getLenderPilotAnalytics(
  admin: SupabaseClient,
  scope: LenderPilotScope,
  options: { now?: Date; windowDays?: number } = {},
): Promise<LenderPilotAnalyticsResult> {
  const pilotIds = [...new Set(scope.pilotIds.filter(Boolean))];
  if (!scope.partnerId || pilotIds.length === 0) return { available: false, reason: "unavailable" };

  const now = options.now ?? new Date();
  const windowDays = Math.max(1, Math.min(365, options.windowDays ?? 30));
  const fromIso = new Date(now.getTime() - windowDays * 86_400_000).toISOString();

  const { data: assignmentData, error: assignmentError } = await admin
    .from("recovery_pilot_assignments")
    .select("*")
    .eq("partner_id", scope.partnerId)
    .in("pilot_id", pilotIds)
    .gte("assigned_at", fromIso);
  if (assignmentError) return { available: false, reason: "unavailable" };

  const assignmentRows = (assignmentData ?? []).map((row) => record(row));
  const intakeIds = [...new Set(assignmentRows.map((row) => String(row.intake_session_id)).filter(Boolean))];
  if (intakeIds.length === 0) {
    return {
      available: true,
      windowDays,
      analytics: aggregateLenderPilotAnalytics(scope, { assignments: [], returns: [], actionSourceAvailable: true }),
    };
  }

  const [{ data: intakeData, error: intakeError }, { data: journeyData, error: journeyError }] = await Promise.all([
    admin.from("decline_intake_sessions").select("*").eq("partner_id", scope.partnerId).in("id", intakeIds),
    admin.from("decline_recovery_journeys").select("*").in("intake_session_id", intakeIds),
  ]);
  if (intakeError || journeyError) return { available: false, reason: "unavailable" };

  const intakeRows = (intakeData ?? []).map((row) => record(row));
  const journeyRows = (journeyData ?? []).map((row) => record(row));
  const userIds = [...new Set(journeyRows.map((row) => String(row.user_id)).filter(Boolean))];
  const journeyIds = [...new Set(journeyRows.map((row) => String(row.id)).filter(Boolean))];

  let actionRows: Array<Record<string, unknown>> = [];
  let actionSourceAvailable = true;
  if (userIds.length > 0) {
    const { data, error } = await admin.from("user_missions").select("user_id,started_at").in("user_id", userIds);
    if (error) actionSourceAvailable = false;
    else actionRows = (data ?? []).map((row) => record(row));
  }

  let returnRows: Array<Record<string, unknown>> = [];
  if (journeyIds.length > 0) {
    const { data, error } = await admin
      .from("return_attempts")
      .select("partner_id,recovery_journey_id,route_type,customer_choice,outcome")
      .eq("partner_id", scope.partnerId)
      .in("recovery_journey_id", journeyIds);
    if (error) return { available: false, reason: "unavailable" };
    returnRows = (data ?? []).map((row) => record(row));
  }

  const intakeById = new Map(intakeRows.map((row) => [String(row.id), row]));
  const journeyByIntake = new Map(journeyRows.map((row) => [String(row.intake_session_id), row]));
  const pilotByJourney = new Map<string, string>();

  const assignments: LenderPilotAnalyticsAssignment[] = assignmentRows.map((assignment) => {
    const intakeId = String(assignment.intake_session_id);
    const intake = intakeById.get(intakeId) ?? {};
    const journey = journeyByIntake.get(intakeId) ?? {};
    const journeyId = journey.id ? String(journey.id) : null;
    const pilotId = String(assignment.pilot_id);
    if (journeyId) pilotByJourney.set(journeyId, pilotId);
    const journeyStartedAt = journey.started_at ? String(journey.started_at) : null;
    const userId = journey.user_id ? String(journey.user_id) : null;
    return {
      partnerId: String(assignment.partner_id),
      pilotId,
      journeyId,
      canonicalCodes: stringArray(assignment.canonical_reason_codes),
      handoffAt: String(intake.created_at ?? assignment.assigned_at),
      activatedAt: intake.consumed_at ? String(intake.consumed_at) : null,
      journeyStartedAt,
      firstActionAt: actionSourceAvailable && userId && journeyStartedAt
        ? firstActionAfter(userId, journeyStartedAt, actionRows)
        : null,
      firstReassessedAt: journey.last_reassessed_at ? String(journey.last_reassessed_at) : null,
      firstReadyToCheckAt: journey.first_ready_to_check_at ? String(journey.first_ready_to_check_at) : null,
      currentReadiness: journey.readiness_snapshot ? String(journey.readiness_snapshot) : null,
    };
  });

  const returns: LenderPilotAnalyticsReturn[] = returnRows.flatMap((row) => {
    const journeyId = String(row.recovery_journey_id);
    const pilotId = pilotByJourney.get(journeyId);
    if (!pilotId) return [];
    return [{
      partnerId: String(row.partner_id),
      pilotId,
      journeyId,
      routeType: row.route_type === "alternative" ? "alternative" as const : "original" as const,
      customerChoice: String(row.customer_choice),
      outcome: String(row.outcome),
    }];
  });

  return {
    available: true,
    windowDays,
    analytics: aggregateLenderPilotAnalytics(scope, { assignments, returns, actionSourceAvailable }),
  };
}

export async function getLenderPilotContext(
  admin: SupabaseClient,
  scope: LenderPilotScope,
): Promise<LenderPilotContextItem[]> {
  const pilotIds = [...new Set(scope.pilotIds.filter(Boolean))];
  if (!scope.partnerId || pilotIds.length === 0) return [];

  const { data, error } = await admin
    .from("recovery_pilots")
    .select("id,partner_id,display_name,pilot_type,product_category,starts_at,ends_at,enabled")
    .eq("partner_id", scope.partnerId)
    .in("id", pilotIds)
    .order("starts_at", { ascending: false });
  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: String(row.id),
    displayName: String(row.display_name),
    pilotType: row.pilot_type === "synthetic" ? "synthetic" : row.pilot_type === "live" ? "live" : "sandbox",
    productCategory: row.product_category ? String(row.product_category) : null,
    startsAt: String(row.starts_at),
    endsAt: row.ends_at ? String(row.ends_at) : null,
    enabled: row.enabled === true,
  }));
}
