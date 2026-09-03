import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ApplicationReadiness, CreditProfile } from "@/lib/domain/types";
import {
  buildMinimalReturnCallbackPayload,
  createReturnOriginGateway,
  ReturnOriginGatewayError,
} from "@/lib/server/return-origin-gateway";

const routeMocks = vi.hoisted(() => ({
  createServerSupabaseClient: vi.fn(),
  createReturnToOrigin: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: routeMocks.createServerSupabaseClient,
}));
vi.mock("@/lib/server/return-origin-gateway", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/server/return-origin-gateway")>();
  return { ...actual, createReturnToOrigin: routeMocks.createReturnToOrigin };
});

const profile: CreditProfile = {
  userId: "user-1",
  dateOfBirth: "1990-01-01",
  employmentStatus: "employed",
  incomeBand: "30_50k",
  housingStatus: "rent",
  electoralRoll: true,
  utilisationPct: 22,
  missedPaymentsLast12m: 0,
  hardApplicationsLast6m: 0,
  hasRevolvingCredit: true,
  hasDirectDebitForCredit: true,
};

function readiness(state: ApplicationReadiness["state"] = "green"): ApplicationReadiness {
  return {
    state,
    headline: state,
    reasons: [],
    avoid: [],
    actions: [],
    reassessAt: null,
    daysUntilReassessment: null,
  };
}

const journey = {
  id: "recovery-1",
  userId: "user-1",
  origin: "partner" as const,
  productCategory: "credit_card" as const,
  partnerId: "partner-1",
  returnContractId: "contract-1",
  originReference: "origin-ref-1",
  nextReassessmentAt: null,
};

const contract = {
  id: "contract-1",
  contractKey: "return-card-1",
  partnerId: "partner-1",
  partnerDisplayName: "Example Bank",
  partnerEnabled: true,
  partnerSandboxEnabled: true,
  partnerLiveEnabled: false,
  environment: "sandbox" as const,
  destinationUrl: "/sandbox/referral-complete",
  productCategory: "credit_card" as const,
  disclosureKey: "return-to-origin",
  disclosureVersion: 2,
  callbackPolicy: "ready_for_recheck" as const,
  callbackUrl: "https://partner.example/callback",
  enabled: true,
  expiresAt: "2026-10-01T00:00:00.000Z",
};

const disclosure = {
  id: "disclosure-2",
  disclosureKey: "return-to-origin",
  version: 2,
  body: "You are ready to check eligibility again. Approval is not guaranteed.",
};

function deps(overrides: Record<string, unknown> = {}) {
  return {
    getGuidance: vi.fn().mockResolvedValue({ profile, readiness: readiness("green") }),
    getRecoveryJourney: vi.fn().mockResolvedValue(journey),
    getReturnContract: vi.fn().mockResolvedValue(contract),
    getDisclosure: vi.fn().mockResolvedValue(disclosure),
    isGatewayEnabled: vi.fn().mockResolvedValue(true),
    isSandboxPilot: vi.fn().mockResolvedValue(true),
    isSuppressionClear: vi.fn().mockResolvedValue(true),
    appendReturnAttempt: vi.fn().mockResolvedValue({ id: "attempt-1" }),
    liveAllowed: false,
    ...overrides,
  };
}

async function expectCode(gateway: ReturnType<typeof createReturnOriginGateway>, code: string) {
  await expect(gateway.createReturn({
    userId: "user-1",
    recoveryJourneyId: "recovery-1",
    customerChoice: "continue",
    now: new Date("2026-09-03T09:00:00.000Z"),
  })).rejects.toMatchObject({ code });
}

