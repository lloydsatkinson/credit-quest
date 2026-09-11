import { NextResponse } from "next/server";
import { runAdminAuthDiagnostic } from "@/lib/server/admin-auth-diagnostic";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getSupabasePublicEnv } from "@/lib/supabase/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const EXPECTED_SUPABASE_HOST = "kcgghgziyfcamrxkudwe.supabase.co";

export const dynamic = "force-dynamic";

export async function GET() {
  const publicEnv = getSupabasePublicEnv();
  const result = await runAdminAuthDiagnostic({
    expectedProjectHost: EXPECTED_SUPABASE_HOST,
    publicEnvUrl: publicEnv?.url ?? null,
    serviceCredentialPresent: Boolean(
      process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
    ),
    async probeServiceAdminTable() {
      const admin = createAdminSupabaseClient();
      const { error } = await admin.from("admin_members").select("role").limit(1);
      if (error) throw error;
      return true;
    },
    async getAuthenticatedUser() {
      const supabase = await createServerSupabaseClient();
      const { data, error } = await supabase.auth.getUser();
      if (error) throw error;
      return data.user ? { id: data.user.id } : null;
    },
    async getAdminMembership(userId: string) {
      const admin = createAdminSupabaseClient();
      const { data, error } = await admin
        .from("admin_members")
        .select("user_id")
        .eq("user_id", userId)
        .eq("role", "admin")
        .maybeSingle();
      if (error) throw error;
      return Boolean(data);
    },
  });

  return NextResponse.json(result, {
    headers: {
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
