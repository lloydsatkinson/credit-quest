import type { SupabaseClient } from "@supabase/supabase-js";
import { deriveAccountProfileSignals } from "@/lib/domain/account-missions";
import type { CreditProfile } from "@/lib/domain/types";
import { listUserAccounts } from "@/lib/server/account-repository";
import { updateUserProfile } from "@/lib/server/profile-repository";

export async function syncTrackedAccountProfileSignals(
  supabase: SupabaseClient,
  userId: string,
  now = new Date(),
): Promise<Partial<Pick<CreditProfile, "utilisationPct" | "hasDirectDebitForCredit" | "hasRevolvingCredit">>> {
  const accounts = await listUserAccounts(supabase, userId);
  const patch = deriveAccountProfileSignals(accounts);
  if (Object.keys(patch).length > 0) {
    await updateUserProfile(supabase, userId, patch, now);
  }
  return patch;
}
