import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  CommercialDisclosure,
  CommercialEnvironment,
  CommercialRoute,
} from "@/lib/commercial/types";

export interface CommercialConfiguredRoute extends CommercialRoute {
  partnerEnabled: boolean;
  partnerSandboxEnabled: boolean;
  partnerLiveEnabled: boolean;
}

interface CommercialRouteRow {
  id: string;
  route_key: string;
  partner_id: string;
  environment: CommercialEnvironment;
  destination_url: string;
  enabled: boolean;
  disclosure_key: string;
  commercial_partners:
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

function mapCommercialRoute(row: CommercialRouteRow): CommercialConfiguredRoute {
  const partner = Array.isArray(row.commercial_partners)
    ? row.commercial_partners[0]
    : row.commercial_partners;
  if (!partner) throw new Error("Commercial route partner is missing");

  return {
    id: String(row.id),
    routeKey: String(row.route_key),
    partnerId: String(row.partner_id),
    partnerKey: String(partner.partner_key),
    partnerDisplayName: String(partner.display_name),
    environment: row.environment,
    destinationUrl: String(row.destination_url),
    enabled: row.enabled === true,
    disclosureKey: String(row.disclosure_key),
    partnerEnabled: partner.enabled === true,
    partnerSandboxEnabled: partner.sandbox_enabled === true,
    partnerLiveEnabled: partner.live_enabled === true,
  };
}

const ROUTE_SELECT = [
  "id",
  "route_key",
  "partner_id",
  "environment",
  "destination_url",
  "enabled",
  "disclosure_key",
  "commercial_partners!inner(partner_key,display_name,enabled,sandbox_enabled,live_enabled)",
].join(",");

export async function listCommercialRoutes(
  admin: SupabaseClient,
  environment: CommercialEnvironment,
): Promise<CommercialConfiguredRoute[]> {
  const { data, error } = await admin
    .from("commercial_routes")
    .select(ROUTE_SELECT)
    .eq("environment", environment);
  if (error) throw error;
  return (data ?? []).map((row) => mapCommercialRoute(row as unknown as CommercialRouteRow));
}

export async function getCommercialRoute(
  admin: SupabaseClient,
  routeId: string,
): Promise<CommercialConfiguredRoute | null> {
  const { data, error } = await admin
    .from("commercial_routes")
    .select(ROUTE_SELECT)
    .eq("id", routeId)
    .maybeSingle();
  if (error) throw error;
  return data ? mapCommercialRoute(data as unknown as CommercialRouteRow) : null;
}

export async function getPublishedCommercialDisclosure(
  admin: SupabaseClient,
  disclosureKey: string,
): Promise<CommercialDisclosure | null> {
  const { data, error } = await admin
    .from("commercial_disclosures")
    .select("id,disclosure_key,version,body")
    .eq("disclosure_key", disclosureKey)
    .eq("status", "published")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  return {
    id: String(data.id),
    disclosureKey: String(data.disclosure_key),
    version: Number(data.version),
    body: String(data.body),
  };
}

export interface AppendReferralInput {
  referralKey: string;
  userId: string;
  partnerId: string;
  routeId: string;
  originatingMissionId: string | null;
  readinessSnapshot: "green";
  consentedAt: string;
  disclosureId: string;
  environment: CommercialEnvironment;
  metadata?: Record<string, unknown>;
}

export async function appendReferralAttempt(
  admin: SupabaseClient,
  input: AppendReferralInput,
): Promise<{ id: string }> {
  const { data, error } = await admin
    .from("referral_attempts")
    .insert({
      referral_key: input.referralKey,
      user_id: input.userId,
      partner_id: input.partnerId,
      route_id: input.routeId,
      originating_mission_id: input.originatingMissionId ?? null,
      readiness_snapshot: input.readinessSnapshot,
      consented_at: input.consentedAt,
      disclosure_id: input.disclosureId,
      environment: input.environment,
      metadata: input.metadata ?? {},
    })
    .select("id")
    .single();
  if (error) throw error;
  return { id: String(data.id) };
}

export interface AppendRevenueInput {
  userId: string;
  referralAttemptId: string;
  eventType: "click" | "lead" | "conversion" | "revenue" | "reversal" | "adjustment";
  amountMinor?: number | null;
  currency?: string;
  externalReference?: string | null;
  metadata?: Record<string, unknown>;
  occurredAt: string;
}

export async function appendRevenueEvent(
  admin: SupabaseClient,
  input: AppendRevenueInput,
): Promise<{ id: string }> {
  const { data, error } = await admin
    .from("revenue_events")
    .insert({
      user_id: input.userId,
      referral_attempt_id: input.referralAttemptId,
      event_type: input.eventType,
      amount_minor: input.amountMinor ?? null,
      currency: input.currency ?? "GBP",
      external_reference: input.externalReference ?? null,
      metadata: input.metadata ?? {},
      occurred_at: input.occurredAt,
    })
    .select("id")
    .single();
  if (error) throw error;
  return { id: String(data.id) };
}
