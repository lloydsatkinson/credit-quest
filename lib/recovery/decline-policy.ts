import type { RecoveryProductCategory } from "@/lib/recovery/types";
import {
  getCanonicalDeclineReason,
  type RecoveryTreatmentClass,
  type SolveabilityClass,
} from "@/lib/recovery/decline-taxonomy";
import {
  validateConditionExpression,
  type ConditionExpr,
} from "@/lib/recovery/condition-language";

export type PolicyLifecycle = "draft" | "tested" | "published" | "retired";
export type RecoveryPolicyParameterValue = string | number | boolean;

export interface PartnerDeclineMapping {
  id: string;
  partnerId: string;
  productCategory: RecoveryProductCategory;
  externalCode: string;
  canonicalCode: string;
  parameters: Record<string, RecoveryPolicyParameterValue>;
  lenderWording: string | null;
  version: number;
  lifecycle: PolicyLifecycle;
  effectiveFrom: string;
  effectiveTo: string | null;
}

export interface RecoveryTemplateDefinition {
  id: string;
  templateKey: string;
  canonicalCode: string | null;
  treatment: RecoveryTreatmentClass;
  solveability: SolveabilityClass;
  severity: "low" | "medium" | "high" | "structural";
  recoveryHorizon: "immediate" | "short" | "medium" | "long" | "structural_indeterminate";
  customerHeadline: string;
  customerExplanation: string;
  version: number;
  lifecycle: PolicyLifecycle;
}

export interface RecoveryTemplateStepDefinition {
  id: string;
  templateId: string;
  stepOrder: number;
  stepType: "action" | "education" | "wait" | "evidence" | "correction" | "reassessment";
  phase: "now" | "next" | "then" | "later";
  priority: number;
  customerWording: string;
  missionSlug: string | null;
  completionEvidence: unknown;
  entryCondition: unknown;
  exitCondition: unknown;
  minWaitDays: number | null;
  blocking: boolean;
  requirementStatus: "required" | "recommended" | "informational";
  version: number;
  lifecycle: PolicyLifecycle;
}

export interface ReassessmentRuleDefinition {
  id: string;
  partnerId: string;
  productCategory: RecoveryProductCategory;
  canonicalCode: string;
  conditionAst: unknown;
  conditionSchemaVersion: number;
  version: number;
  lifecycle: PolicyLifecycle;
  effectiveFrom: string;
  effectiveTo: string | null;
}

export interface AlternativeRoutePolicyDefinition {
  id: string;
  partnerId: string;
  productCategory: RecoveryProductCategory;
  canonicalCode: string;
  sourceProductKey: string | null;
  destinationProductKey: string;
  returnContractId: string | null;
  requiredEvidence: unknown;
  conditionAst: unknown;
  conditionSchemaVersion: number;
  minWaitDays: number | null;
  routePriority: number;
  version: number;
  lifecycle: PolicyLifecycle;
  effectiveFrom: string;
  effectiveTo: string | null;
}

export type PublishedMappingLookupResult =
  | { status: "ok"; mappings: PartnerDeclineMapping[] }
  | { status: "missing"; externalCodes: string[] }
  | { status: "ambiguous"; externalCodes: string[] };

export interface RecoveryTemplateStepDraftInput {
  phase: "now" | "next" | "then" | "later";
  stepType: "action" | "education" | "wait" | "evidence" | "correction" | "reassessment";
  priority: number;
  customerWording: string;
  missionSlug: string | null;
  minWaitDays: number | null;
  blocking: boolean;
  requirementStatus: "required" | "recommended" | "informational";
}

export type RecoveryPolicyDraftInput =
  | {
      id?: string;
      kind: "mapping";
      partnerId: string;
      productCategory: RecoveryProductCategory;
      externalCode: string;
      canonicalCode: string;
      parameters: Record<string, RecoveryPolicyParameterValue>;
      lenderWording: string | null;
      version: number;
    }
  | {
      id?: string;
      kind: "template";
      templateKey: string;
      canonicalCode: string;
      treatment: RecoveryTreatmentClass;
      solveability: SolveabilityClass;
      severity: "low" | "medium" | "high" | "structural";
      recoveryHorizon: "immediate" | "short" | "medium" | "long" | "structural_indeterminate";
      customerHeadline: string;
      customerExplanation: string;
      version: number;
      steps?: RecoveryTemplateStepDraftInput[];
    }
  | {
      id?: string;
      kind: "reassessment_rule";
      partnerId: string;
      productCategory: RecoveryProductCategory;
      canonicalCode: string;
      conditionAst: unknown;
      version: number;
    }
  | {
      id?: string;
      kind: "alternative_route";
      partnerId: string;
      productCategory: RecoveryProductCategory;
      canonicalCode: string;
      sourceProductKey: string | null;
      destinationProductKey: string;
      returnContractId: string | null;
      conditionAst: unknown | null;
      minWaitDays: number | null;
      routePriority: number;
      version: number;
    };

export function assertRecoveryPolicyDraftMutable(lifecycle: PolicyLifecycle): void {
  if (lifecycle !== "draft") throw new Error("draft_only_recovery_policy_mutation");
}

export function validateRecoveryPolicyDraftForPublish(
  draft: RecoveryPolicyDraftInput,
  options: { activePublishedMappingCount?: number } = {},
): RecoveryPolicyDraftInput {
  const canonical = getCanonicalDeclineReason(draft.canonicalCode);
  if (!canonical) throw new Error(`unknown_canonical_decline_reason:${draft.canonicalCode}`);

  if (draft.kind === "mapping") {
    if (!draft.externalCode.trim()) throw new Error("invalid_external_decline_code");
    if ((options.activePublishedMappingCount ?? 0) > 0) {
      throw new Error(`ambiguous_mapping:${draft.externalCode}`);
    }
  }

  if (draft.kind === "template") {
    if (!draft.customerHeadline.trim() || !draft.customerExplanation.trim()) {
      throw new Error("missing_customer_copy");
    }
    for (const step of draft.steps ?? []) {
      if (!step.customerWording.trim()) throw new Error("missing_customer_copy:template_step");
    }
    // Production barrier resolution is canonical and deterministic. The Journey
    // Builder may configure copy/steps/parameters, but it cannot silently create
    // a different treatment class from the governed taxonomy.
    if (draft.treatment !== canonical.treatment || draft.solveability !== canonical.solveability) {
      throw new Error("template_treatment_must_match_canonical_reason");
    }
  }

  if (draft.kind === "reassessment_rule") {
    validateConditionExpression(draft.conditionAst as ConditionExpr);
  }

  if (draft.kind === "alternative_route" && draft.conditionAst !== null) {
    validateConditionExpression(draft.conditionAst as ConditionExpr);
  }

  return draft;
}
