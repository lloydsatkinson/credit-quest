import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildRecoveryPolicySnapshot, type RecoveryContextConfirmation, type RecoveryPolicySnapshot, type RecoveryPolicySnapshotReason } from "@/lib/recovery/policy-snapshot";
import { getCanonicalDeclineReason } from "@/lib/recovery/decline-taxonomy";
import type { RecoveryProductCategory } from "@/lib/recovery/types";
import { listPublishedMappings } from "@/lib/server/decline-policy-repository";
import { getDeclineIntakeReasons, persistRecoveryPolicySnapshot } from "@/lib/server/recovery-repository";

async function publishedTemplate(admin: SupabaseClient, canonicalCode: string) {
  const { data, error } = await admin.from("recovery_templates").select("id,version").eq("canonical_code", canonicalCode).eq("lifecycle", "published").limit(2);
  if (error) throw error;
  const rows = Array.isArray(data) ? data : [];
  if (rows.length > 1) throw new Error(`ambiguous_recovery_template:${canonicalCode}`);
  return rows[0] ? { id: String(rows[0].id), version: Number(rows[0].version) } : null;
}
async function publishedReassessment(admin: SupabaseClient, partnerId: string, productCategory: RecoveryProductCategory, canonicalCode: string) {
  const { data, error } = await admin.from("reassessment_rules").select("id,version").eq("partner_id", partnerId).eq("product_category", productCategory).eq("canonical_code", canonicalCode).eq("lifecycle", "published").limit(2);
  if (error) throw error;
  const rows = Array.isArray(data) ? data : [];
  if (rows.length > 1) throw new Error(`ambiguous_reassessment_rule:${canonicalCode}`);
  return rows[0] ? { id: String(rows[0].id), version: Number(rows[0].version) } : null;
}
async function publishedAlternativeRoutes(admin: SupabaseClient, partnerId: string, productCategory: RecoveryProductCategory, canonicalCode: string) {
  const { data, error } = await admin.from("alternative_route_policies").select("id,version,route_priority").eq("partner_id", partnerId).eq("product_category", productCategory).eq("canonical_code", canonicalCode).eq("lifecycle", "published").order("route_priority", { ascending: true });
  if (error) throw error;
  return (Array.isArray(data) ? data : []).map((row) => String(row.id));
}

export async function resolveRecoveryPolicyForActivation(admin: SupabaseClient, input: {
  recoveryJourneyId: string;
  intakeSessionId: string;
  partnerId: string;
  productCategory: RecoveryProductCategory;
  contextConfirmation: RecoveryContextConfirmation;
  customerCorrectionCode: string | null;
  now?: Date;
}): Promise<RecoveryPolicySnapshot> {
  const reasonCodes = await getDeclineIntakeReasons(admin, input.intakeSessionId);
  const reasons: RecoveryPolicySnapshotReason[] = [];

  for (const externalCode of reasonCodes) {
    const lookup = await listPublishedMappings(admin, input.partnerId, input.productCategory, [externalCode], input.now ?? new Date());
    if (lookup.status === "ambiguous") throw new Error(`ambiguous_decline_mapping:${externalCode}`);
    if (lookup.status === "missing") {
      reasons.push({ externalCode, mappingId: null, mappingVersion: null, canonicalCode: null, treatment: "needs_evidence", solveability: "unknown_or_unmapped", restricted: false, parameters: {}, templateId: null, templateVersion: null, reassessmentRuleId: null, reassessmentRuleVersion: null, alternativeRoutePolicyIds: [] });
      continue;
    }
    const mapping = lookup.mappings[0];
    const canonical = getCanonicalDeclineReason(mapping.canonicalCode);
    if (!canonical) {
      reasons.push({ externalCode, mappingId: mapping.id, mappingVersion: mapping.version, canonicalCode: null, treatment: "needs_evidence", solveability: "unknown_or_unmapped", restricted: false, parameters: mapping.parameters, templateId: null, templateVersion: null, reassessmentRuleId: null, reassessmentRuleVersion: null, alternativeRoutePolicyIds: [] });
      continue;
    }
    const [template, reassessment, alternativeRoutePolicyIds] = await Promise.all([
      publishedTemplate(admin, canonical.code), publishedReassessment(admin, input.partnerId, input.productCategory, canonical.code),
      publishedAlternativeRoutes(admin, input.partnerId, input.productCategory, canonical.code),
    ]);
    reasons.push({
      externalCode, mappingId: mapping.id, mappingVersion: mapping.version, canonicalCode: canonical.code,
      treatment: canonical.treatment, solveability: canonical.solveability, restricted: canonical.restricted, parameters: mapping.parameters,
      templateId: template?.id ?? null, templateVersion: template?.version ?? null,
      reassessmentRuleId: reassessment?.id ?? null, reassessmentRuleVersion: reassessment?.version ?? null,
      alternativeRoutePolicyIds,
    });
  }

  const snapshot = buildRecoveryPolicySnapshot({
    partnerId: input.partnerId, productCategory: input.productCategory,
    capturedAt: (input.now ?? new Date()).toISOString(), contextConfirmation: input.contextConfirmation,
    customerCorrectionCode: input.customerCorrectionCode, partnerReasons: reasons,
  });
  await persistRecoveryPolicySnapshot(admin, input.recoveryJourneyId, snapshot);
  return snapshot;
}
