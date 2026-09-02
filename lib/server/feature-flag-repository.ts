import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export type RuntimeFlagKey =
  | "email_reminders_enabled"
  | "commercial_gateway_enabled"
  | "commercial_sandbox_enabled";

export async function isFeatureEnabled(
  admin: SupabaseClient,
  flagKey: RuntimeFlagKey,
): Promise<boolean> {
  try {
    const { data, error } = await admin
      .from("feature_flags")
      .select("enabled")
      .eq("flag_key", flagKey)
      .maybeSingle();
    return !error && data?.enabled === true;
  } catch {
    return false;
  }
}
