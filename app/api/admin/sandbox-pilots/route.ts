import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminUser } from "@/lib/server/admin-auth";
import { setSandboxPilot } from "@/lib/server/sandbox-pilot-repository";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export const sandboxPilotSchema = z.object({
  userId: z.string().uuid(),
  enabled: z.boolean(),
}).strict();

export async function POST(request: Request) {
  const adminUser = await requireAdminUser();
  const parsed = sandboxPilotSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid sandbox pilot request" }, { status: 400 });
  }

  await setSandboxPilot(
    createAdminSupabaseClient(),
    adminUser.id,
    parsed.data.userId,
    parsed.data.enabled,
  );
  return NextResponse.json({ ok: true });
}
