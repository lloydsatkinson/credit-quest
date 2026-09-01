import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminUser } from "@/lib/server/admin-auth";
import { upsertCommercialRoute } from "@/lib/server/admin-repository";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export const routeSchema = z.object({
  id: z.string().uuid().nullable().optional(),
  routeKey: z.string().regex(/^[a-z0-9-]+$/),
  partnerId: z.string().uuid(),
  environment: z.enum(["sandbox", "live"]),
  destinationUrl: z.string().min(1).max(2048),
  enabled: z.boolean(),
  disclosureKey: z.string().regex(/^[a-z0-9-]+$/),
}).strict();

export async function POST(request: Request) {
  const adminUser = await requireAdminUser();
  const parsed = routeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid route configuration" }, { status: 400 });
  if (parsed.data.environment === "live" && parsed.data.enabled && process.env.LIVE_CREDIT_REFERRALS_ALLOWED !== "true") {
    return NextResponse.json({ error: "Live credit referrals are locked pending regulatory clearance." }, { status: 409 });
  }
  const id = await upsertCommercialRoute(createAdminSupabaseClient(), adminUser.id, {
    routeId: parsed.data.id ?? null,
    routeKey: parsed.data.routeKey,
    partnerId: parsed.data.partnerId,
    environment: parsed.data.environment,
    destinationUrl: parsed.data.destinationUrl,
    enabled: parsed.data.enabled,
    disclosureKey: parsed.data.disclosureKey,
  });
  return NextResponse.json({ id });
}
