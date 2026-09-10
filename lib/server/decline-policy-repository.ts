import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  assertRecoveryPolicyDraftMutable,
  validateRecoveryPolicyDraftForPublish,
  type PartnerDeclineMapping,
  type PolicyLifecycle,
  type PublishedMappingLookupResult,
  type RecoveryPolicyDraftInput,
  type RecoveryPolicyParameterValue,
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

export interface RecoveryPolicyAdminRow {
  id: string;
  kind: RecoveryPolicyDraftInput["kind"];
  key: string;
  canonicalCode: string;
  version: number;
  lifecycle: PolicyLifecycle;
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

function tableForKind(kind: RecoveryPolicyDraftInput["kind"]): string {
  if (kind === "mapping") return "partner_decline_mappings";
  if (kind === "template") return "recovery_templates";
  if (kind === "reassessment_rule") return "reassessment_rules";
  return "alternative_route_policies";
}

function payloadForDraft(input: RecoveryPolicyDraftInput, adminUserId: string): Record<string, unknown> {
  if (input.kind === "mapping") return {
    partner_id: input.partnerId,
    product_category: input.productCategory,
    external_code: input.externalCode.trim(),
    canonical_code: input.canonicalCode,
    parameters: input.parameters,
    lender_wording: input.lenderWording,
    version: input.version,
    created_by: adminUserId,
  };
  if (input.kind === "template") return {
    template_key: input.templateKey.trim(),
    canonical_code: input.canonicalCode,
    treatment_class: input.treatment,
    solveability: input.solveability,
    severity: input.severity,
    recovery_horizon: input.recoveryHorizon,
    customer_headline: input.customerHeadline.trim(),
    customer_explanation: input.customerExplanation.trim(),
    version: input.version,
    created_by: adminUserId,
  };
  if (input.kind === "reassessment_rule") return {
    partner_id: input.partnerId,
    product_category: input.productCategory,
    canonical_code: input.canonicalCode,
    condition_ast: input.conditionAst,
    condition_schema_version: 1,
    version: input.version,
    created_by: adminUserId,
  };
  return {
    partner_id: input.partnerId,
    product_category: input.productCategory,
    canonical_code: input.canonicalCode,
    source_product_key: input.sourceProductKey,
    destination_product_key: input.destinationProductKey,
    return_contract_id: input.returnContractId,
    condition_ast: input.conditionAst,
    condition_schema_version: 1,
    min_wait_days: input.minWaitDays,
    route_priority: input.routePriority,
    version: input.version,
    created_by: adminUserId,
  };
}

async function replaceDraftTemplateSteps(
  admin: SupabaseClient,
  templateId: string,
  input: Extract<RecoveryPolicyDraftInput, { kind: "template" }>,
): Promise<void> {
  if (input.steps === undefined) return;
  const { error: deleteError } = await admin
    .from("recovery_template_steps")
    .delete()
    .eq("template_id", templateId)
    .eq("lifecycle", "draft");
  if (deleteError) throw deleteError;
  if (input.steps.length === 0) return;
  const { error: insertError } = await admin.from("recovery_template_steps").insert(
    input.steps.map((step, index) => ({
      template_id: templateId,
      step_order: index + 1,
      step_type: step.stepType,
      phase: step.phase,
      priority: step.priority,
      customer_wording: step.customerWording.trim(),
      mission_slug: step.missionSlug,
      completion_evidence: null,
      entry_condition: null,
      exit_condition: null,
      condition_schema_version: 1,
      min_wait_days: step.minWaitDays,
      blocking: step.blocking,
      requirement_status: step.requirementStatus,
      version: 1,
      lifecycle: "draft",
    })),
  );
  if (insertError) throw insertError;
}

export async function saveRecoveryPolicyDraft(
  admin: SupabaseClient,
  adminUserId: string,
  input: RecoveryPolicyDraftInput,
): Promise<string> {
  const table = tableForKind(input.kind);
  if (input.id) {
    const { data: current, error: readError } = await admin
      .from(table)
      .select("id,lifecycle")
      .eq("id", input.id)
      .maybeSingle();
    if (readError) throw readError;
    if (!current) throw new Error("recovery_policy_draft_not_found");
    assertRecoveryPolicyDraftMutable(String(current.lifecycle) as PolicyLifecycle);
    const { data, error } = await admin
      .from(table)
      .update(payloadForDraft(input, adminUserId))
      .eq("id", input.id)
      .eq("lifecycle", "draft")
      .select("id")
      .single();
    if (error) throw error;
    if (input.kind === "template") await replaceDraftTemplateSteps(admin, input.id, input);
    return String(data.id);
  }

  const { data, error } = await admin
    .from(table)
    .insert({ ...payloadForDraft(input, adminUserId), lifecycle: "draft" })
    .select("id")
    .single();
  if (error) throw error;
  const id = String(data.id);
  if (input.kind === "template") await replaceDraftTemplateSteps(admin, id, input);
  return id;
}

function rowToDraft(kind: RecoveryPolicyDraftInput["kind"], row: Record<string, unknown>): RecoveryPolicyDraftInput {
  if (kind === "mapping") return {
    id: String(row.id), kind,
    partnerId: String(row.partner_id), productCategory: String(row.product_category) as RecoveryProductCategory,
    externalCode: String(row.external_code), canonicalCode: String(row.canonical_code),
    parameters: safeParameters(row.parameters), lenderWording: row.lender_wording === null ? null : String(row.lender_wording ?? ""),
    version: Number(row.version),
  };
  if (kind === "template") return {
    id: String(row.id), kind, templateKey: String(row.template_key), canonicalCode: String(row.canonical_code),
    treatment: String(row.treatment_class) as Extract<RecoveryPolicyDraftInput, { kind: "template" }>["treatment"],
    solveability: String(row.solveability) as Extract<RecoveryPolicyDraftInput, { kind: "template" }>["solveability"],
    severity: String(row.severity) as Extract<RecoveryPolicyDraftInput, { kind: "template" }>["severity"],
    recoveryHorizon: String(row.recovery_horizon) as Extract<RecoveryPolicyDraftInput, { kind: "template" }>["recoveryHorizon"],
    customerHeadline: String(row.customer_headline ?? ""), customerExplanation: String(row.customer_explanation ?? ""),
    version: Number(row.version),
  };
  if (kind === "reassessment_rule") return {
    id: String(row.id), kind, partnerId: String(row.partner_id),
    productCategory: String(row.product_category) as RecoveryProductCategory, canonicalCode: String(row.canonical_code),
    conditionAst: row.condition_ast, version: Number(row.version),
  };
  return {
    id: String(row.id), kind, partnerId: String(row.partner_id),
    productCategory: String(row.product_category) as RecoveryProductCategory, canonicalCode: String(row.canonical_code),
    sourceProductKey: row.source_product_key === null ? null : String(row.source_product_key ?? ""),
    destinationProductKey: String(row.destination_product_key),
    returnContractId: row.return_contract_id === null ? null : String(row.return_contract_id ?? ""),
    conditionAst: row.condition_ast ?? null,
    minWaitDays: row.min_wait_days === null ? null : Number(row.min_wait_days),
    routePriority: Number(row.route_priority), version: Number(row.version),
  };
}

async function findPolicyRecord(admin: SupabaseClient, id: string): Promise<{
  kind: RecoveryPolicyDraftInput["kind"];
  lifecycle: PolicyLifecycle;
  row: Record<string, unknown>;
} | null> {
  const candidates: Array<[RecoveryPolicyDraftInput["kind"], string]> = [
    ["mapping", "partner_decline_mappings"],
    ["template", "recovery_templates"],
    ["reassessment_rule", "reassessment_rules"],
    ["alternative_route", "alternative_route_policies"],
  ];
  for (const [kind, table] of candidates) {
    const { data, error } = await admin.from(table).select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    if (data) return { kind, lifecycle: String(data.lifecycle) as PolicyLifecycle, row: data as Record<string, unknown> };
  }
  return null;
}

export async function publishValidatedRecoveryPolicyVersion(
  admin: SupabaseClient,
  adminUserId: string,
  draftId: string,
  now = new Date(),
) {
  const record = await findPolicyRecord(admin, draftId);
  if (!record) throw new Error("recovery_policy_draft_not_found");
  if (record.lifecycle !== "draft" && record.lifecycle !== "tested") {
    throw new Error("recovery_policy_publish_state_invalid");
  }

  const draft = rowToDraft(record.kind, record.row);
  let activePublishedMappingCount = 0;
  if (draft.kind === "mapping") {
    const lookup = await listPublishedMappings(
      admin,
      draft.partnerId,
      draft.productCategory,
      [draft.externalCode],
      now,
    );
    activePublishedMappingCount = lookup.status === "ok" ? lookup.mappings.length : lookup.status === "ambiguous" ? 2 : 0;
  }
  validateRecoveryPolicyDraftForPublish(draft, { activePublishedMappingCount });

  if (record.lifecycle === "draft") {
    const table = tableForKind(record.kind);
    const { error } = await admin.from(table).update({ lifecycle: "tested" }).eq("id", draftId).eq("lifecycle", "draft");
    if (error) throw error;
    if (record.kind === "template") {
      const { error: stepError } = await admin
        .from("recovery_template_steps")
        .update({ lifecycle: "tested" })
        .eq("template_id", draftId)
        .eq("lifecycle", "draft");
      if (stepError) throw stepError;
    }
  }

  return publishRecoveryPolicyVersion(admin, adminUserId, draftId);
}

export async function listRecoveryPolicyAdminRows(admin: SupabaseClient): Promise<RecoveryPolicyAdminRow[]> {
  const specs: Array<[RecoveryPolicyDraftInput["kind"], string, string]> = [
    ["mapping", "partner_decline_mappings", "external_code"],
    ["template", "recovery_templates", "template_key"],
    ["reassessment_rule", "reassessment_rules", "canonical_code"],
    ["alternative_route", "alternative_route_policies", "destination_product_key"],
  ];
  const result: RecoveryPolicyAdminRow[] = [];
  for (const [kind, table, keyColumn] of specs) {
    // Static `*` selection keeps Supabase's generated query parser type-safe;
    // the admin response is normalised immediately and never returned raw.
    const { data, error } = await admin.from(table).select("*").order("created_at", { ascending: false }).limit(50);
    if (error) throw error;
    for (const row of data ?? []) {
      const value = row as unknown as Record<string, unknown>;
      result.push({
        id: String(value.id), kind, key: String(value[keyColumn] ?? ""),
        canonicalCode: String(value.canonical_code ?? ""), version: Number(value.version),
        lifecycle: String(value.lifecycle) as PolicyLifecycle,
      });
    }
  }
  return result;
}

export async function listDeclinePartnersForPolicyAdmin(admin: SupabaseClient) {
  const { data, error } = await admin
    .from("decline_partners")
    .select("id,partner_key,display_name,enabled,sandbox_enabled,live_enabled")
    .order("partner_key", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: String(row.id),
    partnerKey: String(row.partner_key),
    displayName: String(row.display_name),
    enabled: Boolean(row.enabled),
    sandboxEnabled: Boolean(row.sandbox_enabled),
    liveEnabled: Boolean(row.live_enabled),
  }));
}
