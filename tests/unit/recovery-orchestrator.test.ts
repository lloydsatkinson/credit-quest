import { describe, expect, it, vi } from "vitest";
import { buildRecoveryPlan } from "@/lib/recovery/plan";
import { createRecoveryOrchestrator } from "@/lib/server/recovery-orchestrator";
import type { ApplicationReadiness, BarrierDiagnosis, CreditPassport, CreditProfile } from "@/lib/domain/types";

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

const diagnosis: BarrierDiagnosis = {
  primary: "optimiser",
  secondary: [],
  confidence: "medium",
  factors: [],
};

const passport: CreditPassport = {
  pillars: [
    {
      id: "identity",
      title: "Identity",
      status: "unknown",
      strength: "Some identity evidence is present.",
      helping: [],
      hurting: [],
      unknowns: ["Address history needs confirming."],
      nextActions: ["Confirm your address history."],
    },
    {
      id: "payment_health",
      title: "Payment health",
      status: "green",
      strength: "Payments look stable.",
      helping: [],
      hurting: [],
      unknowns: [],
      nextActions: [],
    },
  ],
};

function readiness(
  state: ApplicationReadiness["state"],
  reassessAt: string | null = null,
): ApplicationReadiness {
  return {
    state,
    headline: state,
    reasons: [],
    avoid: [],
    actions: [],
    reassessAt,
    daysUntilReassessment: reassessAt ? 14 : null,
  };
}

describe("recovery-plan projection", () => {
  it("puts Safe Mode into crisis recovery and suppresses an ordinary mission", () => {
    const result = buildRecoveryPlan({
      safetyMode: "safe_mode",
      readiness: readiness("red"),
      diagnosis,
      passport,
      nextMission: { slug: "optimise-utilisation", title: "Lower utilisation", nextReviewAt: null },
    });

    expect(result.stage).toBe("crisis_recovery");
    expect(result.nextSafeAction.kind).toBe("stabilise");
    expect(result.nextSafeAction.title).not.toContain("utilisation");
    expect(result.nextReassessmentAt).toBeNull();
  });

  it("maps red to stability and amber to rebuilding", () => {
    expect(buildRecoveryPlan({
      safetyMode: "normal",
      readiness: readiness("red"),
      diagnosis,
      passport,
      nextMission: null,
    }).stage).toBe("stability");

    expect(buildRecoveryPlan({
      safetyMode: "normal",
      readiness: readiness("amber"),
      diagnosis,
      passport,
      nextMission: { slug: "electoral-roll", title: "Check the electoral roll", nextReviewAt: null },
    }).stage).toBe("rebuilding");
  });

  it("maps green to ready-to-check without inventing lender approval", () => {
    const result = buildRecoveryPlan({
      safetyMode: "normal",
      readiness: readiness("green"),
      diagnosis,
      passport,
      nextMission: null,
    });

    expect(result.stage).toBe("ready_to_check");
    expect(result.readinessState).toBe("ready_to_check");
    expect(result.nextSafeAction.kind).toBe("ready_to_check");
    expect(result.nextSafeAction.title.toLowerCase()).toContain("eligibility");
    expect(result.nextSafeAction.title.toLowerCase()).not.toContain("approved");
  });

  it("uses a genuine dated reassessment but never fabricates one when the source date is missing", () => {
    const dated = "2026-09-17T09:00:00.000Z";
    expect(buildRecoveryPlan({
      safetyMode: "normal",
      readiness: readiness("amber", dated),
      diagnosis,
      passport,
      nextMission: { slug: "application-cooldown", title: "Let recent applications cool down", nextReviewAt: dated },
    }).nextReassessmentAt).toBe(dated);

    const undated = buildRecoveryPlan({
      safetyMode: "normal",
      readiness: {
        ...readiness("amber"),
        reasons: ["Recent applications may need time to settle."],
        actions: ["Wait before another application."],
      },
      diagnosis,
      passport,
      nextMission: { slug: "application-cooldown", title: "Let recent applications cool down", nextReviewAt: null },
    });

    expect(undated.nextReassessmentAt).toBeNull();
  });

  it("projects evidence gaps from the existing Passport instead of partner decline context", () => {
    const result = buildRecoveryPlan({
      safetyMode: "normal",
      readiness: readiness("unknown"),
      diagnosis,
      passport,
      nextMission: null,
    });

    expect(result.evidenceGaps).toContain("Address history needs confirming.");
    expect(JSON.stringify(result).toLowerCase()).not.toContain("partner reason");
  });
});

describe("recovery orchestrator", () => {
  it("reads core guidance first and persists only the resulting projection", async () => {
    const persistProjection = vi.fn().mockResolvedValue(undefined);
    const orchestrator = createRecoveryOrchestrator({
      getGuidance: vi.fn().mockResolvedValue({
        profile,
        diagnosis,
        passport,
        readiness: readiness("amber", "2026-09-17T09:00:00.000Z"),
      }),
      getSafetyMode: vi.fn().mockReturnValue("normal"),
      getNextMission: vi.fn().mockResolvedValue({
        slug: "application-cooldown",
        title: "Let recent applications cool down",
        nextReviewAt: "2026-09-17T09:00:00.000Z",
      }),
      persistProjection,
    });

    const result = await orchestrator.projectForUser({
      recoveryJourneyId: "recovery-1",
      userId: "user-1",
      now: new Date("2026-09-03T09:00:00.000Z"),
    });

    expect(result.stage).toBe("rebuilding");
    expect(persistProjection).toHaveBeenCalledTimes(1);
    expect(persistProjection).toHaveBeenCalledWith(expect.objectContaining({
      recoveryJourneyId: "recovery-1",
      userId: "user-1",
      projection: result,
    }));
  });

  it("fails closed when core guidance is unavailable and does not persist a projection", async () => {
    const persistProjection = vi.fn();
    const orchestrator = createRecoveryOrchestrator({
      getGuidance: vi.fn().mockResolvedValue(null),
      getSafetyMode: vi.fn(),
      getNextMission: vi.fn(),
      persistProjection,
    });

    await expect(orchestrator.projectForUser({
      recoveryJourneyId: "recovery-1",
      userId: "user-1",
      now: new Date("2026-09-03T09:00:00.000Z"),
    })).rejects.toThrow(/guidance/i);
    expect(persistProjection).not.toHaveBeenCalled();
  });
});
