import type { RecoveryProductCategory } from "@/lib/recovery/types";
import type {
  RecoveryTreatmentClass,
  SolveabilityClass,
} from "@/lib/recovery/decline-taxonomy";

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
