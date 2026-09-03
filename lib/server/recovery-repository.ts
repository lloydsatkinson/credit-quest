import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { DeclineContext } from "@/lib/recovery/types";

export type RecentApplicationContext = "none" | "one" | "multiple" | "unknown";

export interface DirectRecoveryJourneyRecord {
  id: string;
  origin: "direct";
  productCategory: DeclineContext["productCategory"];
  declineReasonKnown: boolean;
  declineReasonCode: string | null;
  declineReasonSource: DeclineContext["reason"]["source"];
}

function mapDirectJourney(row: Record<string, unknown>): DirectRecoveryJourneyRecord {
  return {
    id: String(row.id),
    origin: "direct",
    productCategory: row.product_category as DeclineContext["productCategory"],
    declineReasonKnown: row.decline_reason_known === true,
    declineReasonCode: row.decline_reason_code ? String(row.decline_reason_code) : null,
    declineReasonSource: row.decline_reason_source as DeclineContext["reason"]["source"],
  };
}

export async function createDirectRecoveryJourney(
  admin: SupabaseClient,
  userId: string,
  context: DeclineContext,
  recentApplicationContext: RecentApplicationContext,
  now = new Date(),
): Promise<DirectRecoveryJourneyRecord> {
  if (context.origin !== "direct") {
    throw new Error("Direct recovery journeys require direct decline context");
  }

  // The broad recent-application answer is intentionally not written into an
  // unrelated trusted/core field. Task 7 will consume the current profile and
  // recovery context when projecting the recovery plan. Keeping it as an
  // explicit argument prevents it being mistaken for lender-supplied evidence.
  void recentApplicationContext;

  const nowIso = now.toISOString();
  const { data, error } = await admin
    .from("decline_recovery_journeys")
    .insert({
      user_id: userId,
      origin: "direct",
      product_category: context.productCategory,
      declined_at: context.declinedAt,
      provider_display_name: context.providerName,
      decline_reason_known: context.reason.known,
      decline_reason_code: context.reason.code,
      decline_reason_source: context.reason.source,
      context_confirmation: "confirmed",
      stage: "intake",
      return_eligibility_state: "not_assessed",
      started_at: nowIso,
      updated_at: nowIso,
    })
    .select("id, origin, product_category, decline_reason_known, decline_reason_code, decline_reason_source")
    .single();

  if (error) throw error;
  return mapDirectJourney(data as Record<string, unknown>);
}
