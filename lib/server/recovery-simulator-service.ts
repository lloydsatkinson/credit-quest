import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  evaluateCondition,
  type ConditionExpr,
  type ConditionResult,
  type RecoveryFactValue,
} from "@/lib/recovery/condition-language";
import { getCanonicalDeclineReason, type RecoveryTreatmentClass } from "@/lib/recovery/decline-taxonomy";
import { resolveRecoveryBarriers, type BarrierResolution } from "@/lib/recovery/multi-barrier-resolver";
import type { RecoveryProductCategory } from "@/lib/recovery/types";
import { listPublishedMappings } from "@/lib/server/decline-policy-repository";

export interface RecoverySimulationInput {
  partnerId: string;
  productCategory: RecoveryProductCategory;
  declineCodes: string[];
  facts: Record<string, RecoveryFactValue>;
  now: string;
}

export interface RecoverySimulationPolicy {
  mappings: Array<{
    id: string;
    externalCode: string;
    canonicalCode: string;
    version: number;
    parameters: Record<string, string | number | boolean>;
  }>;
  templates: Array<{
    id: string;
    canonicalCode: string;
    version: number;
    customerHeadline: string;
    steps: Array<{
      id: string;
      phase: "now" | "next" | "then" | "later";
      priority: number;
      customerWording: string;
    }>;
  }>;
  reassessmentRules: Array<{
    id: string;
    canonicalCode: string;
    version: number;
    conditionAst: ConditionExpr;
  }>;
  alternativeRoutes: Array<{
    id: string;
    canonicalCode: string;
    destinationProductKey: string;
    version: number;
  }>;
}

export interface RecoverySimulationResult {
  canonicalMappings: Array<{
    externalCode: string;
    canonicalCode: string | null;
    mappingId: string | null;
    version: number | null;
  }>;
  barrierResolution: BarrierResolution;
  treatment: RecoveryTreatmentClass;
  steps: Record<"now" | "next" | "then" | "later", Array<{ id: string; customerWording: string; priority: number }>>;
  reassessment: { ruleId: string; result: ConditionResult } | null;
  originalRouteState: "suppressed" | "deferred_to_credit_quest";
  alternativeRouteState: "suppressed" | "configured" | "unavailable";
  suppressionReason: string | null;
  policyVersions: {
    mapping: number[];
    template: number[];
    reassessment: number[];
    alternativeRoute: number[];
  };
}

function uniqueVersions(values: number[]): number[] {
  return [...new Set(values)].sort((a, b) => a - b);
}

export function runRecoverySimulation(
  input: RecoverySimulationInput,
  policy: RecoverySimulationPolicy,
): RecoverySimulationResult {
  const canonicalMappings = input.declineCodes.map((externalCode) => {
    const matches = policy.mappings.filter((mapping) => mapping.externalCode === externalCode);
    if (matches.length > 1) throw new Error(`ambiguous_decline_mapping:${externalCode}`);
    const mapping = matches[0] ?? null;
    const canonical = mapping ? getCanonicalDeclineReason(mapping.canonicalCode) : null;
    return {
      externalCode,
      canonicalCode: canonical?.code ?? null,
      mappingId: mapping?.id ?? null,
      version: mapping?.version ?? null,
    };
  });

  const reasonCodes = canonicalMappings.map((mapping) => mapping.canonicalCode ?? mapping.externalCode);
  const barrierResolution = resolveRecoveryBarriers({ reasonCodes });
  const selectedCanonicalCodes = new Set(canonicalMappings.flatMap((mapping) => mapping.canonicalCode ? [mapping.canonicalCode] : []));

  const selectedTemplates = policy.templates.filter((template) => selectedCanonicalCodes.has(template.canonicalCode));
  for (const code of selectedCanonicalCodes) {
    if (selectedTemplates.filter((template) => template.canonicalCode === code).length > 1) {
      throw new Error(`ambiguous_recovery_template:${code}`);
    }
  }

  const steps: RecoverySimulationResult["steps"] = { now: [], next: [], then: [], later: [] };
  for (const template of selectedTemplates) {
    for (const step of template.steps) {
      steps[step.phase].push({ id: step.id, customerWording: step.customerWording, priority: step.priority });
    }
  }
  for (const phase of ["now", "next", "then", "later"] as const) {
    steps[phase].sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id));
  }

  const primaryCanonicalCode = barrierResolution.primary?.canonicalCode ?? null;
  const matchingRules = primaryCanonicalCode
    ? policy.reassessmentRules.filter((rule) => rule.canonicalCode === primaryCanonicalCode)
    : [];
  if (matchingRules.length > 1) throw new Error(`ambiguous_reassessment_rule:${primaryCanonicalCode}`);
  const rule = matchingRules[0] ?? null;
  const primaryMapping = primaryCanonicalCode
    ? policy.mappings.find((mapping) => mapping.canonicalCode === primaryCanonicalCode && input.declineCodes.includes(mapping.externalCode))
    : null;
  const reassessment = rule ? {
    ruleId: rule.id,
    result: evaluateCondition(rule.conditionAst, input.facts, primaryMapping?.parameters ?? {}),
  } : null;

  const selectedRoutes = policy.alternativeRoutes.filter((route) => selectedCanonicalCodes.has(route.canonicalCode));
  const restricted = barrierResolution.treatment === "restricted";
  const alternativeRouteState: RecoverySimulationResult["alternativeRouteState"] = barrierResolution.alternativeCreditSuppressed
    ? "suppressed"
    : selectedRoutes.length > 0 ? "configured" : "unavailable";

  return {
    canonicalMappings,
    barrierResolution,
    treatment: barrierResolution.treatment,
    steps,
    reassessment,
    originalRouteState: restricted ? "suppressed" : "deferred_to_credit_quest",
    alternativeRouteState,
    suppressionReason: barrierResolution.suppressionReason,
    policyVersions: {
      mapping: uniqueVersions(canonicalMappings.flatMap((mapping) => mapping.version === null ? [] : [mapping.version])),
      template: uniqueVersions(selectedTemplates.map((template) => template.version)),
      reassessment: uniqueVersions(rule ? [rule.version] : []),
      alternativeRoute: uniqueVersions(selectedRoutes.map((route) => route.version)),
    },
  };
}

