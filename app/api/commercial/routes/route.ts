import { NextResponse } from "next/server";
import { getSupabasePublicEnv } from "@/lib/supabase/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { listPermittedCommercialRoutes } from "@/lib/server/commercial-gateway";

export async function GET() {
  if (!getSupabasePublicEnv()) {
    return NextResponse.json({ routes: [], mode: "demo" });
  }

  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const routes = await listPermittedCommercialRoutes({
    userId: user.id,
    environment: "sandbox",
    now: new Date(),
  }).catch(() => []);

  return NextResponse.json({ routes });
}
