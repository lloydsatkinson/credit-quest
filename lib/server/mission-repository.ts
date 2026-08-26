import type { SupabaseClient } from "@supabase/supabase-js";
import type { MissionInstance, MissionState } from "@/lib/domain/types";

export function mapMissionRow(row: Record<string, unknown>): MissionInstance {
  const subjectType = String(row.subject_type ?? "profile");
  return {
    id: String(row.id),
    userId: String(row.user_id),
    missionSlug: String(row.mission_slug),
    subject: subjectType === "account"
      ? { kind: "account", accountId: String(row.subject_id) }
      : { kind: "profile" },
    state: row.state as MissionState,
    startedAt: row.started_at ? String(row.started_at) : null,
    completedAt: row.completed_at ? String(row.completed_at) : null,
    nextReviewAt: row.next_review_at ? String(row.next_review_at) : null,
  };
}

export async function listMissionInstances(supabase: SupabaseClient, userId: string): Promise<MissionInstance[]> {
  const { data, error } = await supabase
    .from("user_missions")
    .select("id,user_id,mission_slug,subject_type,subject_id,state,started_at,completed_at,next_review_at")
    .eq("user_id", userId);
  if (error) throw error;
  return (data ?? []).map((row) => mapMissionRow(row as Record<string, unknown>));
}

export async function getMissionInstance(
  supabase: SupabaseClient,
  userId: string,
  id: string,
): Promise<MissionInstance | null> {
  const { data, error } = await supabase
    .from("user_missions")
    .select("id,user_id,mission_slug,subject_type,subject_id,state,started_at,completed_at,next_review_at")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data ? mapMissionRow(data as Record<string, unknown>) : null;
}

export async function upsertMissionInstance(
  supabase: SupabaseClient,
  instance: MissionInstance,
): Promise<MissionInstance> {
  const payload = {
    id: instance.id.startsWith("local:") ? undefined : instance.id,
    user_id: instance.userId,
    mission_slug: instance.missionSlug,
    subject_type: instance.subject.kind,
    subject_id: instance.subject.kind === "account" ? instance.subject.accountId : null,
    state: instance.state,
    started_at: instance.startedAt,
    completed_at: instance.completedAt,
    next_review_at: instance.nextReviewAt,
    updated_at: new Date().toISOString(),
  };

  let query = supabase.from("user_missions").upsert(payload, {
    onConflict: instance.subject.kind === "profile"
      ? "user_id,mission_slug"
      : "user_id,mission_slug,subject_id",
  });

  const { data, error } = await query
    .select("id,user_id,mission_slug,subject_type,subject_id,state,started_at,completed_at,next_review_at")
    .single();
  if (error) throw error;
  return mapMissionRow(data as Record<string, unknown>);
}

export async function updateMissionInstanceState(
  supabase: SupabaseClient,
  userId: string,
  id: string,
  patch: Partial<Pick<MissionInstance, "state" | "startedAt" | "completedAt" | "nextReviewAt">>,
): Promise<MissionInstance | null> {
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if ("state" in patch) update.state = patch.state;
  if ("startedAt" in patch) update.started_at = patch.startedAt;
  if ("completedAt" in patch) update.completed_at = patch.completedAt;
  if ("nextReviewAt" in patch) update.next_review_at = patch.nextReviewAt;

  const { data, error } = await supabase
    .from("user_missions")
    .update(update)
    .eq("id", id)
    .eq("user_id", userId)
    .select("id,user_id,mission_slug,subject_type,subject_id,state,started_at,completed_at,next_review_at")
    .maybeSingle();
  if (error) throw error;
  return data ? mapMissionRow(data as Record<string, unknown>) : null;
}