export async function simulateRecoveryScenario(
  admin: SupabaseClient,
  input: RecoverySimulationInput,
): Promise<RecoverySimulationResult> {
  const now = new Date(input.now);
  if (!Number.isFinite(now.getTime())) throw new Error("invalid_simulation_time");

  const mappings: RecoverySimulationPolicy["mappings"] = [];
  for (const externalCode of input.declineCodes) {
    const lookup = await listPublishedMappings(admin, input.partnerId, input.productCategory, [externalCode], now);
    if (lookup.status === "ambiguous") throw new Error(`ambiguous_decline_mapping:${externalCode}`);
    if (lookup.status === "ok") {
      const mapping = lookup.mappings[0];
      mappings.push({
        id: mapping.id,
        externalCode: mapping.externalCode,
        canonicalCode: mapping.canonicalCode,
        version: mapping.version,
        parameters: mapping.parameters,
      });
    }
  }

  const canonicalCodes = [...new Set(mappings.map((mapping) => mapping.canonicalCode).filter((code) => Boolean(getCanonicalDeclineReason(code))))];
  const policy: RecoverySimulationPolicy = { mappings, templates: [], reassessmentRules: [], alternativeRoutes: [] };

  if (canonicalCodes.length > 0) {
    const { data: templateRows, error: templateError } = await admin
      .from("recovery_templates")
      .select("id,canonical_code,version,customer_headline")
      .eq("lifecycle", "published")
      .in("canonical_code", canonicalCodes);
    if (templateError) throw templateError;
    const templates = (templateRows ?? []).map((row) => ({
      id: String(row.id), canonicalCode: String(row.canonical_code), version: Number(row.version),
      customerHeadline: String(row.customer_headline), steps: [] as RecoverySimulationPolicy["templates"][number]["steps"],
    }));
    const templateIds = templates.map((template) => template.id);
    if (templateIds.length > 0) {
      const { data: stepRows, error: stepError } = await admin
        .from("recovery_template_steps")
        .select("id,template_id,phase,priority,customer_wording")
        .eq("lifecycle", "published")
        .in("template_id", templateIds)
        .order("step_order", { ascending: true });
      if (stepError) throw stepError;
      for (const row of stepRows ?? []) {
        const template = templates.find((item) => item.id === String(row.template_id));
        if (!template) continue;
        template.steps.push({
          id: String(row.id), phase: String(row.phase) as "now" | "next" | "then" | "later",
          priority: Number(row.priority), customerWording: String(row.customer_wording),
        });
      }
    }
    policy.templates = templates;

    const { data: ruleRows, error: ruleError } = await admin
      .from("reassessment_rules")
      .select("id,canonical_code,version,condition_ast")
      .eq("partner_id", input.partnerId)
      .eq("product_category", input.productCategory)
      .eq("lifecycle", "published")
      .in("canonical_code", canonicalCodes);
    if (ruleError) throw ruleError;
    policy.reassessmentRules = (ruleRows ?? []).map((row) => ({
      id: String(row.id), canonicalCode: String(row.canonical_code), version: Number(row.version),
      conditionAst: row.condition_ast as ConditionExpr,
    }));

    const { data: routeRows, error: routeError } = await admin
      .from("alternative_route_policies")
      .select("id,canonical_code,destination_product_key,version")
      .eq("partner_id", input.partnerId)
      .eq("product_category", input.productCategory)
      .eq("lifecycle", "published")
      .in("canonical_code", canonicalCodes)
      .order("route_priority", { ascending: true });
    if (routeError) throw routeError;
    policy.alternativeRoutes = (routeRows ?? []).map((row) => ({
      id: String(row.id), canonicalCode: String(row.canonical_code),
      destinationProductKey: String(row.destination_product_key), version: Number(row.version),
    }));
  }

  return runRecoverySimulation(input, policy);
}
