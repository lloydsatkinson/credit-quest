import "server-only";
import { randomUUID } from "node:crypto";
import {
  evaluateCommercialPresentationGate,
  evaluateCommercialReferralGate,
  hasRequiredCommercialEvidence,
} from "@/lib/commercial/gates";
import { orderEquivalentCommercialRoutes } from "@/lib/commercial/ordering";
import type {
  CommercialDisclosure,
  CommercialEnvironment,
  CommercialGateReason,
} from "@/lib/commercial/types";
import { getAgeMode } from "@/lib/domain/age-gate";
import { assessSafety } from "@/lib/domain/safety";
import type { ApplicationReadiness, CreditProfile } from "@/lib/domain/types";
import { getCreditGuidanceForUser } from "@/lib/server/credit-guidance-service";
import { isFeatureEnabled } from "@/lib/server/feature-flag-repository";
import {
  appendReferralAttempt,
  getCommercialRoute,
  getPublishedCommercialDisclosure,
  listCommercialRoutes,
  type AppendReferralInput,
  type CommercialConfiguredRoute,
} from "@/lib/server/commercial-repository";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export type CommercialGatewayErrorCode = CommercialGateReason
  | "configuration_unavailable"
  | "route_unavailable"
  | "disclosure_stale"
  | "invalid_destination";

export class CommercialGatewayError extends Error {
  constructor(public readonly code: CommercialGatewayErrorCode) {
    super(code);
    this.name = "CommercialGatewayError";
  }
}

interface GatewayGuidance {
  profile: CreditProfile;
  readiness: Pick<ApplicationReadiness, "state">;
}

export interface CommercialGatewayDependencies {
  getGuidance(userId: string, now: Date): Promise<GatewayGuidance | null>;
  isGatewayEnabled(): Promise<boolean>;
  isSandboxEnabled(): Promise<boolean>;
  listRoutes(environment: CommercialEnvironment): Promise<CommercialConfiguredRoute[]>;
  getRoute(routeId: string): Promise<CommercialConfiguredRoute | null>;
  getDisclosure(disclosureKey: string): Promise<CommercialDisclosure | null>;
  appendReferral(input: AppendReferralInput): Promise<{ id: string }>;
  makeReferralKey(): string;
  liveAllowed: boolean;
}

function partnerEnvironmentEnabled(
  route: CommercialConfiguredRoute,
  environment: CommercialEnvironment,
): boolean {
  return environment === "sandbox"
    ? route.partnerSandboxEnabled
    : route.partnerLiveEnabled;
}

function runtimeEnabledForEnvironment(
  deps: CommercialGatewayDependencies,
  environment: CommercialEnvironment,
): Promise<boolean> {
  return environment === "sandbox"
    ? deps.isSandboxEnabled()
    : deps.isGatewayEnabled();
}

function gateContext(
  deps: CommercialGatewayDependencies,
  route: CommercialConfiguredRoute,
  guidance: GatewayGuidance,
  environment: CommercialEnvironment,
  disclosure: CommercialDisclosure | null,
  now: Date,
  gatewayEnabled: boolean,
) {
  return {
    gatewayEnabled,
    liveAllowed: deps.liveAllowed,
    environment,
    ageMode: getAgeMode(guidance.profile.dateOfBirth, now),
    safetyMode: assessSafety(guidance.profile).mode,
    readinessState: guidance.readiness.state,
    evidenceComplete: hasRequiredCommercialEvidence(guidance.profile),
    partnerEnabled: route.partnerEnabled,
    partnerEnvironmentEnabled: partnerEnvironmentEnabled(route, environment),
    routeEnabled: route.enabled,
    routeEnvironment: route.environment,
    disclosurePresent: disclosure !== null,
  } as const;
}

function assertValidDestination(route: CommercialConfiguredRoute): void {
  if (route.environment === "sandbox") {
    if (!route.destinationUrl.startsWith("/sandbox/")) {
      throw new CommercialGatewayError("invalid_destination");
    }
    return;
  }

  try {
    const url = new URL(route.destinationUrl);
    if (url.protocol !== "https:") {
      throw new CommercialGatewayError("invalid_destination");
    }
  } catch (error) {
    if (error instanceof CommercialGatewayError) throw error;
    throw new CommercialGatewayError("invalid_destination");
  }
}

