import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  evaluateCondition,
  type ConditionExpr,
  type ConditionResult,
  type RecoveryFactValue,
} from "@/lib/recovery/condition-language";
import type { RecoveryPolicySnapshot } from "@/lib/recovery/policy-snapshot";
import { resolveRecoveryBarriers, type BarrierResolution } from "@/lib/recovery/multi-barrier-resolver";
import type { RecoveryEnvironment, RecoveryProductCategory } from "@/lib/recovery/types";
import type { AlternativeRouteGatePolicy } from "@/lib/recovery/alternative-route";

export interface ReturnRecoveryJourney {
  id: string;
  userId: string;
  origin: "partner";
  productCategory: RecoveryProductCategory;
  partnerId: string;
  returnContractId: string | null;
  originReference: string;
  nextReassessmentAt: string | null;
  declinedAt?: string;
}

export interface ReturnContractConfig {
  id: string;
  contractKey: string;
  partnerId: string;
  partnerDisplayName: string;
  partnerEnabled: boolean;
  partnerSandboxEnabled: boolean;
  partnerLiveEnabled: boolean;
  environment: RecoveryEnvironment;
  destinationUrl: string;
  productCategory: RecoveryProductCategory;
  disclosureKey: string;
  disclosureVersion: number;
  callbackPolicy: "none" | "ready_for_recheck";
  callbackUrl: string | null;
  enabled: boolean;
  expiresAt: string;
}

export interface AppendReturnAttemptInput {
  userId: string;
  recoveryJourneyId: string;
  partnerId: string;
  returnContractId: string;
  environment: RecoveryEnvironment;
  readinessSnapshot: "ready_to_check";
  disclosureKey: string;
  disclosureVersion: number;
  customerChoice: "continue" | "decline";
  outcome: "redirected" | "declined";
  callbackStatus: "not_applicable";
  routeType?: "original" | "alternative";
}

export interface AlternativeRouteContext {
  policy: AlternativeRouteGatePolicy | null;
  barrierResolution: BarrierResolution;
}

export interface AlternativeRouteContextInput {
  recoveryJourneyId: string;
  partnerId: string;
  productCategory: RecoveryProductCategory;
  declinedAt: string | null;
  now: Date;
  facts: Record<string, RecoveryFactValue>;
}

interface ReturnJourneyRow {
  id: string;
  user_id: string;
  origin: "partner" | "direct";
  product_category: RecoveryProductCategory;
  declined_at: string;
  next_reassessment_at: string | null;
  decline_intake_sessions:
    | {
      partner_id: string;
      return_contract_id: string | null;
      origin_reference: string;
    }
    | Array<{
      partner_id: string;
      return_contract_id: string | null;
      origin_reference: string;
    }>
    | null;
}

