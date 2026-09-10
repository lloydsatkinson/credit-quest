import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminUser } from "@/lib/server/admin-auth";
import { retireRecoveryPolicyVersion } from "@/lib/server/recovery-policy-retirement";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export const recoveryPolicyRetireSchema = z.object({
  policyId: z.string().uuid(),
}).strict();

export async function POST(request: Request) {
  const adminUser = await requireAdminUser();
  const parsed = recoveryPolicyRetireSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid recovery policy retirement request" }, { status: 400 });

  try {
    const result = await retireRecoveryPolicyVersion(
      createAdminSupabaseClient(),
      adminUser.id,
      parsed.data.policyId,
    );
    return NextResponse.json({ result });
  } catch (error) {
    if (error instanceof Error && /(published_recovery_policy_version_not_found|recovery_policy_retire_failed)/i.test(error.message)) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    throw error;
  }
}