export function createCommercialGateway(deps: CommercialGatewayDependencies) {
  return {
    async listPermittedCommercialRoutes(input: {
      userId: string;
      environment: CommercialEnvironment;
      now: Date;
    }) {
      try {
        const [gatewayEnabled, guidance] = await Promise.all([
          runtimeEnabledForEnvironment(deps, input.environment),
          deps.getGuidance(input.userId, input.now),
        ]);
        if (!guidance) return [];

        const routes = orderEquivalentCommercialRoutes(await deps.listRoutes(input.environment));
        const permitted: Array<{
          route: CommercialConfiguredRoute;
          disclosure: CommercialDisclosure;
        }> = [];

        for (const route of routes) {
          const disclosure = await deps.getDisclosure(route.disclosureKey);
          const gate = evaluateCommercialPresentationGate(
            gateContext(
              deps,
              route,
              guidance,
              input.environment,
              disclosure,
              input.now,
              gatewayEnabled,
            ),
          );
          if (gate.permitted && disclosure) permitted.push({ route, disclosure });
        }

        return permitted;
      } catch {
        return [];
      }
    },

    async createCommercialReferral(input: {
      userId: string;
      routeId: string;
      disclosureId: string;
      consent: boolean;
      originatingMissionId: string | null;
      now: Date;
    }) {
      try {
        const [guidance, route] = await Promise.all([
          deps.getGuidance(input.userId, input.now),
          deps.getRoute(input.routeId),
        ]);
        if (!guidance || !route) throw new CommercialGatewayError("route_unavailable");

        const [gatewayEnabled, disclosure] = await Promise.all([
          runtimeEnabledForEnvironment(deps, route.environment),
          deps.getDisclosure(route.disclosureKey),
        ]);
        if (!disclosure) throw new CommercialGatewayError("configuration_unavailable");
        if (disclosure.id !== input.disclosureId) {
          throw new CommercialGatewayError("disclosure_stale");
        }

        const gate = evaluateCommercialReferralGate({
          ...gateContext(
            deps,
            route,
            guidance,
            route.environment,
            disclosure,
            input.now,
            gatewayEnabled,
          ),
          consent: input.consent,
        });
        if (!gate.permitted) throw new CommercialGatewayError(gate.reason);

        assertValidDestination(route);

        const referral = await deps.appendReferral({
          referralKey: deps.makeReferralKey(),
          userId: input.userId,
          partnerId: route.partnerId,
          routeId: route.id,
          originatingMissionId: input.originatingMissionId,
          readinessSnapshot: "green",
          consentedAt: input.now.toISOString(),
          disclosureId: disclosure.id,
          environment: route.environment,
          metadata: {},
        });

        return {
          referralId: referral.id,
          destinationUrl: route.destinationUrl,
        };
      } catch (error) {
        if (error instanceof CommercialGatewayError) throw error;
        throw new CommercialGatewayError("configuration_unavailable");
      }
    },
  };
}

function createProductionCommercialGateway() {
  const admin = createAdminSupabaseClient();
  return createCommercialGateway({
    getGuidance: (userId, now) => getCreditGuidanceForUser(admin, userId, now),
    isGatewayEnabled: () => isFeatureEnabled(admin, "commercial_gateway_enabled"),
    isSandboxEnabled: () => isFeatureEnabled(admin, "commercial_sandbox_enabled"),
    listRoutes: (environment) => listCommercialRoutes(admin, environment),
    getRoute: (routeId) => getCommercialRoute(admin, routeId),
    getDisclosure: (disclosureKey) => getPublishedCommercialDisclosure(admin, disclosureKey),
    appendReferral: (input) => appendReferralAttempt(admin, input),
    makeReferralKey: () => randomUUID(),
    liveAllowed: process.env.LIVE_CREDIT_REFERRALS_ALLOWED === "true",
  });
}

export async function listPermittedCommercialRoutes(input: {
  userId: string;
  environment: CommercialEnvironment;
  now?: Date;
}) {
  const gateway = createProductionCommercialGateway();
  return gateway.listPermittedCommercialRoutes({
    ...input,
    now: input.now ?? new Date(),
  });
}

export async function createCommercialReferral(input: {
  userId: string;
  routeId: string;
  disclosureId: string;
  consent: boolean;
  originatingMissionId: string | null;
  now?: Date;
}) {
  const gateway = createProductionCommercialGateway();
  return gateway.createCommercialReferral({
    ...input,
    now: input.now ?? new Date(),
  });
}
