import type { SupabaseClient } from "@supabase/supabase-js";
import { buildMissionInstances, calculateAccountUtilisation } from "@/lib/domain/account-missions";
import type { CreditProfile, MissionInstance, MissionState, UserAccount } from "@/lib/domain/types";

const MISSION_SELECT = "id,user_id,mission_slug,subject_type,subject_id,state,started_at,completed_at,next_review_at";
const TERMINAL_STATES: MissionState[] = ["completed", "dismissed", "no_longer_eligible"];

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

function missionKey(instance: MissionInstance): string {
  return `${instance.missionSlug}:${instance.subject.kind === "profile" ? "profile" : instance.subject.accountId}`;
}

export function mergeMissionSyncResults(
  existing: MissionInstance[],
  synced: MissionInstance[],
): MissionInstance[] {
  const byId = new Map(existing.map((instance) => [instance.id, instance]));
  for (const instance of synced) byId.set(instance.id, instance);
  return [...byId.values()];
}

export function shouldMarkNoLongerEligible(
  instance: MissionInstance,
  profile: CreditProfile,
  accounts: UserAccount[],
): boolean {
  if (TERMINAL_STATES.includes(instance.state)) return false;

  if (instance.subject.kind === "profile") {
    switch (instance.missionSlug) {
      case "register-electoral-roll":
        return profile.electoralRoll === true;
      case "application-cooldown":
        return profile.hardApplicationsLast6m !== null && profile.hardApplicationsLast6m < 3;
      case "build-revolving-history":
        if (profile.hasRevolvingCredit === true) return true;
        return profile.missedPaymentsLast12m !== null && profile.missedPaymentsLast12m !== 0;
      default:
        return false;
    }
  }

  const accountId = instance.subject.accountId;
  const account = accounts.find((item) => item.id === accountId);
  if (!account || !account.active) return true;

  if (instance.missionSlug === "set-up-direct-debit") {
    return account.directDebitStatus === "yes";
  }

  if (instance.missionSlug === "reduce-utilisation") {
    const utilisation = calculateAccountUtilisation(account);
    return utilisation !== null && utilisation <= 30;
  }

  return false;
}

export async function listMissionInstances(supabase: SupabaseClient, userId: string): Promise<MissionInstance[]> {
  const { data, error } = await supabase
    .from("user_missions")
    .select(MISSION_SELECT)
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
    .select(MISSION_SELECT)
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data ? mapMissionRow(data as Record<string, unknown>) : null;
}

async function insertMissionInstance(
  supabase: SupabaseClient,
  instance: MissionInstance,
): Promise<MissionInstance> {
  const { data, error } = await supabase
    .from("user_missions")
    .insert({
      user_id: instance.userId,
      mission_slug: instance.missionSlug,
      subject_type: instance.subject.kind,
      subject_id: instance.subject.kind === "account" ? instance.subject.accountId : null,
      state: instance.state,
      started_at: instance.startedAt,
      completed_at: instance.completedAt,
      next_review_at: instance.nextReviewAt,
      updated_at: new Date().toISOString(),
    })
    .select(MISSION_SELECT)
    .single();
  if (error) throw error;
  return mapMissionRow(data as Record<string, unknown>);
}

export async function upsertMissionInstance(
  supabase: SupabaseClient,
  instance: MissionInstance,
): Promise<MissionInstance> {
  if (instance.id.startsWith("local:")) {
    return insertMissionInstance(supabase, instance);
  }

  const updated = await updateMissionInstanceState(supabase, instance.userId, instance.id, {
    state: instance.state,
    startedAt: instance.startedAt,
    completedAt: instance.completedAt,
    nextReviewAt: instance.nextReviewAt,
  });
  if (!updated) throw new Error("Mission instance not found");
  return updated;
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
    .select(MISSION_SELECT)
    .maybeSingle();
  if (error) throw error;
  return data ? mapMissionRow(data as Record<string, unknown>) : null;
}

export async function syncMissionInstances(
  supabase: SupabaseClient,
  profile: CreditProfile,
  accounts: UserAccount[],
  now = new Date(),
): Promise<MissionInstance[]> {
  const existing = await listMissionInstances(supabase, profile.userId);
  const desired = buildMissionInstances(profile, accounts, existing, now);
  const desiredKeys = new Set(desired.map(missionKey));
  const synced: MissionInstance[] = [];

  for (const instance of desired) {
    if (instance.id.startsWith("local:")) {
      synced.push(await insertMissionInstance(supabase, instance));
    } else {
      synced.push(instance);
    }
  }

  for (const instance of existing) {
    if (desiredKeys.has(missionKey(instance))) continue;
    if (!shouldMarkNoLongerEligible(instance, profile, accounts)) continue;
    const updated = await updateMissionInstanceState(supabase, profile.userId, instance.id, {
      state: "no_longer_eligible",
      nextReviewAt: null,
    });
    if (updated) synced.push(updated);
  }

  return mergeMissionSyncResults(existing, synced);
}
