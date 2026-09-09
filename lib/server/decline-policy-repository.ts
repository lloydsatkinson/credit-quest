import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  PartnerDeclineMapping,
  PublishedMappingLookupResult,
  RecoveryPolicyParameterValue,
} from "@/lib/recovery/decline-policy";
import type { RecoveryProductCategory } from "@/lib/recovery/types";

interface PartnerDeclineMappingRow {
  id: string;
  partner_id: string;
  product_category: RecoveryProductCategory;
  external_code: string;
  canonical_code: string;
  parameters: unknown;
  lender_wording: string | null;
  version: number;
  lifecycle: "published";
  effective_from: string;
  effective_to: string | null;
}

function safeParameters(value: unknown): Record<string, RecoveryPolicyParameterValue> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).filter(([, item]) => (
      typeof item === "string" || typeof item === "number" || typeof item === "boolean"
    )),
  ) as Record<string, RecoveryPolicyParameterValue>;
}

function mapRow(row: PartnerDeclineMappingRow): PartnerDeclineMapping {
  return {
    id: row.id,
    partnerId: row.partner_id,
    productCategory: row.product_category,
    externalCode: row.external_code,
    canonicalCode: row.canonical_code,
    parameters: safeParameters(row.parameters),
    lenderWording: row.lender_wording,
    version: row.version,
    lifecycle: row.lifecycle,
    effectiveFrom: row.effective_from,
    effectiveTo: row.effective_to,
  };
}

function activeAt(mapping: PartnerDeclineMapping, now: Date): boolean {
  const from = new Date(mapping.effectiveFrom).getTime();
  const to = mapping.effectiveTo ? new Date(mapping.effectiveTo).getTime() : null;
  const time = now.getTime();
  return Number.isFinite(from) && from <= time && (to === null || (Number.isFinite(to) && time < to));
}

export async function listPublishedMappings(
  admin: SupabaseClient,
  partnerId: string,
  productCategory: RecoveryProductCategory,
  externalCodes: string[],
  now = new Date(),
): Promise<PublishedMappingLookupResult> {
  const requested = [...new Set(externalCodes.map((code) => code.trim()).filter(Boolean))];
  if (requested.length === 0) return { status: "missing", externalCodes: [] };

  const { data, error } = await admin
    .from("partner_decline_mappings")
    .select("id,partner_id,product_category,external_code,canonical_code,parameters,lender_wording,version,lifecycle,effective_from,effective_to")
    .eq("partner_id", partnerId)
    .eq("product_category", productCategory)
    .eq("lifecycle", "published")
    .in("external_code", requested);

  if (error) throw error;

  const active = ((data ?? []) as PartnerDeclineMappingRow[])
    .map(mapRow)
    .filter((mapping) => activeAt(mapping, now));

  const grouped = new Map<string, PartnerDeclineMapping[]>();
  for (const mapping of active) {
    const rows = grouped.get(mapping.externalCode) ?? [];
    rows.push(mapping);
    grouped.set(mapping.externalCode, rows);
  }

  const ambiguous = requested.filter((code) => (grouped.get(code)?.length ?? 0) > 1);
  if (ambiguous.length > 0) return { status: "ambiguous", externalCodes: ambiguous };

  const missing = requested.filter((code) => (grouped.get(code)?.length ?? 0) === 0);
  if (missing.length > 0) return { status: "missing", externalCodes: missing };

  return {
    status: "ok",
    mappings: requested.map((code) => grouped.get(code)?.[0]).filter((row): row is PartnerDeclineMapping => Boolean(row)),
  };
}

export async function publishRecoveryPolicyVersion(
  admin: SupabaseClient,
  adminUserId: string,
  draftId: string,
) {
  const { data, error } = await admin.rpc("admin_publish_recovery_policy_version", {
    p_admin_user_id: adminUserId,
    p_draft_id: draftId,
  });
  if (error) throw error;
  return data;
}
