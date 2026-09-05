import "server-only";
import { hasRequiredCommercialEvidence } from "@/lib/commercial/gates";
import type { CommercialDisclosure } from "@/lib/commercial/types";
import { getAgeMode } from "@/lib/domain/age-gate";
import { assessSafety } from "@/lib/domain/safety";
import type { ApplicationReadiness, CreditProfile } from "@/lib/domain/types";
import { evaluateReturnToOriginGate } from "@/lib/recovery/return-gate";
import { toRecoveryReadinessState } from "@/lib/recovery/readiness";
import type { ReturnGateReason } from "@/lib/recovery/types";
import { getPublishedCommercialDisclosure } from "@/lib/server/commercial-repository";
import { getCreditGuidanceForUser } from "@/lib/server/credit-guidance-service";
import {
  appendReturnAttempt,
  getReturnContract,
  getReturnRecoveryJourney,
  getReturnToOriginFeatureEnabled,
  isReturnSuppressionClear,
  type AppendReturnAttemptInput,
  type ReturnContractConfig,
  type ReturnRecoveryJourney,
} from "@/lib/server/return-origin-repository";
import { isSandboxPilot } from "@/lib/server/sandbox-pilot-repository";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export type ReturnOriginGatewayErrorCode = ReturnGateReason
  | "pilot_required"
  | "recovery_unavailable"
  | "contract_unavailable"
  | "contract_mismatch"
  | "invalid_destination"
  | "configuration_unavailable";

export type ReturnOriginAvailability =
  | {
      status: "unavailable";
      reason: "recovery_unavailable" | "contract_unavailable";
      partnerDisplayName: null;
    }
  | {
      status: "blocked";
      reason: ReturnOriginGatewayErrorCode;
      partnerDisplayName: string | null;
    }
  | {
      status: "available";
      reason: null;
      partnerDisplayName: string;
    };

export class ReturnOriginGatewayError extends Error {
  constructor(public readonly code: ReturnOriginGatewayErrorCode) {
    super(code);
    this.name = "ReturnOriginGatewayError";
  }
}

interface ReturnGuidance {
  profile: CreditProfile;
  readiness: Pick<ApplicationReadiness, "state">;
}

export interface ReturnOriginGatewayDependencies {
  getGuidance(userId: string, now: Date): Promise<ReturnGuidance | null>;
  getRecoveryJourney(userId: string, recoveryJourneyId: string): Promise<ReturnRecoveryJourney | null>;
  getReturnContract(contractId: string): Promise<ReturnContractConfig | null>;
  getDisclosure(disclosureKey: string): Promise<CommercialDisclosure | null>;
  isGatewayEnabled(): Promise<boolean>;
  isSandboxPilot(userId: string): Promise<boolean>;
  isSuppressionClear(userId: string, recoveryJourneyId: string, now: Date): Promise<boolean>;
  appendReturnAttempt(input: AppendReturnAttemptInput): Promise<{ id: string }>;
  liveAllowed: boolean;
}

interface ReturnEvaluationSuccess {
  permitted: true;
  journey: ReturnRecoveryJourney;
  contract: ReturnContractConfig;
}

interface ReturnEvaluationFailure {
  permitted: false;
  code: ReturnOriginGatewayErrorCode;
  partnerDisplayName: string | null;
}

type ReturnEvaluation = ReturnEvaluationSuccess | ReturnEvaluationFailure;

function cooldownComplete(journey: ReturnRecoveryJourney, now: Date): boolean {
  if (!journey.nextReassessmentAt) return true;
  const reassessmentAt = Date.parse(journey.nextReassessmentAt);
  return Number.isFinite(reassessmentAt) && reassessmentAt <= now.getTime();
}

function partnerEnvironmentEnabled(contract: ReturnContractConfig): boolean {
  return contract.environment === "sandbox"
    ? contract.partnerSandboxEnabled
    : contract.partnerLiveEnabled;
}

