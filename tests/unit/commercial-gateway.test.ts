import { describe, expect, it, vi } from "vitest";
import { createCommercialGateway, CommercialGatewayError } from "@/lib/server/commercial-gateway";
import type { CreditProfile } from "@/lib/domain/types";

const now = new Date("2026-08-31T08:00:00.000Z");

const profile: CreditProfile = {
  userId: "u1",
  dateOfBirth: "1990-01-01",
  employmentStatus: "employed",
  incomeBand: "30_50k",
  housingStatus: "rent",
  electoralRoll: true,
  utilisationPct: 10,
  missedPaymentsLast12m: 0,
  hardApplicationsLast6m: 0,
  hasRevolvingCredit: true,
  hasDirectDebitForCredit: true,
};

const disclosure = {
  id: "disc-1",
  disclosureKey: "sandbox-referral-disclosure",
  version: 1,
  body: "Sandbox only. No lender or credit application is contacted.",
};

const route = {
  id: "route-1",
  routeKey: "credit-quest-sandbox-route",
  partnerId: "partner-1",
  partnerKey: "credit-quest-sandbox",
  partnerDisplayName: "Credit Quest Sandbox Partner",
  environment: "sandbox" as const,
  destinationUrl: "/sandbox/referral-complete",
  enabled: true,
  disclosureKey: disclosure.disclosureKey,
  partnerEnabled: true,
  partnerSandboxEnabled: true,
  partnerLiveEnabled: false,
};

function makeDeps(overrides: Record<string, unknown> = {}) {
  return {
    getGuidance: vi.fn().mockResolvedValue({
      profile,
      readiness: { state: "green" },
    }),
    isGatewayEnabled: vi.fn().mockResolvedValue(true),
    listRoutes: vi.fn().mockResolvedValue([route]),
    getRoute: vi.fn().mockResolvedValue(route),
    getDisclosure: vi.fn().mockResolvedValue(disclosure),
    appendReferral: vi.fn().mockResolvedValue({ id: "ref-1" }),
    makeReferralKey: vi.fn(() => "ref-key"),
    liveAllowed: false,
    ...overrides,
  };
}

describe("commercial gateway", () => {
  it("does not require consent to list a permitted disclosure", async () => {
    const gateway = createCommercialGateway(makeDeps() as never);
    const routes = await gateway.listPermittedCommercialRoutes({ userId: "u1", environment: "sandbox", now });

    expect(routes).toHaveLength(1);
    expect(routes[0].disclosure.body).toMatch(/Sandbox only/i);
  });

  it("re-fetches current disclosure and requires consent before insert", async () => {
    const deps = makeDeps();
    const gateway = createCommercialGateway(deps as never);

    await expect(gateway.createCommercialReferral({
      userId: "u1",
      routeId: "route-1",
      disclosureId: "disc-1",
      consent: false,
      originatingMissionId: null,
      now,
    })).rejects.toMatchObject({ code: "consent_missing" });
    expect(deps.appendReferral).not.toHaveBeenCalled();

    await expect(gateway.createCommercialReferral({
      userId: "u1",
      routeId: "route-1",
      disclosureId: "disc-1",
      consent: true,
      originatingMissionId: null,
      now,
    })).resolves.toMatchObject({
      referralId: "ref-1",
      destinationUrl: "/sandbox/referral-complete",
    });
    expect(deps.getDisclosure).toHaveBeenCalledWith("sandbox-referral-disclosure");
    expect(deps.appendReferral).toHaveBeenCalledWith(expect.objectContaining({
      userId: "u1",
      routeId: "route-1",
      disclosureId: "disc-1",
      readinessSnapshot: "green",
      environment: "sandbox",
    }));
  });

  it("keeps live routes dark behind the independent server guard", async () => {
    const liveRoute = { ...route, environment: "live" as const, destinationUrl: "https://example.com", partnerLiveEnabled: true };
    const gateway = createCommercialGateway(makeDeps({ listRoutes: vi.fn().mockResolvedValue([liveRoute]) }) as never);

    await expect(gateway.listPermittedCommercialRoutes({ userId: "u1", environment: "live", now }))
      .resolves.toEqual([]);
  });

  it("blocks incomplete evidence even when readiness is mocked green", async () => {
    const gateway = createCommercialGateway(makeDeps({
      getGuidance: vi.fn().mockResolvedValue({
        profile: { ...profile, hasRevolvingCredit: null },
        readiness: { state: "green" },
      }),
    }) as never);

    await expect(gateway.listPermittedCommercialRoutes({ userId: "u1", environment: "sandbox", now }))
      .resolves.toEqual([]);
  });

  it("blocks Safe Mode and under-18 users", async () => {
    const safeGateway = createCommercialGateway(makeDeps({
      getGuidance: vi.fn().mockResolvedValue({
        profile: { ...profile, missedPaymentsLast12m: 2, hardApplicationsLast6m: 3 },
        readiness: { state: "green" },
      }),
    }) as never);
    await expect(safeGateway.listPermittedCommercialRoutes({ userId: "u1", environment: "sandbox", now }))
      .resolves.toEqual([]);

    const childGateway = createCommercialGateway(makeDeps({
      getGuidance: vi.fn().mockResolvedValue({
        profile: { ...profile, dateOfBirth: "2010-01-01" },
        readiness: { state: "green" },
      }),
    }) as never);
    await expect(childGateway.listPermittedCommercialRoutes({ userId: "u1", environment: "sandbox", now }))
      .resolves.toEqual([]);
  });

  it("fails list closed and referral creation with a controlled error on config failure", async () => {
    const listGateway = createCommercialGateway(makeDeps({
      listRoutes: vi.fn().mockRejectedValue(new Error("config down")),
    }) as never);
    await expect(listGateway.listPermittedCommercialRoutes({ userId: "u1", environment: "sandbox", now }))
      .resolves.toEqual([]);

    const deps = makeDeps({ getRoute: vi.fn().mockRejectedValue(new Error("config down")) });
    const referralGateway = createCommercialGateway(deps as never);
    await expect(referralGateway.createCommercialReferral({
      userId: "u1",
      routeId: "route-1",
      disclosureId: "disc-1",
      consent: true,
      originatingMissionId: null,
      now,
    })).rejects.toBeInstanceOf(CommercialGatewayError);
    expect(deps.appendReferral).not.toHaveBeenCalled();
  });
});
