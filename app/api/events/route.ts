import { NextResponse } from "next/server";
import { eventPayloadSchema } from "@/lib/events";
import { getSupabasePublicEnv } from "@/lib/supabase/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const parsed = eventPayloadSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid event" }, { status: 400 });

  const env = getSupabasePublicEnv();
  if (!env) return new NextResponse(null, { status: 204 });

  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const { error } = await supabase.from("events").insert({
    user_id: user.id,
    event_name: parsed.data.name,
    metadata: parsed.data.metadata ?? {},
  });
  if (error) return NextResponse.json({ error: "Could not record event" }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
