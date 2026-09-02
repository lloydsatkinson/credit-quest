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
    isGatewayEnabled: vi.fn().mockResolvedValue(false),
    isSandboxEnabled: vi.fn().mockResolvedValue(true),
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
  it("permits sandbox presentation from the sandbox switch while the live gateway remains off", async () => {
    const gateway = createCommercialGateway(makeDeps() as never);
    const routes = await gateway.listPermittedCommercialRoutes({ userId: "u1", environment: "sandbox", now });

    expect(routes).toHaveLength(1);
    expect(routes[0].disclosure.body).toMatch(/Sandbox only/i);
  });

  it("keeps sandbox dark when its dedicated switch is off even if the live gateway is on", async () => {
    const gateway = createCommercialGateway(makeDeps({
      isSandboxEnabled: vi.fn().mockResolvedValue(false),
      isGatewayEnabled: vi.fn().mockResolvedValue(true),
    }) as never);

    await expect(gateway.listPermittedCommercialRoutes({ userId: "u1", environment: "sandbox", now }))
      .resolves.toEqual([]);
  });

  it("re-fetches current disclosure and requires consent before sandbox insert", async () => {
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

  it("keeps live routes dark even when sandbox is enabled", async () => {
    const liveRoute = {
      ...route,
      environment: "live" as const,
      destinationUrl: "https://example.com",
      partnerLiveEnabled: true,
    };
    const gateway = createCommercialGateway(makeDeps({
      listRoutes: vi.fn().mockResolvedValue([liveRoute]),
      isSandboxEnabled: vi.fn().mockResolvedValue(true),
      isGatewayEnabled: vi.fn().mockResolvedValue(false),
      liveAllowed: true,
    }) as never);

    await expect(gateway.listPermittedCommercialRoutes({ userId: "u1", environment: "live", now }))
      .resolves.toEqual([]);
  });

  it("keeps live routes behind the independent environment server guard", async () => {
    const liveRoute = {
      ...route,
      environment: "live" as const,
      destinationUrl: "https://example.com",
      partnerLiveEnabled: true,
    };
    const gateway = createCommercialGateway(makeDeps({
      listRoutes: vi.fn().mockResolvedValue([liveRoute]),
      isGatewayEnabled: vi.fn().mockResolvedValue(true),
      liveAllowed: false,
    }) as never);

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

  it("blocks non-green readiness", async () => {
    const gateway = createCommercialGateway(makeDeps({
      getGuidance: vi.fn().mockResolvedValue({
        profile,
        readiness: { state: "amber" },
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

  it("rejects stale disclosures before referral provenance is inserted", async () => {
    const deps = makeDeps();
    const gateway = createCommercialGateway(deps as never);

    await expect(gateway.createCommercialReferral({
      userId: "u1",
      routeId: "route-1",
      disclosureId: "old-disc",
      consent: true,
      originatingMissionId: null,
      now,
    })).rejects.toMatchObject({ code: "disclosure_stale" });
    expect(deps.appendReferral).not.toHaveBeenCalled();
  });

  it("rejects invalid destinations before referral provenance is inserted", async () => {
    const invalidSandbox = makeDeps({
      getRoute: vi.fn().mockResolvedValue({ ...route, destinationUrl: "https://example.com" }),
    });
    const sandboxGateway = createCommercialGateway(invalidSandbox as never);

    await expect(sandboxGateway.createCommercialReferral({
      userId: "u1",
      routeId: "route-1",
      disclosureId: "disc-1",
      consent: true,
      originatingMissionId: null,
      now,
    })).rejects.toMatchObject({ code: "invalid_destination" });
    expect(invalidSandbox.appendReferral).not.toHaveBeenCalled();

    const liveRoute = {
      ...route,
      environment: "live" as const,
      destinationUrl: "http://example.com",
      partnerLiveEnabled: true,
    };
    const invalidLive = makeDeps({
      getRoute: vi.fn().mockResolvedValue(liveRoute),
      isGatewayEnabled: vi.fn().mockResolvedValue(true),
      liveAllowed: true,
    });
    const liveGateway = createCommercialGateway(invalidLive as never);

    await expect(liveGateway.createCommercialReferral({
      userId: "u1",
      routeId: "route-1",
      disclosureId: "disc-1",
      consent: true,
      originatingMissionId: null,
      now,
    })).rejects.toMatchObject({ code: "invalid_destination" });
    expect(invalidLive.appendReferral).not.toHaveBeenCalled();
  });
});
