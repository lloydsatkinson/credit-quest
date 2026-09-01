import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ReminderCandidate,
  ReminderChannel,
  ReminderReason,
  ReminderStatus,
} from "@/lib/reminders/types";

export interface CommunicationPreference {
  userId: string;
  journeyEmailEnabled: boolean;
  journeyEmailSuppressedAt: string | null;
  suppressionReason: string | null;
  updatedAt: string;
}

export interface JourneyReminder {
  id: string;
  userId: string;
  reason: ReminderReason;
  channel: ReminderChannel;
  status: ReminderStatus;
  dueAt: string;
  sourceOutcomeId: string | null;
  sourceKey: string;
  templateKey: string;
  templateVersion: number;
  suppressionReason: string | null;
  sentAt: string | null;
  providerReference: string | null;
  attemptCount: number;
  claimedAt: string | null;
}

function mapPreferenceRow(row: Record<string, unknown>): CommunicationPreference {
  return {
    userId: String(row.user_id),
    journeyEmailEnabled: row.journey_email_enabled === true,
    journeyEmailSuppressedAt: row.journey_email_suppressed_at
      ? String(row.journey_email_suppressed_at)
      : null,
    suppressionReason: row.suppression_reason ? String(row.suppression_reason) : null,
    updatedAt: String(row.updated_at),
  };
}

function mapReminderRow(row: Record<string, unknown>): JourneyReminder {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    reason: row.reason as ReminderReason,
    channel: row.channel as ReminderChannel,
    status: row.status as ReminderStatus,
    dueAt: String(row.due_at),
    sourceOutcomeId: row.source_outcome_id ? String(row.source_outcome_id) : null,
    sourceKey: String(row.source_key),
    templateKey: String(row.template_key),
    templateVersion: Number(row.template_version),
    suppressionReason: row.suppression_reason ? String(row.suppression_reason) : null,
    sentAt: row.sent_at ? String(row.sent_at) : null,
    providerReference: row.provider_reference ? String(row.provider_reference) : null,
    attemptCount: Number(row.attempt_count),
    claimedAt: row.claimed_at ? String(row.claimed_at) : null,
  };
}

export function clampReminderClaimLimit(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.max(1, Math.min(100, Math.trunc(value)));
}

export async function getCommunicationPreference(
  client: SupabaseClient,
  userId: string,
): Promise<CommunicationPreference | null> {
  const { data, error } = await client
    .from("communication_preferences")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data ? mapPreferenceRow(data as Record<string, unknown>) : null;
}

export async function setJourneyEmailPreference(
  admin: SupabaseClient,
  userId: string,
  enabled: boolean,
  now = new Date(),
): Promise<CommunicationPreference> {
  const nowIso = now.toISOString();
  const { data, error } = await admin
    .from("communication_preferences")
    .upsert({
      user_id: userId,
      journey_email_enabled: enabled,
      journey_email_suppressed_at: enabled ? null : nowIso,
      suppression_reason: enabled ? null : "user_disabled",
      updated_at: nowIso,
    })
    .select("*")
    .single();
  if (error) throw error;
  return mapPreferenceRow(data as Record<string, unknown>);
}

export async function listUserInAppReminders(
  client: SupabaseClient,
  userId: string,
  now = new Date(),
): Promise<JourneyReminder[]> {
  const { data, error } = await client
    .from("journey_reminders")
    .select("*")
    .eq("user_id", userId)
    .eq("channel", "in_app")
    .eq("status", "scheduled")
    .lte("due_at", now.toISOString())
    .order("due_at", { ascending: true })
    .limit(3);
  if (error) throw error;
  return (data ?? []).map((row) => mapReminderRow(row as Record<string, unknown>));
}

export async function scheduleReminder(
  admin: SupabaseClient,
  userId: string,
  channel: ReminderChannel,
  candidate: ReminderCandidate,
) {
  const payload = {
    user_id: userId,
    reason: candidate.reason,
    channel,
    status: "scheduled",
    due_at: candidate.dueAt,
    source_outcome_id: candidate.sourceOutcomeId,
    source_key: candidate.sourceKey,
    template_key: candidate.templateKey,
    template_version: 1,
  };

  const inserted = await admin
    .from("journey_reminders")
    .insert(payload)
    .select("*")
    .maybeSingle();
  if (!inserted.error && inserted.data) return inserted.data;

  const existing = await admin
    .from("journey_reminders")
    .select("*")
    .eq("user_id", userId)
    .eq("channel", channel)
    .eq("reason", candidate.reason)
    .eq("source_key", candidate.sourceKey)
    .maybeSingle();
  if (existing.error || !existing.data) {
    throw inserted.error ?? existing.error ?? new Error("Could not schedule reminder");
  }
  return existing.data;
}

export async function claimDueEmailReminders(
  admin: SupabaseClient,
  now: Date,
  limit = 50,
): Promise<JourneyReminder[]> {
  const { data, error } = await admin.rpc("claim_due_journey_reminders", {
    p_limit: clampReminderClaimLimit(limit),
    p_now: now.toISOString(),
  });
  if (error) throw error;
  return (data ?? []).map((row: Record<string, unknown>) => mapReminderRow(row));
}

async function updateProcessingReminder(
  admin: SupabaseClient,
  id: string,
  payload: Record<string, unknown>,
) {
  const { error } = await admin
    .from("journey_reminders")
    .update(payload)
    .eq("id", id)
    .eq("status", "processing");
  if (error) throw error;
}

export async function markReminderSent(
  admin: SupabaseClient,
  id: string,
  providerReference: string,
  now = new Date(),
) {
  const nowIso = now.toISOString();
  await updateProcessingReminder(admin, id, {
    status: "sent",
    sent_at: nowIso,
    provider_reference: providerReference,
    claimed_at: null,
    last_error: null,
    updated_at: nowIso,
  });
}

export async function markReminderSuppressed(
  admin: SupabaseClient,
  id: string,
  reason: string,
  now = new Date(),
) {
  const nowIso = now.toISOString();
  await updateProcessingReminder(admin, id, {
    status: "suppressed",
    suppression_reason: reason,
    claimed_at: null,
    updated_at: nowIso,
  });
}

export async function releaseReminderAfterFailure(
  admin: SupabaseClient,
  id: string,
  attemptCount: number,
  reason: string,
  now = new Date(),
) {
  const nowIso = now.toISOString();
  if (attemptCount < 3) {
    await updateProcessingReminder(admin, id, {
      status: "scheduled",
      due_at: new Date(now.getTime() + 86_400_000).toISOString(),
      claimed_at: null,
      last_error: reason,
      updated_at: nowIso,
    });
    return;
  }

  await updateProcessingReminder(admin, id, {
    status: "failed",
    claimed_at: null,
    last_error: reason,
    updated_at: nowIso,
  });
}
