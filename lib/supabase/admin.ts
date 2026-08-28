import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseServiceEnv } from "@/lib/supabase/env";

export function createAdminSupabaseClient() {
  const env = getSupabaseServiceEnv();
  if (!env) throw new Error("Supabase service environment is not configured");

  return createClient(env.url, env.serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
