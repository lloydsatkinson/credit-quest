import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export const SANDBOX_PILOT_METADATA_KEY = "credit_quest_sandbox_pilot";

export async function isSandboxPilot(admin: SupabaseClient, userId: string): Promise<boolean> {
  try {
    const { data, error } = await admin.auth.admin.getUserById(userId);
    if (error || !data.user) return false;
    return data.user.app_metadata?.[SANDBOX_PILOT_METADATA_KEY] === true;
  } catch {
    return false;
  }
}
