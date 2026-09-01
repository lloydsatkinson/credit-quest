import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminUser } from "@/lib/server/admin-auth";
import { setFeatureFlag } from "@/lib/server/admin-repository";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export const flagSchema = z.object({
  flagKey: z.enum(["email_reminders_enabled", "commercial_gateway_enabled"]),
  enabled: z.boolean(),
}).strict();

export async function POST(request: Request) {
  const adminUser = await requireAdminUser();
  const parsed = flagSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid feature flag request" }, { status: 400 });
  await setFeatureFlag(createAdminSupabaseClient(), adminUser.id, parsed.data.flagKey, parsed.data.enabled);
  return NextResponse.json({ ok: true });
}