interface ReturnContractRow {
  id: string;
  contract_key: string;
  partner_id: string;
  environment: RecoveryEnvironment;
  destination_url: string;
  product_category: RecoveryProductCategory;
  disclosure_key: string;
  disclosure_version: number;
  callback_policy: "none" | "ready_for_recheck";
  callback_url: string | null;
  enabled: boolean;
  expires_at: string;
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

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function activeAt(row: Record<string, unknown>, now: Date): boolean {
  const from = Date.parse(String(row.effective_from ?? ""));
  const to = row.effective_to ? Date.parse(String(row.effective_to)) : null;
  return String(row.lifecycle) === "published"
    && Number.isFinite(from)
    && from <= now.getTime()
    && (to === null || (Number.isFinite(to) && now.getTime() < to));
}

function daysSince(value: string | null, now: Date): number | null {
  if (!value) return null;
  const time = Date.parse(value);
  if (!Number.isFinite(time) || time > now.getTime()) return null;
  return Math.floor((now.getTime() - time) / 86_400_000);
}

export async function getReturnToOriginFeatureEnabled(admin: SupabaseClient): Promise<boolean> {
  const { data, error } = await admin
    .from("feature_flags")
    .select("enabled")
    .eq("flag_key", "return_to_origin_enabled")
    .maybeSingle();
  if (error) throw error;
  return data?.enabled === true;
}

export async function getReturnRecoveryJourney(
  admin: SupabaseClient,
  userId: string,
  recoveryJourneyId: string,
): Promise<ReturnRecoveryJourney | null> {
  const { data, error } = await admin
    .from("decline_recovery_journeys")
    .select([
      "id",
      "user_id",
      "origin",
      "product_category",
      "declined_at",
      "next_reassessment_at",
      "decline_intake_sessions!inner(partner_id,return_contract_id,origin_reference)",
    ].join(","))
    .eq("id", recoveryJourneyId)
    .eq("user_id", userId)
    .eq("origin", "partner")
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const row = data as unknown as ReturnJourneyRow;
  const intake = Array.isArray(row.decline_intake_sessions)
    ? row.decline_intake_sessions[0]
    : row.decline_intake_sessions;
  if (!intake || row.origin !== "partner") return null;

  return {
    id: String(row.id),
    userId: String(row.user_id),
    origin: "partner",
    productCategory: row.product_category,
    partnerId: String(intake.partner_id),
    returnContractId: intake.return_contract_id ? String(intake.return_contract_id) : null,
    originReference: String(intake.origin_reference),
    nextReassessmentAt: row.next_reassessment_at ? String(row.next_reassessment_at) : null,
    declinedAt: String(row.declined_at),
  };
}

export async function getReturnContract(
  admin: SupabaseClient,
  contractId: string,
): Promise<ReturnContractConfig | null> {
  const { data, error } = await admin
    .from("return_contracts")
    .select([
      "id",
      "contract_key",
      "partner_id",
      "environment",
      "destination_url",
      "product_category",
      "disclosure_key",
      "disclosure_version",
      "callback_policy",
      "callback_url",
      "enabled",
      "expires_at",
      "decline_partners!inner(display_name,enabled,sandbox_enabled,live_enabled)",
    ].join(","))
    .eq("id", contractId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const row = data as unknown as ReturnContractRow;
  const partner = Array.isArray(row.decline_partners)
    ? row.decline_partners[0]
    : row.decline_partners;
  if (!partner) return null;

  return {
    id: String(row.id),
    contractKey: String(row.contract_key),
    partnerId: String(row.partner_id),
    partnerDisplayName: String(partner.display_name),
    partnerEnabled: partner.enabled === true,
    partnerSandboxEnabled: partner.sandbox_enabled === true,
    partnerLiveEnabled: partner.live_enabled === true,
    environment: row.environment,
    destinationUrl: String(row.destination_url),
    productCategory: row.product_category,
    disclosureKey: String(row.disclosure_key),
    disclosureVersion: Number(row.disclosure_version),
    callbackPolicy: row.callback_policy,
    callbackUrl: row.callback_url ? String(row.callback_url) : null,
    enabled: row.enabled === true,
    expiresAt: String(row.expires_at),
  };
}

export async function getAlternativeRouteContext(
  admin: SupabaseClient,
  input: AlternativeRouteContextInput,
): Promise<AlternativeRouteContext | null> {
  const { data: snapshotRow, error: snapshotError } = await admin
    .from("recovery_policy_snapshots")
    .select("policy_snapshot")
    .eq("recovery_journey_id", input.recoveryJourneyId)
    .maybeSingle();
  if (snapshotError) throw snapshotError;
  if (!snapshotRow?.policy_snapshot) return null;

  const snapshot = snapshotRow.policy_snapshot as RecoveryPolicySnapshot;
  if (
    snapshot.partnerId !== input.partnerId
    || snapshot.productCategory !== input.productCategory
    || !snapshot.usePartnerReasonsForTreatment
  ) return null;

  const reasonCodes = snapshot.partnerReasons.map((reason) => reason.canonicalCode ?? reason.externalCode);
  const barrierResolution = resolveRecoveryBarriers({ reasonCodes });
  const routeIds = [...new Set(snapshot.partnerReasons.flatMap((reason) => reason.alternativeRoutePolicyIds))];
  if (routeIds.length === 0) return null;

  const { data, error } = await admin
    .from("alternative_route_policies")
    .select("*")
    .in("id", routeIds);
  if (error) throw error;

  const pinnedByCanonical = new Map<string, Set<string>>();
  for (const reason of snapshot.partnerReasons) {
    if (!reason.canonicalCode) continue;
    const set = pinnedByCanonical.get(reason.canonicalCode) ?? new Set<string>();
    for (const id of reason.alternativeRoutePolicyIds) set.add(id);
    pinnedByCanonical.set(reason.canonicalCode, set);
  }

  const rows = (data ?? [])
    .map((value) => record(value))
    .filter((row) => (
      String(row.partner_id) === input.partnerId
      && String(row.product_category) === input.productCategory
      && routeIds.includes(String(row.id))
      && pinnedByCanonical.get(String(row.canonical_code))?.has(String(row.id))
    ))
    .sort((left, right) => Number(left.route_priority ?? 100) - Number(right.route_priority ?? 100)
      || String(left.id).localeCompare(String(right.id)));

  const row = rows[0];
  if (!row) return { policy: null, barrierResolution };

  const declineDays = daysSince(input.declinedAt, input.now);
  const facts: Record<string, RecoveryFactValue> = {
    ...input.facts,
    daysSinceDecline: declineDays,
  };
  let conditionResult: ConditionResult = true;
  if (row.condition_ast !== null && row.condition_ast !== undefined) {
    try {
      conditionResult = evaluateCondition(row.condition_ast as ConditionExpr, facts, {});
    } catch {
      conditionResult = "unknown";
    }
  }

  const minWaitDays = row.min_wait_days === null || row.min_wait_days === undefined
    ? null
    : Number(row.min_wait_days);
  const minimumWaitComplete = minWaitDays === null
    ? true
    : declineDays !== null && Number.isFinite(minWaitDays) && declineDays >= minWaitDays;

  return {
    barrierResolution,
    policy: {
      id: String(row.id),
      canonicalCode: String(row.canonical_code),
      destinationProductKey: String(row.destination_product_key),
      returnContractId: row.return_contract_id ? String(row.return_contract_id) : null,
      conditionResult,
      minimumWaitComplete,
      active: activeAt(row, input.now),
    },
  };
}

export async function appendReturnAttempt(
  admin: SupabaseClient,
  input: AppendReturnAttemptInput,
): Promise<{ id: string }> {
  const { data, error } = await admin
    .from("return_attempts")
    .insert({
      user_id: input.userId,
      recovery_journey_id: input.recoveryJourneyId,
      partner_id: input.partnerId,
      return_contract_id: input.returnContractId,
      environment: input.environment,
      readiness_snapshot: input.readinessSnapshot,
      disclosure_key: input.disclosureKey,
      disclosure_version: input.disclosureVersion,
      customer_choice: input.customerChoice,
      outcome: input.outcome,
      callback_status: input.callbackStatus,
      route_type: input.routeType ?? "original",
    })
    .select("id")
    .single();
  if (error) throw error;
  return { id: String(data.id) };
}

// V2.0d has no separate suppression store yet. Safety, readiness, evidence and
// dated cooldown gates remain authoritative; this hook exists as the explicit
// extension point for a later independently modelled suppression source.
export async function isReturnSuppressionClear(
  _admin: SupabaseClient,
  _userId: string,
  _recoveryJourneyId: string,
  _now: Date,
): Promise<boolean> {
  return true;
}
