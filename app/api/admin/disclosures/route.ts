import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminUser } from "@/lib/server/admin-auth";
import { publishCommercialDisclosure } from "@/lib/server/admin-repository";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export const disclosurePublishSchema = z.object({
  disclosureId: z.string().uuid(),
}).strict();

export async function POST(request: Request) {
  const adminUser = await requireAdminUser();
  const parsed = disclosurePublishSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid disclosure publish request" }, { status: 400 });
  const disclosure = await publishCommercialDisclosure(
    createAdminSupabaseClient(),
    adminUser.id,
    parsed.data.disclosureId,
  );
  return NextResponse.json({ disclosure });
}
