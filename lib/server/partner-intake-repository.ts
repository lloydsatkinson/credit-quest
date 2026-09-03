import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface PartnerCredentialConfig {
  credentialId: string;
  credentialKey: string;
  secretReference: string;
  credentialEnabled: boolean;
  validFrom: string;
  expiresAt: string | null;
  partnerId: string;
  partnerKey: string;
  partnerDisplayName: string;
  partnerEnabled: boolean;
  partnerSandboxEnabled: boolean;
  partnerLiveEnabled: boolean;
}

interface PartnerCredentialRow {
  id: string;
  credential_key: string;
  secret_reference: string;
  enabled: boolean;
  valid_from: string;
  expires_at: string | null;
  partner_id: string;
  decline_partners:
    | {
      partner_key: string;
      display_name: string;
      enabled: boolean;
      sandbox_enabled: boolean;
      live_enabled: boolean;
    }
    | Array<{
      partner_key: string;
      display_name: string;
      enabled: boolean;
      sandbox_enabled: boolean;
      live_enabled: boolean;
    }>;
}

export interface PartnerHandoffSession {
  id: string;
  partnerId: string;
  environment: "sandbox" | "live";
  originReference: string;
  productCategory: "credit_card" | "loan" | "overdraft" | "mortgage" | "other";
  declinedAt: string;
  declineReasonCode: string | null;
  declineReasonSource: "partner" | "unknown";
  attributionKey: string | null;
  additionalSupportMayBeNeeded: boolean | null;
  disclosureVersion: string | null;
  consentVersion: string | null;
  tokenExpiresAt: string;
  consumedAt: string | null;
  boundUserId: string | null;
  partnerDisplayName: string;
  partnerEnabled: boolean;
  partnerSandboxEnabled: boolean;
  partnerLiveEnabled: boolean;
}

