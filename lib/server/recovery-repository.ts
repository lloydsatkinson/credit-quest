import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { RecoveryPlanProjection, RecoveryStage } from "@/lib/recovery/plan";
import type { DeclineContext, RecoveryReadinessState } from "@/lib/recovery/types";
import type { PartnerHandoffSession } from "@/lib/server/partner-intake-repository";

export type RecentApplicationContext = "none" | "one" | "multiple" | "unknown";

export interface DirectRecoveryJourneyRecord {
  id: string;
  origin: "direct";
  productCategory: DeclineContext["productCategory"];
  declineReasonKnown: boolean;
  declineReasonCode: string | null;
  declineReasonSource: DeclineContext["reason"]["source"];
}

export interface PartnerContextReviewResult {
  declineReasonKnown: boolean;
  declineReasonCode: string | null;
  declineReasonSource: "partner" | "customer" | "unknown";
  contextConfirmation: "confirmed" | "corrected" | "unknown" | "optional_use_declined";
}

export interface PartnerRecoveryJourneyRecord {
  id: string;
  origin: "partner";
  productCategory: PartnerHandoffSession["productCategory"];
  declineReasonKnown: boolean;
  declineReasonCode: string | null;
  declineReasonSource: "partner" | "customer" | "unknown";
  contextConfirmation: PartnerContextReviewResult["contextConfirmation"];
}

export interface RecoveryJourneyStatusRecord {
  id: string;
  origin: "direct" | "partner";
  stage: RecoveryStage;
  readinessState: RecoveryReadinessState | null;
  nextReassessmentAt: string | null;
  lastReassessedAt: string | null;
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

function mapPartnerJourney(row: Record<string, unknown>): PartnerRecoveryJourneyRecord {
  return {
    id: String(row.id),
    origin: "partner",
    productCategory: row.product_category as PartnerHandoffSession["productCategory"],
    declineReasonKnown: row.decline_reason_known === true,
    declineReasonCode: row.decline_reason_code ? String(row.decline_reason_code) : null,
    declineReasonSource: row.decline_reason_source as PartnerRecoveryJourneyRecord["declineReasonSource"],
    contextConfirmation: row.context_confirmation as PartnerContextReviewResult["contextConfirmation"],
  };
}

function mapRecoveryStatus(row: Record<string, unknown>): RecoveryJourneyStatusRecord {
  return {
    id: String(row.id),
    origin: row.origin as RecoveryJourneyStatusRecord["origin"],
    stage: row.stage as RecoveryStage,
    readinessState: row.readiness_snapshot
      ? row.readiness_snapshot as RecoveryReadinessState
      : null,
    nextReassessmentAt: row.next_reassessment_at ? String(row.next_reassessment_at) : null,
    lastReassessedAt: row.last_reassessed_at ? String(row.last_reassessed_at) : null,
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
  // unrelated trusted/core field. Task 7 consumes current profile and recovery
  // context when projecting the recovery plan. Keeping it as an explicit
  // argument prevents it being mistaken for lender-supplied evidence.
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

export async function createPartnerRecoveryJourney(
  admin: SupabaseClient,
  userId: string,
  session: PartnerHandoffSession,
  review: PartnerContextReviewResult,
  now = new Date(),
): Promise<PartnerRecoveryJourneyRecord> {
  if (session.environment !== "sandbox") {
    throw new Error("Partner recovery journeys require sandbox intake context");
  }

  const nowIso = now.toISOString();
  const { data, error } = await admin
    .from("decline_recovery_journeys")
    .insert({
      user_id: userId,
      intake_session_id: session.id,
      origin: "partner",
      product_category: session.productCategory,
      declined_at: session.declinedAt,
      provider_display_name: session.partnerDisplayName,
      decline_reason_known: review.declineReasonKnown,
      decline_reason_code: review.declineReasonCode,
      decline_reason_source: review.declineReasonSource,
      context_confirmation: review.contextConfirmation,
      stage: "intake",
      return_eligibility_state: "not_assessed",
      started_at: nowIso,
      updated_at: nowIso,
    })
    .select("id, origin, product_category, decline_reason_known, decline_reason_code, decline_reason_source, context_confirmation")
    .single();

  if (error) throw error;
  return mapPartnerJourney(data as Record<string, unknown>);
}

export async function getLatestRecoveryJourney(
  supabase: SupabaseClient,
  userId: string,
): Promise<RecoveryJourneyStatusRecord | null> {
  const { data, error } = await supabase
    .from("decline_recovery_journeys")
    .select("id,origin,stage,readiness_snapshot,next_reassessment_at,last_reassessed_at")
    .eq("user_id", userId)
    .is("completed_at", null)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? mapRecoveryStatus(data as Record<string, unknown>) : null;
}

export async function persistRecoveryProjection(
  admin: SupabaseClient,
  input: {
    recoveryJourneyId: string;
    userId: string;
    projection: RecoveryPlanProjection;
    now: Date;
  },
): Promise<void> {
  const nowIso = input.now.toISOString();
  const { data, error } = await admin
    .from("decline_recovery_journeys")
    .update({
      stage: input.projection.stage,
      readiness_snapshot: input.projection.readinessState,
      next_reassessment_at: input.projection.nextReassessmentAt,
      last_reassessed_at: nowIso,
      updated_at: nowIso,
    })
    .eq("id", input.recoveryJourneyId)
    .eq("user_id", input.userId)
    .select("id")
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("Recovery journey not found for projection");
}
