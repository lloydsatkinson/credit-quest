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