interface PartnerHandoffRow {
  id: string;
  partner_id: string;
  environment: "sandbox" | "live";
  origin_reference: string;
  product_category: PartnerHandoffSession["productCategory"];
  declined_at: string;
  decline_reason_code: string | null;
  decline_reason_source: "partner" | "unknown";
  attribution_key: string | null;
  additional_support_may_be_needed: boolean | null;
  disclosure_version: string | null;
  consent_version: string | null;
  token_expires_at: string;
  consumed_at: string | null;
  bound_user_id: string | null;
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

export interface AtomicPartnerHandoffInput {
  sessionId: string;
  userId: string;
  declineReasonKnown: boolean;
  declineReasonCode: string | null;
  declineReasonSource: "partner" | "customer" | "unknown";
  contextConfirmation: "confirmed" | "corrected" | "unknown" | "optional_use_declined";
  now: Date;
}

export interface AtomicPartnerHandoffResult {
  id: string;
  origin: "partner";
  productCategory: PartnerHandoffSession["productCategory"];
  declineReasonKnown: boolean;
  declineReasonCode: string | null;
  declineReasonSource: "partner" | "customer" | "unknown";
  contextConfirmation: AtomicPartnerHandoffInput["contextConfirmation"];
}

export async function getPartnerIntakeFeatureEnabled(admin: SupabaseClient) {
  const { data, error } = await admin
    .from("feature_flags")
    .select("enabled")
    .eq("flag_key", "partner_decline_intake_enabled")
    .maybeSingle();
  if (error) throw error;
  return data?.enabled === true;
}

export async function getPartnerCredentialByKey(
  admin: SupabaseClient,
  credentialKey: string,
): Promise<PartnerCredentialConfig | null> {
  const { data, error } = await admin
    .from("decline_partner_credentials")
    .select([
      "id",
      "credential_key",
      "secret_reference",
      "enabled",
      "valid_from",
      "expires_at",
      "partner_id",
      "decline_partners!inner(partner_key,display_name,enabled,sandbox_enabled,live_enabled)",
    ].join(","))
    .eq("credential_key", credentialKey)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const row = data as unknown as PartnerCredentialRow;
  const partner = Array.isArray(row.decline_partners)
    ? row.decline_partners[0]
    : row.decline_partners;
  if (!partner) return null;

  return {
    credentialId: String(row.id),
    credentialKey: String(row.credential_key),
    secretReference: String(row.secret_reference),
    credentialEnabled: row.enabled === true,
    validFrom: String(row.valid_from),
    expiresAt: row.expires_at ? String(row.expires_at) : null,
    partnerId: String(row.partner_id),
    partnerKey: String(partner.partner_key),
    partnerDisplayName: String(partner.display_name),
    partnerEnabled: partner.enabled === true,
    partnerSandboxEnabled: partner.sandbox_enabled === true,
    partnerLiveEnabled: partner.live_enabled === true,
  };
}

export async function findPartnerIntakeByNonce(
  admin: SupabaseClient,
  partnerId: string,
  nonce: string,
) {
  const { data, error } = await admin
    .from("decline_intake_sessions")
    .select("id")
    .eq("partner_id", partnerId)
    .eq("nonce", nonce)
    .maybeSingle();
  if (error) throw error;
  return data ? { id: String(data.id) } : null;
}

export async function findPartnerIntakeByIdempotency(
  admin: SupabaseClient,
  partnerId: string,
  idempotencyKey: string,
) {
  const { data, error } = await admin
    .from("decline_intake_sessions")
    .select("id")
    .eq("partner_id", partnerId)
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();
  if (error) throw error;
  return data ? { id: String(data.id) } : null;
}

export interface InsertPartnerIntakeInput {
  partnerId: string;
  credentialId: string;
  returnContractId: string | null;
  environment: "sandbox";
  originReference: string;
  productCategory: "credit_card" | "loan" | "overdraft" | "mortgage" | "other";
  declinedAt: string;
  declineReasonCode: string | null;
  declineReasonSource: "partner" | "unknown";
  attributionKey: string | null;
  additionalSupportMayBeNeeded: boolean | null;
  disclosureVersion: string | null;
  consentVersion: string | null;
  idempotencyKey: string;
  nonce: string;
  requestTimestamp: string;
  tokenHash: string;
  tokenExpiresAt: string;
}

export async function insertPartnerIntakeSession(
  admin: SupabaseClient,
  input: InsertPartnerIntakeInput,
) {
  const { data, error } = await admin
    .from("decline_intake_sessions")
    .insert({
      partner_id: input.partnerId,
      credential_id: input.credentialId,
      return_contract_id: input.returnContractId,
      environment: input.environment,
      origin_reference: input.originReference,
      product_category: input.productCategory,
      declined_at: input.declinedAt,
      decline_reason_code: input.declineReasonCode,
      decline_reason_source: input.declineReasonSource,
      attribution_key: input.attributionKey,
      additional_support_may_be_needed: input.additionalSupportMayBeNeeded,
      disclosure_version: input.disclosureVersion,
      consent_version: input.consentVersion,
      idempotency_key: input.idempotencyKey,
      nonce: input.nonce,
      request_timestamp: input.requestTimestamp,
      token_hash: input.tokenHash,
      token_expires_at: input.tokenExpiresAt,
    })
    .select("id")
    .single();
  if (error) throw error;
  return { id: String(data.id) };
}

export async function getPartnerHandoffByTokenHash(
  admin: SupabaseClient,
  tokenHash: string,
): Promise<PartnerHandoffSession | null> {
  const { data, error } = await admin
    .from("decline_intake_sessions")
    .select([
      "id",
      "partner_id",
      "environment",
      "origin_reference",
      "product_category",
      "declined_at",
      "decline_reason_code",
      "decline_reason_source",
      "attribution_key",
      "additional_support_may_be_needed",
      "disclosure_version",
      "consent_version",
      "token_expires_at",
      "consumed_at",
      "bound_user_id",
      "decline_partners!inner(display_name,enabled,sandbox_enabled,live_enabled)",
    ].join(","))
    .eq("token_hash", tokenHash)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const row = data as unknown as PartnerHandoffRow;
  const partner = Array.isArray(row.decline_partners)
    ? row.decline_partners[0]
    : row.decline_partners;
  if (!partner) return null;

  return {
    id: String(row.id),
    partnerId: String(row.partner_id),
    environment: row.environment,
    originReference: String(row.origin_reference),
    productCategory: row.product_category,
    declinedAt: String(row.declined_at),
    declineReasonCode: row.decline_reason_code ? String(row.decline_reason_code) : null,
    declineReasonSource: row.decline_reason_source,
    attributionKey: row.attribution_key ? String(row.attribution_key) : null,
    additionalSupportMayBeNeeded: row.additional_support_may_be_needed,
    disclosureVersion: row.disclosure_version ? String(row.disclosure_version) : null,
    consentVersion: row.consent_version ? String(row.consent_version) : null,
    tokenExpiresAt: String(row.token_expires_at),
    consumedAt: row.consumed_at ? String(row.consumed_at) : null,
    boundUserId: row.bound_user_id ? String(row.bound_user_id) : null,
    partnerDisplayName: String(partner.display_name),
    partnerEnabled: partner.enabled === true,
    partnerSandboxEnabled: partner.sandbox_enabled === true,
    partnerLiveEnabled: partner.live_enabled === true,
  };
}

export async function consumePartnerIntakeSession(
  admin: SupabaseClient,
  sessionId: string,
  userId: string,
  now = new Date(),
) {
  const nowIso = now.toISOString();
  const { data, error } = await admin
    .from("decline_intake_sessions")
    .update({
      bound_user_id: userId,
      consumed_at: nowIso,
    })
    .eq("id", sessionId)
    .eq("environment", "sandbox")
    .is("consumed_at", null)
    .is("bound_user_id", null)
    .gt("token_expires_at", nowIso)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

export async function redeemPartnerHandoffAtomically(
  admin: SupabaseClient,
  input: AtomicPartnerHandoffInput,
): Promise<AtomicPartnerHandoffResult> {
  const { data, error } = await admin.rpc("redeem_partner_handoff_atomic", {
    p_session_id: input.sessionId,
    p_user_id: input.userId,
    p_decline_reason_known: input.declineReasonKnown,
    p_decline_reason_code: input.declineReasonCode,
    p_decline_reason_source: input.declineReasonSource,
    p_context_confirmation: input.contextConfirmation,
    p_now: input.now.toISOString(),
  });
  if (error) throw error;

  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== "object") {
    throw new Error("handoff_unavailable");
  }
  const record = row as Record<string, unknown>;

  return {
    id: String(record.id),
    origin: "partner",
    productCategory: record.product_category as AtomicPartnerHandoffResult["productCategory"],
    declineReasonKnown: record.decline_reason_known === true,
    declineReasonCode: record.decline_reason_code ? String(record.decline_reason_code) : null,
    declineReasonSource: record.decline_reason_source as AtomicPartnerHandoffResult["declineReasonSource"],
    contextConfirmation: record.context_confirmation as AtomicPartnerHandoffResult["contextConfirmation"],
  };
}
