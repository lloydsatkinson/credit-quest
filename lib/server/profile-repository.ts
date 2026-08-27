import type { SupabaseClient } from "@supabase/supabase-js";
import type { CreditProfile } from "@/lib/domain/types";

export function mapProfileRow(row: Record<string, unknown>): CreditProfile {
  return {
    userId: String(row.user_id),
    dateOfBirth: String(row.date_of_birth),
    employmentStatus: row.employment_status as CreditProfile["employmentStatus"],
    incomeBand: row.income_band as CreditProfile["incomeBand"],
    housingStatus: row.housing_status as CreditProfile["housingStatus"],
    electoralRoll: row.electoral_roll as boolean | null,
    utilisationPct: row.utilisation_pct === null || row.utilisation_pct === undefined ? null : Number(row.utilisation_pct),
    missedPaymentsLast12m: row.missed_payments_last_12m as number | null,
    hardApplicationsLast6m: row.hard_applications_last_6m as number | null,
    hasRevolvingCredit: row.has_revolving_credit as boolean | null,
    hasDirectDebitForCredit: row.has_direct_debit_for_credit as boolean | null,
  };
}

export async function getUserProfile(supabase: SupabaseClient, userId: string): Promise<CreditProfile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data ? mapProfileRow(data as Record<string, unknown>) : null;
}

export async function updateUserProfile(
  supabase: SupabaseClient,
  userId: string,
  patch: Partial<Pick<CreditProfile, "electoralRoll" | "hasDirectDebitForCredit" | "hasRevolvingCredit" | "utilisationPct">>,
  now = new Date(),
): Promise<void> {
  const update: Record<string, unknown> = { updated_at: now.toISOString() };
  if ("electoralRoll" in patch) update.electoral_roll = patch.electoralRoll;
  if ("hasDirectDebitForCredit" in patch) update.has_direct_debit_for_credit = patch.hasDirectDebitForCredit;
  if ("hasRevolvingCredit" in patch) update.has_revolving_credit = patch.hasRevolvingCredit;
  if ("utilisationPct" in patch) update.utilisation_pct = patch.utilisationPct;

  const { error } = await supabase.from("profiles").update(update).eq("user_id", userId);
  if (error) throw error;
}
