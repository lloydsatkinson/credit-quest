import { NextResponse } from "next/server";
import { z } from "zod";
import {
  getCommunicationPreference,
  setJourneyEmailPreference,
} from "@/lib/server/reminder-repository";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getSupabasePublicEnv } from "@/lib/supabase/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const journeyEmailPreferenceSchema = z.object({
  journeyEmailEnabled: z.boolean(),
}).strict();

export async function GET() {
  if (!getSupabasePublicEnv()) {
    return NextResponse.json({
      mode: "demo",
      journeyEmailEnabled: false,
      persisted: false,
    });
  }

  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const preference = await getCommunicationPreference(supabase, user.id).catch(() => null);
  return NextResponse.json({
    journeyEmailEnabled: preference?.journeyEmailEnabled === true,
    persisted: preference !== null,
  });
}

export async function PATCH(request: Request) {
  const parsed = journeyEmailPreferenceSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid communication preference" },
      { status: 400 },
    );
  }

  if (!getSupabasePublicEnv()) {
    return NextResponse.json({
      mode: "demo",
      journeyEmailEnabled: parsed.data.journeyEmailEnabled,
      persisted: false,
    });
  }

  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const admin = createAdminSupabaseClient();
  await setJourneyEmailPreference(
    admin,
    user.id,
    parsed.data.journeyEmailEnabled,
    new Date(),
  );

  return NextResponse.json({
    journeyEmailEnabled: parsed.data.journeyEmailEnabled,
    persisted: true,
  });
}
