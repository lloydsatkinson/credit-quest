import { beforeEach, describe, expect, it, vi } from "vitest";

const repository = vi.hoisted(() => ({
  listPartners: vi.fn(),
  readAnalytics: vi.fn(),
  readPipeline: vi.fn(),
  readCohorts: vi.fn(),
  readStatus: vi.fn(),
}));

vi.mock("@/lib/server/lender-recovery-repository", () => ({
  listLenderRecoveryPartners: repository.listPartners,
  readPartnerRecoveryAnalyticsInput: repository.readAnalytics,
  readPartnerPipelineSources: repository.readPipeline,
  readPartnerCohortSources: repository.readCohorts,
  readPartnerPilotStatus: repository.readStatus,
}));

import {
  createLenderRecoveryService,
} from "@/lib/server/lender-recovery-service";
import {
  LIVE_RETURN_TO_ORIGIN_ALLOWED,
  type ReturnOriginAvailability,
} from "@/lib/server/return-origin-gateway";

const now = new Date("2026-09-06T12:00:00.000Z");
const secret = "0123456789abcdef0123456789abcdef";

function pipelineSources() {
  return {
    journeys: [{
      journeyId: "journey-uuid-1",
      userId: "user-uuid-1",
      startedAt: "2026-09-01T09:00:00.000Z",
      completedAt: null,
      updatedAt: "2026-09-05T09:00:00.000Z",
      stage: "rebuilding",
      readinessState: "getting_closer",
      nextReassessmentAt: "2026-09-20T09:00:00.000Z",
      lastReassessedAt: null,
      intakeSessionId: "intake-1",
    }],
    journeyStates: [{
      userId: "user-uuid-1",
      stage: "waiting",
      activeMissionId: null,
      nextReassessmentAt: "2026-09-20T09:00:00.000Z",
      lastReassessedAt: null,
      lastReadinessBand: "amber",
    }],
    missions: [{
      id: "mission-1",
      userId: "user-uuid-1",
      state: "in_review",
      startedAt: "2026-09-02T09:00:00.000Z",
      completedAt: null,
      nextReviewAt: "2026-09-20T09:00:00.000Z",
    }],
    actionAttempts: [{
      userId: "user-uuid-1",
      missionInstanceId: "mission-1",
      status: "submitted",
      startedAt: "2026-09-02T09:05:00.000Z",
      nextReviewAt: "2026-09-20T09:00:00.000Z",
      verifiedAt: null,
    }],
    returnAttempts: [],
  };
}

