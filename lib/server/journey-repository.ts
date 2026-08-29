import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  JourneyOutcome,
  JourneyOutcomeInput,
  JourneyState,
} from "@/lib/journey/types";

export function mapJourneyStateRow(row: Record<string, unknown>): JourneyState {
  return {
    userId: String(row.user_id),
    stage: row.stage as JourneyState["stage"],
    activeMissionId: row.active_mission_id ? String(row.active_mission_id) : null,
    nextReassessmentAt: row.next_reassessment_at ? String(row.next_reassessment_at) : null,
    lastReassessedAt: row.last_reassessed_at ? String(row.last_reassessed_at) : null,
    lastReadinessBand: (row.last_readiness_band ?? null) as JourneyState["lastReadinessBand"],
    updatedAt: String(row.updated_at),
  };
}

export function mapJourneyOutcomeRow(row: Record<string, unknown>): JourneyOutcome {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    eventType: row.event_type as JourneyOutcome["eventType"],
    source: row.source as JourneyOutcome["source"],
    sourceKey: String(row.source_key),
    missionInstanceId: row.mission_instance_id ? String(row.mission_instance_id) : null,
    readinessBefore: (row.readiness_before ?? null) as JourneyOutcome["readinessBefore"],
    readinessAfter: (row.readiness_after ?? null) as JourneyOutcome["readinessAfter"],
    metadata: (row.metadata ?? {}) as Record<string, unknown>,
    occurredAt: String(row.occurred_at),
  };
}

export async function getJourneyState(
  supabase: SupabaseClient,
  userId: string,
): Promise<JourneyState | null> {
  const { data, error } = await supabase
    .from("journey_state")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data ? mapJourneyStateRow(data as Record<string, unknown>) : null;
}

export async function listRecentJourneyOutcomes(
  supabase: SupabaseClient,
  userId: string,
  limit = 20,
): Promise<JourneyOutcome[]> {
  const safeLimit = Math.max(1, Math.min(100, limit));
  const { data, error } = await supabase
    .from("journey_outcomes")
    .select("*")
    .eq("user_id", userId)
    .order("occurred_at", { ascending: false })
    .limit(safeLimit);
  if (error) throw error;
  return (data ?? []).map((row) => mapJourneyOutcomeRow(row as Record<string, unknown>));
}

export async function upsertJourneyState(
  admin: SupabaseClient,
  state: JourneyState,
): Promise<JourneyState> {
  const { data, error } = await admin
    .from("journey_state")
    .upsert({
      user_id: state.userId,
      stage: state.stage,
      active_mission_id: state.activeMissionId,
      next_reassessment_at: state.nextReassessmentAt,
      last_reassessed_at: state.lastReassessedAt,
      last_readiness_band: state.lastReadinessBand,
      updated_at: state.updatedAt,
    })
    .select("*")
    .single();
  if (error) throw error;
  return mapJourneyStateRow(data as Record<string, unknown>);
}

export async function appendJourneyOutcome(
  admin: SupabaseClient,
  input: JourneyOutcomeInput,
): Promise<JourneyOutcome> {
  const payload = {
    user_id: input.userId,
    event_type: input.eventType,
    source: input.source,
    source_key: input.sourceKey,
    mission_instance_id: input.missionInstanceId ?? null,
    readiness_before: input.readinessBefore ?? null,
    readiness_after: input.readinessAfter ?? null,
    metadata: input.metadata ?? {},
    occurred_at: input.occurredAt,
  };

  const inserted = await admin
    .from("journey_outcomes")
    .insert(payload)
    .select("*")
    .maybeSingle();

  if (!inserted.error && inserted.data) {
    return mapJourneyOutcomeRow(inserted.data as Record<string, unknown>);
  }

  const existing = await admin
    .from("journey_outcomes")
    .select("*")
    .eq("user_id", input.userId)
    .eq("source_key", input.sourceKey)
    .maybeSingle();

  if (!existing.error && existing.data) {
    return mapJourneyOutcomeRow(existing.data as Record<string, unknown>);
  }

  throw inserted.error ?? existing.error ?? new Error("Could not append Journey outcome");
}