describe("sandbox Return-to-Origin gateway", () => {
  it("re-fetches current guidance and returns only the server-owned sandbox destination when every gate passes", async () => {
    const d = deps();
    const gateway = createReturnOriginGateway(d);

    const result = await gateway.createReturn({
      userId: "user-1",
      recoveryJourneyId: "recovery-1",
      customerChoice: "continue",
      now: new Date("2026-09-03T09:00:00.000Z"),
    });

    expect(d.getGuidance).toHaveBeenCalledWith("user-1", new Date("2026-09-03T09:00:00.000Z"));
    expect(result).toEqual({
      status: "redirect",
      returnAttemptId: "attempt-1",
      destinationUrl: "/sandbox/referral-complete",
      partnerDisplayName: "Example Bank",
    });
    expect(d.appendReturnAttempt).toHaveBeenCalledWith(expect.objectContaining({
      userId: "user-1",
      recoveryJourneyId: "recovery-1",
      partnerId: "partner-1",
      returnContractId: "contract-1",
      environment: "sandbox",
      readinessSnapshot: "ready_to_check",
      disclosureKey: "return-to-origin",
      disclosureVersion: 2,
      customerChoice: "continue",
      outcome: "redirected",
      callbackStatus: "not_applicable",
    }));
  });

  it("fails closed when the runtime flag or sandbox pilot gate is off", async () => {
    await expectCode(createReturnOriginGateway(deps({
      isGatewayEnabled: vi.fn().mockResolvedValue(false),
    })), "gateway_disabled");

    await expectCode(createReturnOriginGateway(deps({
      isSandboxPilot: vi.fn().mockResolvedValue(false),
    })), "pilot_required");
  });

  it("re-runs age, Safe Mode, evidence and readiness from current Credit Quest guidance", async () => {
    const under18 = { ...profile, dateOfBirth: "2012-01-01" };
    await expectCode(createReturnOriginGateway(deps({
      getGuidance: vi.fn().mockResolvedValue({ profile: under18, readiness: readiness("green") }),
    })), "under_18");

    const unsafe = { ...profile, missedPaymentsLast12m: 2, hardApplicationsLast6m: 3 };
    await expectCode(createReturnOriginGateway(deps({
      getGuidance: vi.fn().mockResolvedValue({ profile: unsafe, readiness: readiness("green") }),
    })), "safe_mode");

    const missingEvidence = { ...profile, hardApplicationsLast6m: null };
    await expectCode(createReturnOriginGateway(deps({
      getGuidance: vi.fn().mockResolvedValue({ profile: missingEvidence, readiness: readiness("green") }),
    })), "missing_evidence");

    await expectCode(createReturnOriginGateway(deps({
      getGuidance: vi.fn().mockResolvedValue({ profile, readiness: readiness("amber") }),
    })), "readiness_not_ready_to_check");
  });

  it("blocks while a genuine recovery reassessment/cooldown date is still in the future", async () => {
    await expectCode(createReturnOriginGateway(deps({
      getRecoveryJourney: vi.fn().mockResolvedValue({
        ...journey,
        nextReassessmentAt: "2026-09-10T09:00:00.000Z",
      }),
    })), "cooldown_active");
  });

  it("blocks unresolved suppression and stale/mismatched disclosures", async () => {
    await expectCode(createReturnOriginGateway(deps({
      isSuppressionClear: vi.fn().mockResolvedValue(false),
    })), "suppressed");

    await expectCode(createReturnOriginGateway(deps({
      getDisclosure: vi.fn().mockResolvedValue({ ...disclosure, version: 3 }),
    })), "disclosure_stale");
  });

  it("re-checks partner, environment and contract kill switches immediately before return", async () => {
    await expectCode(createReturnOriginGateway(deps({
      getReturnContract: vi.fn().mockResolvedValue({ ...contract, partnerEnabled: false }),
    })), "partner_disabled");

    await expectCode(createReturnOriginGateway(deps({
      getReturnContract: vi.fn().mockResolvedValue({ ...contract, enabled: false }),
    })), "contract_disabled");

    await expectCode(createReturnOriginGateway(deps({
      getReturnContract: vi.fn().mockResolvedValue({ ...contract, environment: "live", partnerLiveEnabled: true }),
    })), "live_not_allowed");

    await expectCode(createReturnOriginGateway(deps({
      getReturnContract: vi.fn().mockResolvedValue({ ...contract, expiresAt: "2026-09-03T08:59:59.000Z" }),
    })), "contract_expired");
  });

  it("rejects a contract that does not belong to the partner/product context on the recovery journey", async () => {
    await expectCode(createReturnOriginGateway(deps({
      getReturnContract: vi.fn().mockResolvedValue({ ...contract, partnerId: "partner-2" }),
    })), "contract_mismatch");

    await expectCode(createReturnOriginGateway(deps({
      getReturnContract: vi.fn().mockResolvedValue({ ...contract, productCategory: "loan" }),
    })), "contract_mismatch");
  });

  it("rejects invalid destinations even if configuration is corrupted", async () => {
    await expectCode(createReturnOriginGateway(deps({
      getReturnContract: vi.fn().mockResolvedValue({ ...contract, destinationUrl: "https://attacker.example/steal" }),
    })), "invalid_destination");
  });

  it("records an explicit customer decline without producing a redirect", async () => {
    const d = deps();
    const gateway = createReturnOriginGateway(d);
    const result = await gateway.createReturn({
      userId: "user-1",
      recoveryJourneyId: "recovery-1",
      customerChoice: "decline",
      now: new Date("2026-09-03T09:00:00.000Z"),
    });

    expect(result).toEqual({ status: "declined", returnAttemptId: "attempt-1" });
    expect(d.appendReturnAttempt).toHaveBeenCalledWith(expect.objectContaining({
      customerChoice: "decline",
      outcome: "declined",
      readinessSnapshot: "ready_to_check",
    }));
  });

  it("builds a deliberately minimal callback payload but does not send it", () => {
    expect(buildMinimalReturnCallbackPayload({
      returnAttemptId: "attempt-1",
      originReference: "origin-ref-1",
    })).toEqual({
      event: "recovery_ready_for_recheck",
      returnAttemptId: "attempt-1",
      originReference: "origin-ref-1",
    });
    expect(JSON.stringify(buildMinimalReturnCallbackPayload({
      returnAttemptId: "attempt-1",
      originReference: "origin-ref-1",
    }))).not.toMatch(/passport|support|vulnerab|mission|userId|reason|profile/i);
  });
});

