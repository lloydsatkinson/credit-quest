import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminUser } from "@/lib/server/admin-auth";
import { upsertCommercialPartner } from "@/lib/server/admin-repository";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export const partnerSchema = z.object({
  id: z.string().uuid().nullable().optional(),
  partnerKey: z.string().regex(/^[a-z0-9-]+$/),
  displayName: z.string().min(1).max(120),
  enabled: z.boolean(),
  sandboxEnabled: z.boolean(),
  liveEnabled: z.boolean(),
  notes: z.string().max(1000).nullable(),
}).strict();

export async function POST(request: Request) {
  const adminUser = await requireAdminUser();
  const parsed = partnerSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid partner configuration" }, { status: 400 });
  if (parsed.data.liveEnabled && process.env.LIVE_CREDIT_REFERRALS_ALLOWED !== "true") {
    return NextResponse.json({ error: "Live credit referrals are locked pending regulatory clearance." }, { status: 409 });
  }
  const id = await upsertCommercialPartner(createAdminSupabaseClient(), adminUser.id, parsed.data);
  return NextResponse.json({ id });
}
