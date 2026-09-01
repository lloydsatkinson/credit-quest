import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CommercialEnvironment } from "@/lib/commercial/types";

export type AdminEditableFeatureFlag = "email_reminders_enabled" | "commercial_gateway_enabled";

export interface AdminCommercialRouteInput {
  routeId?: string | null;
  routeKey: string;
  partnerId: string;
  environment: CommercialEnvironment;
  destinationUrl: string;
  enabled: boolean;
  disclosureKey: string;
}

export interface AdminCommercialPartnerInput {
  id?: string | null;
  partnerKey: string;
  displayName: string;
  enabled: boolean;
  sandboxEnabled: boolean;
  liveEnabled: boolean;
  notes: string | null;
}

export interface AdminExperimentInput {
  experimentId?: string | null;
  experimentKey: string;
  status: "draft" | "active" | "paused" | "ended";
  surfaceKey: string;
  variants: unknown;
}

function assertEditableFlag(flagKey: string): asserts flagKey is AdminEditableFeatureFlag {
  if (flagKey !== "email_reminders_enabled" && flagKey !== "commercial_gateway_enabled") {
    throw new Error("Feature flag is not admin-editable");
  }
}

export async function setFeatureFlag(admin: SupabaseClient, adminUserId: string, flagKey: AdminEditableFeatureFlag, enabled: boolean) {
  assertEditableFlag(flagKey);
  const { error } = await admin.rpc("admin_set_feature_flag", {
    p_admin_user_id: adminUserId,
    p_flag_key: flagKey,
    p_enabled: enabled,
  });
  if (error) throw error;
}

export async function upsertCommercialRoute(admin: SupabaseClient, adminUserId: string, input: AdminCommercialRouteInput) {
  const { data, error } = await admin.rpc("admin_upsert_commercial_route", {
    p_admin_user_id: adminUserId,
    p_route_id: input.routeId ?? null,
    p_route_key: input.routeKey,
    p_partner_id: input.partnerId,
    p_environment: input.environment,
    p_destination_url: input.destinationUrl,
    p_enabled: input.enabled,
    p_disclosure_key: input.disclosureKey,
  });
  if (error) throw error;
  return String(data);
}

export async function publishCommercialDisclosure(admin: SupabaseClient, adminUserId: string, disclosureId: string) {
  const { data, error } = await admin.rpc("admin_publish_commercial_disclosure", {
    p_admin_user_id: adminUserId,
    p_disclosure_id: disclosureId,
  });
  if (error) throw error;
  return data;
}

export async function upsertCommercialPartner(admin: SupabaseClient, adminUserId: string, input: AdminCommercialPartnerInput) {
  const { data, error } = await admin.rpc("admin_upsert_commercial_partner", {
    p_admin_user_id: adminUserId,
    p_partner_id: input.id ?? null,
    p_partner_key: input.partnerKey,
    p_display_name: input.displayName,
    p_enabled: input.enabled,
    p_sandbox_enabled: input.sandboxEnabled,
    p_live_enabled: input.liveEnabled,
    p_notes: input.notes,
  });
  if (error) throw error;
  return String(data);
}

export async function upsertExperiment(admin: SupabaseClient, adminUserId: string, input: AdminExperimentInput) {
  const { data, error } = await admin.rpc("admin_upsert_experiment", {
    p_admin_user_id: adminUserId,
    p_experiment_id: input.experimentId ?? null,
    p_experiment_key: input.experimentKey,
    p_status: input.status,
    p_surface_key: input.surfaceKey,
    p_variants: input.variants,
  });
  if (error) throw error;
  return String(data);
}

export async function listCommercialPartners(admin: SupabaseClient) {
  const { data, error } = await admin.from("commercial_partners").select("*").order("partner_key", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function listAdminCommercialRoutes(admin: SupabaseClient) {
  const { data, error } = await admin.from("commercial_routes").select("*").order("route_key", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function listCommercialDisclosures(admin: SupabaseClient) {
  const { data, error } = await admin.from("commercial_disclosures").select("*").order("disclosure_key", { ascending: true }).order("version", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function listFeatureFlags(admin: SupabaseClient) {
  const { data, error } = await admin.from("feature_flags").select("flag_key,enabled,updated_at").in("flag_key", ["email_reminders_enabled", "commercial_gateway_enabled"]);
  if (error) throw error;
  return data ?? [];
}

export async function listExperiments(admin: SupabaseClient) {
  const { data, error } = await admin.from("experiments").select("*").order("experiment_key", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function listAdminAudit(admin: SupabaseClient, limit = 50) {
  const safeLimit = Math.max(1, Math.min(100, Math.trunc(limit) || 50));
  const { data, error } = await admin.from("admin_audit_log").select("*").order("occurred_at", { ascending: false }).limit(safeLimit);
  if (error) throw error;
  return data ?? [];
}
