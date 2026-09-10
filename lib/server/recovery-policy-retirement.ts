import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface RetiredRecoveryPolicyVersion {
  kind: string;
  id: string;
  version: number;
  lifecycle: "retired";
}

export async function retireRecoveryPolicyVersion(
  admin: SupabaseClient,
  adminUserId: string,
  policyId: string,
): Promise<RetiredRecoveryPolicyVersion> {
  const { data, error } = await admin.rpc("admin_retire_recovery_policy_version", {
    p_admin_user_id: adminUserId,
    p_policy_id: policyId,
  });
  if (error) throw error;

  const row = data as Record<string, unknown> | null;
  if (!row || row.lifecycle !== "retired") throw new Error("recovery_policy_retire_failed");
  return {
    kind: String(row.kind),
    id: String(row.id),
    version: Number(row.version),
    lifecycle: "retired",
  };
}
