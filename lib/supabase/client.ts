"use client";

import { createBrowserClient } from "@supabase/ssr";
import { getSupabasePublicEnv } from "@/lib/supabase/env";

export function createBrowserSupabaseClient() {
  const env = getSupabasePublicEnv();
  if (!env) throw new Error("Supabase browser environment is not configured");
  return createBrowserClient(env.url, env.anonKey);
}
