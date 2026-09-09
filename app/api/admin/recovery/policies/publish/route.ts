import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminUser } from "@/lib/server/admin-auth";
import { publishValidatedRecoveryPolicyVersion } from "@/lib/server/decline-policy-repository";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export const recoveryPolicyPublishSchema = z.object({
  draftId: z.string().uuid(),
}).strict();

export async function POST(request: Request) {
  const adminUser = await requireAdminUser();
  const parsed = recoveryPolicyPublishSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid recovery policy publish request" }, { status: 400 });
  try {
    const result = await publishValidatedRecoveryPolicyVersion(
      createAdminSupabaseClient(),
      adminUser.id,
      parsed.data.draftId,
    );
    return NextResponse.json({ result });
  } catch (error) {
    if (error instanceof Error && /(unknown_canonical|customer_copy|invalid_condition|ambiguous_mapping|publish_state|not_found|template_treatment)/i.test(error.message)) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    throw error;
  }
}
