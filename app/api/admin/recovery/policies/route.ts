import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminUser } from "@/lib/server/admin-auth";
import { saveRecoveryPolicyDraft } from "@/lib/server/decline-policy-repository";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

const productCategorySchema = z.enum(["credit_card", "loan", "overdraft", "mortgage", "other"]);
const treatmentSchema = z.enum(["fix", "build", "stabilise", "create_headroom", "wait_and_rebuild", "longer_term_recovery", "find_a_better_fit", "needs_evidence", "restricted"]);
const solveabilitySchema = z.enum(["fix_now", "build_evidence", "stabilise_first", "time_bound", "structural_long_horizon", "product_routeable", "unknown_or_unmapped", "restricted"]);
const scalarSchema = z.union([z.string(), z.number().finite(), z.boolean(), z.null()]);
const parameterScalarSchema = z.union([z.string(), z.number().finite(), z.boolean()]);

const comparisonSchema = z.object({
  op: z.enum(["eq", "neq", "gt", "gte", "lt", "lte"]),
  fact: z.string().trim().min(1).max(80),
  value: scalarSchema.optional(),
  parameter: z.string().trim().min(1).max(80).optional(),
}).strict().superRefine((value, context) => {
  if ((value.value === undefined) === (value.parameter === undefined)) {
    context.addIssue({ code: "custom", message: "Exactly one comparison target is required" });
  }
});

const conditionSchema: z.ZodTypeAny = z.lazy(() => z.union([
  comparisonSchema,
  z.object({ op: z.literal("and"), all: z.array(conditionSchema).min(1).max(16) }).strict(),
  z.object({ op: z.literal("or"), any: z.array(conditionSchema).min(1).max(16) }).strict(),
]));

const templateStepSchema = z.object({
  phase: z.enum(["now", "next", "then", "later"]),
  stepType: z.enum(["action", "education", "wait", "evidence", "correction", "reassessment"]),
  priority: z.number().int().min(0).max(10000),
  customerWording: z.string().trim().min(1).max(500),
  missionSlug: z.string().trim().min(1).max(120).nullable(),
  minWaitDays: z.number().int().min(0).max(3650).nullable(),
  blocking: z.boolean(),
  requirementStatus: z.enum(["required", "recommended", "informational"]),
}).strict();

const mappingDraftSchema = z.object({
  id: z.string().uuid().optional(),
  kind: z.literal("mapping"),
  partnerId: z.string().uuid(),
  productCategory: productCategorySchema,
  externalCode: z.string().trim().min(1).max(120),
  canonicalCode: z.string().trim().min(1).max(120),
  parameters: z.record(z.string(), parameterScalarSchema).default({}),
  lenderWording: z.string().max(500).nullable(),
  version: z.number().int().min(1).max(10000),
}).strict();

const templateDraftSchema = z.object({
  id: z.string().uuid().optional(),
  kind: z.literal("template"),
  templateKey: z.string().trim().min(1).max(120),
  canonicalCode: z.string().trim().min(1).max(120),
  treatment: treatmentSchema,
  solveability: solveabilitySchema,
  severity: z.enum(["low", "medium", "high", "structural"]),
  recoveryHorizon: z.enum(["immediate", "short", "medium", "long", "structural_indeterminate"]),
  customerHeadline: z.string().max(240),
  customerExplanation: z.string().max(1500),
  version: z.number().int().min(1).max(10000),
  steps: z.array(templateStepSchema).max(12).optional(),
}).strict();

const reassessmentDraftSchema = z.object({
  id: z.string().uuid().optional(),
  kind: z.literal("reassessment_rule"),
  partnerId: z.string().uuid(),
  productCategory: productCategorySchema,
  canonicalCode: z.string().trim().min(1).max(120),
  conditionAst: conditionSchema,
  version: z.number().int().min(1).max(10000),
}).strict();

const alternativeRouteDraftSchema = z.object({
  id: z.string().uuid().optional(),
  kind: z.literal("alternative_route"),
  partnerId: z.string().uuid(),
  productCategory: productCategorySchema,
  canonicalCode: z.string().trim().min(1).max(120),
  sourceProductKey: z.string().trim().min(1).max(120).nullable(),
  destinationProductKey: z.string().trim().min(1).max(120),
  returnContractId: z.string().uuid().nullable(),
  conditionAst: conditionSchema.nullable(),
  minWaitDays: z.number().int().min(0).max(3650).nullable(),
  routePriority: z.number().int().min(0).max(10000),
  version: z.number().int().min(1).max(10000),
}).strict();

export const recoveryPolicyDraftSchema = z.discriminatedUnion("kind", [
  mappingDraftSchema,
  templateDraftSchema,
  reassessmentDraftSchema,
  alternativeRouteDraftSchema,
]);

export async function POST(request: Request) {
  const adminUser = await requireAdminUser();
  const parsed = recoveryPolicyDraftSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid recovery policy draft" }, { status: 400 });
  try {
    const id = await saveRecoveryPolicyDraft(createAdminSupabaseClient(), adminUser.id, parsed.data);
    return NextResponse.json({ id });
  } catch (error) {
    if (error instanceof Error && /draft_only|not_found/.test(error.message)) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    throw error;
  }
}