function service(overrides: Partial<Parameters<typeof createLenderRecoveryService>[0]> = {}) {
  return createLenderRecoveryService({
    admin: {} as never,
    getReferenceSecret: () => secret,
    getReturnAvailability: vi.fn<
      (input: { userId: string; recoveryJourneyId: string; now: Date }) => Promise<ReturnOriginAvailability>
    >().mockResolvedValue({
      status: "blocked",
      reason: "gateway_disabled",
      partnerDisplayName: "Alpha Bank",
    }),
    liveCreditReferralsAllowed: false,
    liveReturnToOriginAllowed: false,
    ...overrides,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  repository.listPartners.mockResolvedValue([]);
  repository.readAnalytics.mockResolvedValue({
    handoffs: [],
    journeys: [],
    actionStarts: [],
    returns: [],
  });
  repository.readPipeline.mockResolvedValue(pipelineSources());
  repository.readCohorts.mockResolvedValue({
    handoffs: [],
    journeys: [],
    actionStarts: [],
    returns: [],
  });
  repository.readStatus.mockResolvedValue({
    partner: null,
    flags: [],
    contracts: [],
    disclosures: [],
  });
});

describe("lender recovery service", () => {
  it("keeps the production live Return-to-Origin hard lock false", () => {
    expect(LIVE_RETURN_TO_ORIGIN_ALLOWED).toBe(false);
  });

  it("builds the overview from existing recovery analytics with the approved denominators", async () => {
    repository.readAnalytics.mockResolvedValue({
      handoffs: [
        { partnerId: "partner-a", partnerDisplayName: "Alpha Bank", createdAt: "2026-09-01T09:00:00.000Z", consumedAt: "2026-09-01T09:05:00.000Z" },
        { partnerId: "partner-a", partnerDisplayName: "Alpha Bank", createdAt: "2026-09-01T10:00:00.000Z", consumedAt: null },
      ],
      journeys: [{
        journeyId: "journey-uuid-1",
        userId: "user-uuid-1",
        partnerId: "partner-a",
        startedAt: "2026-09-01T09:05:00.000Z",
        lastReassessedAt: "2026-09-05T09:00:00.000Z",
        readinessState: "ready_to_check",
      }],
      actionStarts: [{ userId: "user-uuid-1", startedAt: "2026-09-01T15:05:00.000Z" }],
      returns: [{
        partnerId: "partner-a",
        customerChoice: "continue",
        outcome: "redirected",
        suppressionReason: null,
      }],
    });

    const result = await service().getOverview("partner-a", 30, now);

    expect(result.available).toBe(true);
    if (!result.available) return;
    expect(result.overview.activationRate.percentage).toBe(50);
    expect(result.overview.firstActionRate.percentage).toBe(100);
    expect(result.overview.recoveryRate.percentage).toBe(100);
    expect(result.overview.voluntaryReturnRate.percentage).toBe(100);
    expect(JSON.stringify(result)).not.toContain("user-uuid-1");
    expect(JSON.stringify(result)).not.toContain("journey-uuid-1");
  });

  it("uses authoritative RTO availability once per included pipeline row and strips internal ids", async () => {
    const getReturnAvailability = vi.fn().mockResolvedValue({
      status: "blocked" as const,
      reason: "gateway_disabled" as const,
      partnerDisplayName: "Alpha Bank",
    });

    const result = await service({ getReturnAvailability }).getPipeline("partner-a", 30, now);

    expect(result.available).toBe(true);
    if (!result.available) return;
    expect(getReturnAvailability).toHaveBeenCalledTimes(1);
    expect(getReturnAvailability).toHaveBeenCalledWith({
      userId: "user-uuid-1",
      recoveryJourneyId: "journey-uuid-1",
      now,
    });
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({
      state: "waiting_for_evidence",
      readinessState: "getting_closer",
      evidenceConfidence: "pending",
      returnAvailability: "blocked",
    });
    expect(result.rows[0].caseReference).toMatch(/^CQ-[A-F0-9]{10}$/);

    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("user-uuid-1");
    expect(serialized).not.toContain("journey-uuid-1");
    expect(serialized).not.toMatch(/dateOfBirth|income|balance|creditLimit|supportNeed|vulnerab|declineReason|commission|revenue|approvalProbability/i);
  });

  it("maps an RTO availability failure to unavailable instead of guessing available", async () => {
    const getReturnAvailability = vi.fn().mockRejectedValue(new Error("RTO unavailable"));

    const result = await service({ getReturnAvailability }).getPipeline("partner-a", 30, now);

    expect(result.available).toBe(true);
    if (!result.available) return;
    expect(result.rows[0].returnAvailability).toBe("unavailable");
  });

  it("fails the pipeline closed when the pseudonymisation secret is unavailable", async () => {
    const result = await service({ getReferenceSecret: () => null }).getPipeline("partner-a", 30, now);

    expect(result).toEqual({
      available: false,
      reason: "reference_secret_unavailable",
    });
    expect(repository.readPipeline).not.toHaveBeenCalled();
  });

  it("keeps readiness independent from RTO availability", async () => {
    repository.readPipeline.mockResolvedValue({
      ...pipelineSources(),
      journeys: [{
        ...pipelineSources().journeys[0],
        stage: "ready_to_check",
        readinessState: "ready_to_check",
      }],
      journeyStates: [{
        ...pipelineSources().journeyStates[0],
        stage: "ready",
      }],
      actionAttempts: [],
    });

    const result = await service().getPipeline("partner-a", 30, now);

    expect(result.available).toBe(true);
    if (!result.available) return;
    expect(result.rows[0].state).toBe("ready_to_check");
    expect(result.rows[0].returnAvailability).toBe("blocked");
  });

  it("projects pilot status as read-only configuration plus explicit live locks", async () => {
    repository.readStatus.mockResolvedValue({
      partner: {
        id: "partner-a",
        partnerKey: "alpha",
        displayName: "Alpha Bank",
        enabled: true,
        sandboxEnabled: true,
        liveEnabled: false,
      },
      flags: [{ flagKey: "return_to_origin_enabled", enabled: false }],
      contracts: [{
        id: "contract-1",
        environment: "sandbox",
        productCategory: "credit_card",
        disclosureKey: "return-disclosure",
        disclosureVersion: 1,
        callbackPolicy: "none",
        enabled: false,
        expiresAt: "2026-12-31T00:00:00.000Z",
      }],
      disclosures: [{
        disclosureKey: "return-disclosure",
        version: 1,
        status: "published",
        publishedAt: "2026-09-01T00:00:00.000Z",
      }],
    });

    const result = await service().getStatus("partner-a");

    expect(result.available).toBe(true);
    if (!result.available) return;
    expect(result.liveCreditReferralsAllowed).toBe(false);
    expect(result.liveReturnToOriginAllowed).toBe(false);
    expect(JSON.stringify(result)).not.toMatch(/destinationUrl|callbackUrl/);
  });
});
