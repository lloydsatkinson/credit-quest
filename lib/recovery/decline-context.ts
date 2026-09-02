import type {
  DeclineContext,
  DeclineOrigin,
  DeclineReasonSource,
  RecoveryProductCategory,
} from "@/lib/recovery/types";

export interface BuildDeclineContextInput {
  origin: DeclineOrigin;
  productCategory: RecoveryProductCategory;
  declinedAt: string;
  providerName?: string | null;
  declineReasonProvided: boolean;
  declineReasonCode?: string | null;
  declineReasonSource?: DeclineReasonSource;
  additionalSupportMayBeNeeded?: boolean | null;
}

function normaliseProviderName(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function normaliseReason(input: BuildDeclineContextInput): DeclineContext["reason"] {
  const code = input.declineReasonCode?.trim() ?? "";
  if (!input.declineReasonProvided || code.length === 0) {
    return {
      known: false,
      code: null,
      source: "unknown",
    };
  }

  return {
    known: true,
    code,
    source: input.declineReasonSource
      ?? (input.origin === "partner" ? "partner" : "customer"),
  };
}

export function buildDeclineContext(input: BuildDeclineContextInput): DeclineContext {
  return {
    origin: input.origin,
    productCategory: input.productCategory,
    declinedAt: input.declinedAt,
    providerName: normaliseProviderName(input.providerName),
    reason: normaliseReason(input),
    additionalSupportMayBeNeeded: input.additionalSupportMayBeNeeded ?? null,
  };
}