function assertContractMatchesJourney(
  journey: ReturnRecoveryJourney,
  contract: ReturnContractConfig,
): void {
  if (
    journey.returnContractId !== contract.id
    || journey.partnerId !== contract.partnerId
    || journey.productCategory !== contract.productCategory
  ) {
    throw new ReturnOriginGatewayError("contract_mismatch");
  }
}

function assertValidDestination(contract: ReturnContractConfig): void {
  if (contract.environment === "sandbox") {
    if (!contract.destinationUrl.startsWith("/sandbox/") || contract.destinationUrl.startsWith("//")) {
      throw new ReturnOriginGatewayError("invalid_destination");
    }
    return;
  }

  try {
    const url = new URL(contract.destinationUrl);
    if (url.protocol !== "https:") throw new Error("invalid protocol");
  } catch {
    throw new ReturnOriginGatewayError("invalid_destination");
  }
}

export function buildMinimalReturnCallbackPayload(input: {
  returnAttemptId: string;
  originReference: string;
}) {
  return {
    event: "recovery_ready_for_recheck" as const,
    returnAttemptId: input.returnAttemptId,
    originReference: input.originReference,
  };
}

async function evaluateReturnContext(
  deps: ReturnOriginGatewayDependencies,
  input: {
    userId: string;
    recoveryJourneyId: string;
    now: Date;
  },
): Promise<ReturnEvaluation> {
  let partnerDisplayName: string | null = null;

  try {
    const [gatewayEnabled, guidance, journey] = await Promise.all([
      deps.isGatewayEnabled(),
      deps.getGuidance(input.userId, input.now),
      deps.getRecoveryJourney(input.userId, input.recoveryJourneyId),
    ]);

    if (!gatewayEnabled) {
      return { permitted: false, code: "gateway_disabled", partnerDisplayName: null };
    }

    if (!guidance || !journey || journey.origin !== "partner" || !journey.returnContractId) {
      return { permitted: false, code: "recovery_unavailable", partnerDisplayName: null };
    }

    const contract = await deps.getReturnContract(journey.returnContractId);
    if (!contract) {
      return { permitted: false, code: "contract_unavailable", partnerDisplayName: null };
    }
    partnerDisplayName = contract.partnerDisplayName;

    assertContractMatchesJourney(journey, contract);

    if (contract.environment === "sandbox" && !(await deps.isSandboxPilot(input.userId))) {
      return { permitted: false, code: "pilot_required", partnerDisplayName };
    }

    const [disclosure, suppressionClear] = await Promise.all([
      deps.getDisclosure(contract.disclosureKey),
      deps.isSuppressionClear(input.userId, input.recoveryJourneyId, input.now),
    ]);

    const disclosureCurrent = Boolean(
      disclosure
      && disclosure.disclosureKey === contract.disclosureKey
      && disclosure.version === contract.disclosureVersion,
    );

    const gate = evaluateReturnToOriginGate({
      enabled: gatewayEnabled,
      liveAllowed: deps.liveAllowed,
      environment: contract.environment,
      ageMode: getAgeMode(guidance.profile.dateOfBirth, input.now),
      safetyMode: assessSafety(guidance.profile).mode,
      evidenceComplete: hasRequiredCommercialEvidence(guidance.profile),
      readinessState: toRecoveryReadinessState(guidance.readiness.state),
      cooldownComplete: cooldownComplete(journey, input.now),
      suppressionClear,
      disclosureCurrent,
      // Availability evaluates whether the customer could be offered the choice.
      // The actual createReturn path still requires an explicit continue/decline.
      customerChoseReturn: true,
      partnerEnabled: contract.partnerEnabled,
      partnerEnvironmentEnabled: partnerEnvironmentEnabled(contract),
      contractEnabled: contract.enabled,
      contractEnvironment: contract.environment,
      contractExpiresAt: contract.expiresAt,
      now: input.now,
    });

    if (!gate.permitted) {
      return { permitted: false, code: gate.reason, partnerDisplayName };
    }

    assertValidDestination(contract);

    return {
      permitted: true,
      journey,
      contract,
    };
  } catch (error) {
    if (error instanceof ReturnOriginGatewayError) {
      return { permitted: false, code: error.code, partnerDisplayName };
    }
    return { permitted: false, code: "configuration_unavailable", partnerDisplayName };
  }
}

