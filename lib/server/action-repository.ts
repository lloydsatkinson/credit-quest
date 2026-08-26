import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ActionAttempt,
  ActionAttemptStatus,
  ActionDefinition,
  ProviderDefinition,
} from "@/lib/domain/types";

function mapProviderRow(row: Record<string, unknown>): ProviderDefinition {
  return {
    id: String(row.id),
    slug: String(row.slug),
    displayName: String(row.display_name),
    providerType: row.provider_type as ProviderDefinition["providerType"],
    allowedHosts: Array.isArray(row.allowed_hosts) ? row.allowed_hosts.map(String) : [],
    active: Boolean(row.active),
  };
}

function mapActionRow(row: Record<string, unknown>): ActionDefinition {
  return {
    id: String(row.id),
    actionKey: String(row.action_key),
    missionSlug: String(row.mission_slug),
    providerId: row.provider_id ? String(row.provider_id) : null,
    accountType: row.account_type as ActionDefinition["accountType"],
    mode: row.action_mode as ActionDefinition["mode"],
    destinationUrl: row.destination_url ? String(row.destination_url) : null,
    instructions: String(row.instructions),
    verificationMode: row.verification_mode as ActionDefinition["verificationMode"],
    safeModeAllowed: Boolean(row.safe_mode_allowed),
    minAge: row.min_age === null || row.min_age === undefined ? null : Number(row.min_age),
    priority: Number(row.priority ?? 100),
    active: Boolean(row.active),
  };
}

function mapAttemptRow(row: Record<string, unknown>): ActionAttempt {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    missionInstanceId: String(row.mission_instance_id),
    actionRegistryId: String(row.action_registry_id),
    accountId: row.account_id ? String(row.account_id) : null,
    status: row.status as ActionAttemptStatus,
    startedAt: String(row.started_at),
    returnedAt: row.returned_at ? String(row.returned_at) : null,
    selfConfirmedAt: row.self_confirmed_at ? String(row.self_confirmed_at) : null,
    verifiedAt: row.verified_at ? String(row.verified_at) : null,
    nextReviewAt: row.next_review_at ? String(row.next_review_at) : null,
  };
}

export async function listProviders(supabase: SupabaseClient): Promise<ProviderDefinition[]> {
  const { data, error } = await supabase.from("providers").select("*").eq("active", true).order("display_name");
  if (error) throw error;
  return (data ?? []).map((row) => mapProviderRow(row as Record<string, unknown>));
}

export async function getProviderById(
  supabase: SupabaseClient,
  id: string | null,
): Promise<ProviderDefinition | null> {
  if (!id) return null;
  const { data, error } = await supabase.from("providers").select("*").eq("id", id).eq("active", true).maybeSingle();
  if (error) throw error;
  return data ? mapProviderRow(data as Record<string, unknown>) : null;
}

export async function listActiveActions(
  supabase: SupabaseClient,
  missionSlug: string,
): Promise<ActionDefinition[]> {
  const { data, error } = await supabase
    .from("action_registry")
    .select("*")
    .eq("mission_slug", missionSlug)
    .eq("active", true)
    .order("priority", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => mapActionRow(row as Record<string, unknown>));
}

export async function getActionDefinition(
  supabase: SupabaseClient,
  id: string,
): Promise<ActionDefinition | null> {
  const { data, error } = await supabase.from("action_registry").select("*").eq("id", id).eq("active", true).maybeSingle();
  if (error) throw error;
  return data ? mapActionRow(data as Record<string, unknown>) : null;
}

export async function createActionAttempt(
  supabase: SupabaseClient,
  input: {
    userId: string;
    missionInstanceId: string;
    actionRegistryId: string;
    accountId: string | null;
    metadata?: Record<string, unknown>;
  },
): Promise<ActionAttempt> {
  const { data, error } = await supabase
    .from("action_attempts")
    .insert({
      user_id: input.userId,
      mission_instance_id: input.missionInstanceId,
      action_registry_id: input.actionRegistryId,
      account_id: input.accountId,
      status: "started",
      metadata: input.metadata ?? {},
    })
    .select("*")
    .single();
  if (error) throw error;
  return mapAttemptRow(data as Record<string, unknown>);
}

export async function getActionAttempt(
  supabase: SupabaseClient,
  userId: string,
  id: string,
): Promise<ActionAttempt | null> {
  const { data, error } = await supabase
    .from("action_attempts")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data ? mapAttemptRow(data as Record<string, unknown>) : null;
}

export async function listPendingActionAttempts(
  supabase: SupabaseClient,
  userId: string,
): Promise<ActionAttempt[]> {
  const { data, error } = await supabase
    .from("action_attempts")
    .select("*")
    .eq("user_id", userId)
    .in("status", ["started", "returned", "submitted"])
    .order("started_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => mapAttemptRow(row as Record<string, unknown>));
}

export async function updateActionAttempt(
  supabase: SupabaseClient,
  userId: string,
  id: string,
  patch: Partial<{
    status: ActionAttemptStatus;
    returnedAt: string | null;
    selfConfirmedAt: string | null;
    verifiedAt: string | null;
    nextReviewAt: string | null;
  }>,
): Promise<ActionAttempt | null> {
  const update: Record<string, unknown> = {};
  if ("status" in patch) update.status = patch.status;
  if ("returnedAt" in patch) update.returned_at = patch.returnedAt;
  if ("selfConfirmedAt" in patch) update.self_confirmed_at = patch.selfConfirmedAt;
  if ("verifiedAt" in patch) update.verified_at = patch.verifiedAt;
  if ("nextReviewAt" in patch) update.next_review_at = patch.nextReviewAt;

  const { data, error } = await supabase
    .from("action_attempts")
    .update(update)
    .eq("id", id)
    .eq("user_id", userId)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return data ? mapAttemptRow(data as Record<string, unknown>) : null;
}
