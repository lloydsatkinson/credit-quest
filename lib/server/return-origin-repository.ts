import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { RecoveryEnvironment, RecoveryProductCategory } from "@/lib/recovery/types";

export interface ReturnRecoveryJourney {
  id: string;
  userId: string;
  origin: "partner";
  productCategory: RecoveryProductCategory;
  partnerId: string;
  returnContractId: string | null;
  originReference: string;
  nextReassessmentAt: string | null;
}

export interface ReturnContractConfig {
  id: string;
  contractKey: string;
  partnerId: string;
  partnerDisplayName: string;
  partnerEnabled: boolean;
  partnerSandboxEnabled: boolean;
  partnerLiveEnabled: boolean;
  environment: RecoveryEnvironment;
  destinationUrl: string;
  productCategory: RecoveryProductCategory;
  disclosureKey: string;
  disclosureVersion: number;
  callbackPolicy: "none" | "ready_for_recheck";
  callbackUrl: string | null;
  enabled: boolean;
  expiresAt: string;
}

export interface AppendReturnAttemptInput {
  userId: string;
  recoveryJourneyId: string;
  partnerId: string;
  returnContractId: string;
  environment: RecoveryEnvironment;
  readinessSnapshot: "ready_to_check";
  disclosureKey: string;
  disclosureVersion: number;
  customerChoice: "continue" | "decline";
  outcome: "redirected" | "declined";
  callbackStatus: "not_applicable";
}

interface ReturnJourneyRow {
  id: string;
  user_id: string;
  origin: "partner" | "direct";
  product_category: RecoveryProductCategory;
  next_reassessment_at: string | null;
  decline_intake_sessions:
    | {
      partner_id: string;
      return_contract_id: string | null;
      origin_reference: string;
    }
    | Array<{
      partner_id: string;
      return_contract_id: string | null;
      origin_reference: string;
    }>
    | null;
}

interface ReturnContractRow {
  id: string;
  contract_key: string;
  partner_id: string;
  environment: RecoveryEnvironment;
  destination_url: string;
  product_category: RecoveryProductCategory;
  disclosure_key: string;
  disclosure_version: number;
  callback_policy: "none" | "ready_for_recheck";
  callback_url: string | null;
  enabled: boolean;
  expires_at: string;
  decline_partners:
    | {
      display_name: string;
      enabled: boolean;
      sandbox_enabled: boolean;
      live_enabled: boolean;
    }
    | Array<{
      display_name: string;
      enabled: boolean;
      sandbox_enabled: boolean;
      live_enabled: boolean;
    }>;
}

export async function getReturnToOriginFeatureEnabled(admin: SupabaseClient): Promise<boolean> {
  const { data, error } = await admin
    .from("feature_flags")
    .select("enabled")
    .eq("flag_key", "return_to_origin_enabled")
    .maybeSingle();
  if (error) throw error;
  return data?.enabled === true;
}

export async function getReturnRecoveryJourney(
  admin: SupabaseClient,
  userId: string,
  recoveryJourneyId: string,
): Promise<ReturnRecoveryJourney | null> {
  const { data, error } = await admin
    .from("decline_recovery_journeys")
    .select([
      "id",
      "user_id",
      "origin",
      "product_category",
      "next_reassessment_at",
      "decline_intake_sessions!inner(partner_id,return_contract_id,origin_reference)",
    ].join(","))
    .eq("id", recoveryJourneyId)
    .eq("user_id", userId)
    .eq("origin", "partner")
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const row = data as unknown as ReturnJourneyRow;
  const intake = Array.isArray(row.decline_intake_sessions)
    ? row.decline_intake_sessions[0]
    : row.decline_intake_sessions;
  if (!intake || row.origin !== "partner") return null;

  return {
    id: String(row.id),
    userId: String(row.user_id),
    origin: "partner",
    productCategory: row.product_category,
    partnerId: String(intake.partner_id),
    returnContractId: intake.return_contract_id ? String(intake.return_contract_id) : null,
    originReference: String(intake.origin_reference),
    nextReassessmentAt: row.next_reassessment_at ? String(row.next_reassessment_at) : null,
  };
}

export async function getReturnContract(
  admin: SupabaseClient,
  contractId: string,
): Promise<ReturnContractConfig | null> {
  const { data, error } = await admin
    .from("return_contracts")
    .select([
      "id",
      "contract_key",
      "partner_id",
      "environment",
      "destination_url",
      "product_category",
      "disclosure_key",
      "disclosure_version",
      "callback_policy",
      "callback_url",
      "enabled",
      "expires_at",
      "decline_partners!inner(display_name,enabled,sandbox_enabled,live_enabled)",
    ].join(","))
    .eq("id", contractId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const row = data as unknown as ReturnContractRow;
  const partner = Array.isArray(row.decline_partners)
    ? row.decline_partners[0]
    : row.decline_partners;
  if (!partner) return null;

  return {
    id: String(row.id),
    contractKey: String(row.contract_key),
    partnerId: String(row.partner_id),
    partnerDisplayName: String(partner.display_name),
    partnerEnabled: partner.enabled === true,
    partnerSandboxEnabled: partner.sandbox_enabled === true,
    partnerLiveEnabled: partner.live_enabled === true,
    environment: row.environment,
    destinationUrl: String(row.destination_url),
    productCategory: row.product_category,
    disclosureKey: String(row.disclosure_key),
    disclosureVersion: Number(row.disclosure_version),
    callbackPolicy: row.callback_policy,
    callbackUrl: row.callback_url ? String(row.callback_url) : null,
    enabled: row.enabled === true,
    expiresAt: String(row.expires_at),
  };
}

export async function appendReturnAttempt(
  admin: SupabaseClient,
  input: AppendReturnAttemptInput,
): Promise<{ id: string }> {
  const { data, error } = await admin
    .from("return_attempts")
    .insert({
      user_id: input.userId,
      recovery_journey_id: input.recoveryJourneyId,
      partner_id: input.partnerId,
      return_contract_id: input.returnContractId,
      environment: input.environment,
      readiness_snapshot: input.readinessSnapshot,
      disclosure_key: input.disclosureKey,
      disclosure_version: input.disclosureVersion,
      customer_choice: input.customerChoice,
      outcome: input.outcome,
      callback_status: input.callbackStatus,
    })
    .select("id")
    .single();
  if (error) throw error;
  return { id: String(data.id) };
}

// V2.0d has no separate suppression store yet. Safety, readiness, evidence and
// dated cooldown gates remain authoritative; this hook fails open only because
// no additional suppression condition exists to evaluate in this release.
export async function isReturnSuppressionClear(): Promise<boolean> {
  return true;
}