export function createReturnOriginGateway(deps: ReturnOriginGatewayDependencies) {
  return {
    async getAvailability(input: {
      userId: string;
      recoveryJourneyId: string;
      now: Date;
    }): Promise<ReturnOriginAvailability> {
      const evaluation = await evaluateReturnContext(deps, input);

      if (evaluation.permitted) {
        return {
          status: "available",
          reason: null,
          partnerDisplayName: evaluation.contract.partnerDisplayName,
        };
      }

      if (evaluation.code === "recovery_unavailable" || evaluation.code === "contract_unavailable") {
        return {
          status: "unavailable",
          reason: evaluation.code,
          partnerDisplayName: null,
        };
      }

      return {
        status: "blocked",
        reason: evaluation.code,
        partnerDisplayName: evaluation.partnerDisplayName,
      };
    },

    async createReturn(input: {
      userId: string;
      recoveryJourneyId: string;
      customerChoice: "continue" | "decline";
      now: Date;
    }) {
      try {
        const evaluation = await evaluateReturnContext(deps, input);
        if (!evaluation.permitted) {
          throw new ReturnOriginGatewayError(evaluation.code);
        }

        const { journey, contract } = evaluation;
        const attempt = await deps.appendReturnAttempt({
          userId: input.userId,
          recoveryJourneyId: journey.id,
          partnerId: journey.partnerId,
          returnContractId: contract.id,
          environment: contract.environment,
          readinessSnapshot: "ready_to_check",
          disclosureKey: contract.disclosureKey,
          disclosureVersion: contract.disclosureVersion,
          customerChoice: input.customerChoice,
          outcome: input.customerChoice === "continue" ? "redirected" : "declined",
          callbackStatus: "not_applicable",
        });

        if (input.customerChoice === "decline") {
          return { status: "declined" as const, returnAttemptId: attempt.id };
        }

        return {
          status: "redirect" as const,
          returnAttemptId: attempt.id,
          destinationUrl: contract.destinationUrl,
          partnerDisplayName: contract.partnerDisplayName,
        };
      } catch (error) {
        if (error instanceof ReturnOriginGatewayError) throw error;
        throw new ReturnOriginGatewayError("configuration_unavailable");
      }
    },
  };
}

function createProductionReturnOriginGateway() {
  const admin = createAdminSupabaseClient();
  return createReturnOriginGateway({
    getGuidance: (userId, now) => getCreditGuidanceForUser(admin, userId, now),
    getRecoveryJourney: (userId, recoveryJourneyId) =>
      getReturnRecoveryJourney(admin, userId, recoveryJourneyId),
    getReturnContract: (contractId) => getReturnContract(admin, contractId),
    getDisclosure: (disclosureKey) => getPublishedCommercialDisclosure(admin, disclosureKey),
    isGatewayEnabled: () => getReturnToOriginFeatureEnabled(admin),
    isSandboxPilot: (userId) => isSandboxPilot(admin, userId),
    isSuppressionClear: (userId, recoveryJourneyId, now) =>
      isReturnSuppressionClear(admin, userId, recoveryJourneyId, now),
    appendReturnAttempt: (input) => appendReturnAttempt(admin, input),
    // V2.0d deliberately hard-locks live Return-to-Origin off.
    liveAllowed: false,
  });
}

export async function getReturnOriginAvailability(input: {
  userId: string;
  recoveryJourneyId: string;
  now?: Date;
}) {
  return createProductionReturnOriginGateway().getAvailability({
    userId: input.userId,
    recoveryJourneyId: input.recoveryJourneyId,
    now: input.now ?? new Date(),
  });
}

export async function createReturnToOrigin(input: {
  userId: string;
  recoveryJourneyId: string;
  customerChoice: "continue" | "decline";
  now?: Date;
}) {
  return createProductionReturnOriginGateway().createReturn({
    ...input,
    now: input.now ?? new Date(),
  });
}