describe("Return-to-Origin API trust boundary", () => {
  beforeEach(() => {
    routeMocks.createServerSupabaseClient.mockReset();
    routeMocks.createReturnToOrigin.mockReset();
  });

  it("accepts only journey id + explicit choice and rejects browser-owned partner/environment/destination fields", async () => {
    const { returnToOriginSchema } = await import("@/app/api/recovery/return/route");
    expect(returnToOriginSchema.safeParse({
      recoveryJourneyId: "a6d4e69a-73bf-4a02-b196-4117be8e8722",
      customerChoice: "continue",
    }).success).toBe(true);

    for (const extra of [
      { partnerId: "partner-1" },
      { environment: "sandbox" },
      { destinationUrl: "/sandbox/evil" },
      { callbackUrl: "https://attacker.example" },
      { readinessState: "ready_to_check" },
      { userId: "other-user" },
    ]) {
      expect(returnToOriginSchema.safeParse({
        recoveryJourneyId: "a6d4e69a-73bf-4a02-b196-4117be8e8722",
        customerChoice: "continue",
        ...extra,
      }).success).toBe(false);
    }
  });

  it("derives ownership from the authenticated session and never accepts an anonymous return", async () => {
    const { POST } = await import("@/app/api/recovery/return/route");
    routeMocks.createServerSupabaseClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    });

    const unauth = await POST(new Request("http://local/api/recovery/return", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        recoveryJourneyId: "a6d4e69a-73bf-4a02-b196-4117be8e8722",
        customerChoice: "continue",
      }),
    }));
    expect(unauth.status).toBe(401);
    expect(routeMocks.createReturnToOrigin).not.toHaveBeenCalled();

    routeMocks.createServerSupabaseClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }) },
    });
    routeMocks.createReturnToOrigin.mockResolvedValue({
      status: "redirect",
      returnAttemptId: "attempt-1",
      destinationUrl: "/sandbox/referral-complete",
      partnerDisplayName: "Example Bank",
    });

    const ok = await POST(new Request("http://local/api/recovery/return", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        recoveryJourneyId: "a6d4e69a-73bf-4a02-b196-4117be8e8722",
        customerChoice: "continue",
      }),
    }));
    expect(ok.status).toBe(200);
    expect(routeMocks.createReturnToOrigin).toHaveBeenCalledWith(expect.objectContaining({
      userId: "user-1",
      customerChoice: "continue",
    }));
  });
});
