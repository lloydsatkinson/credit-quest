import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface JourneyMetrics {
  onboardingCompleted: number;
  missionStarted: number;
  missionCompleted: number;
  reassessments: number;
  readinessChanged: number;
  readinessMovement: Record<"red_to_amber" | "amber_to_green" | "other", number>;
  remindersSent: number;
}

export interface CommercialMetrics {
  sandboxReferrals: number;
  consentAccepted: number;
  revenueEvents: number;
  confirmedRevenueMinor: number;
}

export type MetricsResult =
  | { available: true; windowDays: number; journey: JourneyMetrics; commercial: CommercialMetrics }
  | { available: false; reason: "unavailable" };

type OutcomeRow = { event_type: string; readiness_before: string | null; readiness_after: string | null };
type ReminderRow = { status: string };
type ReferralRow = { environment: string };
type EventRow = { event_name: string };
type RevenueRow = { event_type: string; amount_minor: number | null };

function signedRevenue(eventType: string, amount: number | null): number {
  if (amount === null) return 0;
  if (eventType === "revenue" || eventType === "adjustment") return amount;
  if (eventType === "reversal") return -amount;
  return 0;
}

export function aggregateV22Metrics(input: {
  outcomes: OutcomeRow[];
  reminders: ReminderRow[];
  referrals: ReferralRow[];
  events: EventRow[];
  revenue: RevenueRow[];
}): { journey: JourneyMetrics; commercial: CommercialMetrics } {
  const movement = { red_to_amber: 0, amber_to_green: 0, other: 0 };
  for (const outcome of input.outcomes) {
    if (outcome.event_type !== "readiness_changed") continue;
    const before = outcome.readiness_before;
    const after = outcome.readiness_after;
    if (!before || !after || before === after) continue;
    if (before === "red" && after === "amber") movement.red_to_amber += 1;
    else if (before === "amber" && after === "green") movement.amber_to_green += 1;
    else movement.other += 1;
  }

  return {
    journey: {
      onboardingCompleted: input.outcomes.filter((row) => row.event_type === "onboarding_completed").length,
      missionStarted: input.outcomes.filter((row) => row.event_type === "mission_started").length,
      missionCompleted: input.outcomes.filter((row) => row.event_type === "mission_completed").length,
      reassessments: input.outcomes.filter((row) => row.event_type === "reassessment_performed").length,
      readinessChanged: input.outcomes.filter((row) => row.event_type === "readiness_changed").length,
      readinessMovement: movement,
      remindersSent: input.reminders.filter((row) => row.status === "sent").length,
    },
    commercial: {
      sandboxReferrals: input.referrals.filter((row) => row.environment === "sandbox").length,
      consentAccepted: input.events.filter((row) => row.event_name === "referral_consent_accepted").length,
      revenueEvents: input.revenue.length,
      confirmedRevenueMinor: input.revenue.reduce(
        (total, row) => total + signedRevenue(row.event_type, row.amount_minor),
        0,
      ),
    },
  };
}

async function readRange<T>(
  admin: SupabaseClient,
  table: string,
  columns: string,
  dateField: string,
  fromIso: string,
): Promise<T[]> {
  const { data, error } = await admin.from(table).select(columns).gte(dateField, fromIso);
  if (error) throw error;
  return (data ?? []) as T[];
}

export async function getV22Metrics(
  admin: SupabaseClient,
  options: { now?: Date; windowDays?: number } = {},
): Promise<MetricsResult> {
  const now = options.now ?? new Date();
  const clampedWindow = Math.max(1, Math.min(90, options.windowDays ?? 30));
  const fromIso = new Date(now.getTime() - clampedWindow * 86_400_000).toISOString();

  try {
    const outcomes = await readRange<OutcomeRow>(
      admin,
      "journey_outcomes",
      "event_type,readiness_before,readiness_after,occurred_at",
      "occurred_at",
      fromIso,
    );
    const reminders = await readRange<ReminderRow>(
      admin,
      "journey_reminders",
      "status,sent_at",
      "created_at",
      fromIso,
    );
    const referrals = await readRange<ReferralRow>(
      admin,
      "referral_attempts",
      "environment,created_at",
      "created_at",
      fromIso,
    );
    const revenue = await readRange<RevenueRow>(
      admin,
      "revenue_events",
      "event_type,amount_minor,occurred_at",
      "occurred_at",
      fromIso,
    );
    const events = await readRange<EventRow>(
      admin,
      "events",
      "event_name,created_at",
      "created_at",
      fromIso,
    );

    const aggregated = aggregateV22Metrics({ outcomes, reminders, referrals, revenue, events });
    return { available: true, windowDays: clampedWindow, ...aggregated };
  } catch {
    return { available: false, reason: "unavailable" };
  }
}
