import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  evaluateCondition,
  type ConditionExpr,
  type RecoveryFactValue,
} from "@/lib/recovery/condition-language";
import type {
  RecoveryPolicySnapshot,
  RecoveryPolicySnapshotReason,
} from "@/lib/recovery/policy-snapshot";
import type { RecoveryProductCategory } from "@/lib/recovery/types";

export interface OriginalReturnPolicyInput {
  recoveryJourneyId: string;
  partnerId: string;
  productCategory: RecoveryProductCategory;
  declinedAt: string | null;
  now: Date;
  facts: Record<string, RecoveryFactValue>;
}

interface ReassessmentRuleRow {
  id: string;
  partner_id: string;
  product_category: RecoveryProductCategory;
  canonical_code: string;
  condition_ast: unknown;
  version: number;
  lifecycle: "draft" | "tested" | "published" | "retired";
}

function validSnapshot(value: unknown): value is RecoveryPolicySnapshot {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const snapshot = value as Partial<RecoveryPolicySnapshot>;
  return snapshot.schemaVersion === 1
    && typeof snapshot.partnerId === "string"
    && typeof snapshot.productCategory === "string"
    && Array.isArray(snapshot.partnerReasons);
}

function validPinnedReason(reason: RecoveryPolicySnapshotReason): boolean {
  return reason.reassessmentRuleId === null
    || (
      typeof reason.reassessmentRuleId === "string"
      && reason.reassessmentRuleId.length > 0
      && typeof reason.reassessmentRuleVersion === "number"
      && Number.isInteger(reason.reassessmentRuleVersion)
      && reason.reassessmentRuleVersion > 0
      && typeof reason.canonicalCode === "string"
      && reason.canonicalCode.length > 0
    );
}

function elapsedDays(value: string | null, now: Date): number | null {
  if (!value) return null;
  const started = Date.parse(value);
  if (!Number.isFinite(started) || started > now.getTime()) return null;
  return Math.floor((now.getTime() - started) / 86_400_000);
}

function elapsedCalendarMonths(value: string | null, now: Date): number | null {
  if (!value) return null;
  const started = new Date(value);
  if (!Number.isFinite(started.getTime()) || started.getTime() > now.getTime()) return null;

  let months = (now.getUTCFullYear() - started.getUTCFullYear()) * 12
    + (now.getUTCMonth() - started.getUTCMonth());
  const startedTimeOfDay = ((started.getUTCHours() * 60 + started.getUTCMinutes()) * 60 + started.getUTCSeconds()) * 1000
    + started.getUTCMilliseconds();
  const nowTimeOfDay = ((now.getUTCHours() * 60 + now.getUTCMinutes()) * 60 + now.getUTCSeconds()) * 1000
    + now.getUTCMilliseconds();
  if (
    now.getUTCDate() < started.getUTCDate()
    || (now.getUTCDate() === started.getUTCDate() && nowTimeOfDay < startedTimeOfDay)
  ) months -= 1;
  return Math.max(0, months);
}

/**
 * Applies only the lender's pinned reassessment rule for the original-product
 * return. It does not calculate Credit Quest readiness and it does not govern
 * an independently configured alternative-product route.
 */
export async function isOriginalReturnPolicySatisfied(
  admin: SupabaseClient,
  input: OriginalReturnPolicyInput,
): Promise<boolean> {
  const { data: snapshotRow, error: snapshotError } = await admin
    .from("recovery_policy_snapshots")
    .select("policy_snapshot")
    .eq("recovery_journey_id", input.recoveryJourneyId)
    .maybeSingle();
  if (snapshotError) throw snapshotError;
  if (!snapshotRow?.policy_snapshot) return true;
  if (!validSnapshot(snapshotRow.policy_snapshot)) throw new Error("invalid_recovery_policy_snapshot");

  const snapshot = snapshotRow.policy_snapshot;
  if (snapshot.partnerId !== input.partnerId || snapshot.productCategory !== input.productCategory) {
    throw new Error("recovery_policy_snapshot_scope_mismatch");
  }
  if (!snapshot.partnerReasons.every(validPinnedReason)) {
    throw new Error("invalid_recovery_policy_snapshot");
  }

  const pinnedReasons = snapshot.partnerReasons.filter((reason) => reason.reassessmentRuleId !== null);
  if (pinnedReasons.length === 0) return true;

  const ruleIds = [...new Set(pinnedReasons.map((reason) => reason.reassessmentRuleId as string))];
  const { data: ruleRows, error: rulesError } = await admin
    .from("reassessment_rules")
    .select("id,partner_id,product_category,canonical_code,condition_ast,version,lifecycle")
    .in("id", ruleIds);
  if (rulesError) throw rulesError;

  const rows = (ruleRows ?? []) as ReassessmentRuleRow[];
  const byId = new Map(rows.map((row) => [String(row.id), row]));
  const daysSinceDecline = elapsedDays(input.declinedAt, input.now);
  const monthsSinceDecline = elapsedCalendarMonths(input.declinedAt, input.now);
  const facts: Record<string, RecoveryFactValue> = {
    ...input.facts,
    daysSinceDecline,
    monthsSinceDecline,
  };

  for (const reason of pinnedReasons) {
    const rule = byId.get(reason.reassessmentRuleId as string);
    if (!rule) throw new Error("pinned_reassessment_rule_unavailable");
    if (
      String(rule.partner_id) !== input.partnerId
      || String(rule.product_category) !== input.productCategory
      || String(rule.canonical_code) !== reason.canonicalCode
      || Number(rule.version) !== reason.reassessmentRuleVersion
      || !["published", "retired"].includes(String(rule.lifecycle))
    ) {
      throw new Error("pinned_reassessment_rule_mismatch");
    }

    const result = evaluateCondition(
      rule.condition_ast as ConditionExpr,
      facts,
      reason.parameters,
    );
    if (result !== true) return false;
  }

  return true;
}