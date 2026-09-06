import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { RecoveryEvidence } from "@/components/recovery/recovery-evidence";
import { RecoveryFallback } from "@/components/recovery/recovery-fallback";
import { RecoveryNextCard } from "@/components/recovery/recovery-next-card";
import { RecoveryProgressCard } from "@/components/recovery/recovery-progress-card";
import type { RecoveryExperienceProjection } from "@/lib/recovery/experience";

afterEach(() => cleanup());

function projection(
  overrides: Partial<RecoveryExperienceProjection> = {},
): RecoveryExperienceProjection {
  return {
    mode: "recovery",
    recoveryJourneyId: "recovery-1",
    stage: "rebuilding",
    state: "waiting_for_evidence",
    headline: "You’ve done what you need to do for now.",
    summary: "We’re waiting for evidence to reach its genuine review point.",
    nextAction: {
      missionInstanceId: null,
      missionSlug: "register-electoral-roll",
      title: "Wait for your electoral-roll update",
      rationale: "The action is submitted and has not reached its review date yet.",
      actionHref: null,
      impactLabel: null,
      effortLabel: null,
      reviewTimingLabel: null,
    },
    evidence: [
      {
        key: "electoral_roll",
        label: "Electoral roll",
        confidence: "pending",
        source: "government_action",
        statusText: "Waiting for the registration update to become visible.",
      },
      {
        key: "utilisation",
        label: "Credit utilisation",
        confidence: "confirmed",
        source: "account",
        statusText: "Tracked account utilisation is 20%.",
      },
      {
        key: "applications",
        label: "Recent applications",
        confidence: "unknown",
        source: "unknown",
        statusText: "Recent application activity is not yet known.",
      },
      {
        key: "future_verified",
        label: "Future trusted evidence",
        confidence: "verified",
        source: "cra",
        statusText: "Example trusted external evidence.",
      },
    ],
    timeline: [
      { key: "declined", label: "Declined", state: "complete" },
      { key: "fixing", label: "Fixing now", state: "complete" },
      { key: "waiting", label: "Evidence pending", state: "current" },
      { key: "reassessment", label: "Reassessment", state: "future" },
      { key: "ready", label: "Ready", state: "future" },
    ],
    readiness: {
      status: "amber",
      explanation: "Not quite ready yet",
    },
    reassessment: {
      dueAt: "2026-10-05T09:00:00.000Z",
      label: "Next evidence-based reassessment: 5 Oct 2026.",
    },
    returnState: {
      status: "unavailable",
      reason: "direct_recovery",
      partnerLabel: null,
    },
    ...overrides,
  };
}

describe("RecoveryFallback", () => {
  it("fails closed without inventing an action or lender route", () => {
    render(<RecoveryFallback />);

    expect(screen.getByRole("region", { name: /your recovery plan/i })).not.toBeNull();
    expect(screen.getByText(/can’t load the detailed recovery view right now/i)).not.toBeNull();
    expect(screen.getByText(/no lender return will be attempted from this state/i)).not.toBeNull();
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });
});

describe("RecoveryEvidence", () => {
  it("renders confidence labels without claiming integrations are connected", () => {
    render(<RecoveryEvidence evidence={projection().evidence} />);

    expect(screen.getByText("Pending")).not.toBeNull();
    expect(screen.getByText("Confirmed")).not.toBeNull();
    expect(screen.getByText("Unknown")).not.toBeNull();
    expect(screen.getByText("Verified")).not.toBeNull();
    expect(screen.queryByText(/cra connected|open banking connected/i)).toBeNull();
  });
});

describe("RecoveryProgressCard", () => {
  it("shows the five-step recovery path and grounded reassessment timing", () => {
    render(<RecoveryProgressCard projection={projection()} />);

    expect(screen.getAllByTestId("recovery-progress-step")).toHaveLength(5);
    expect(screen.getByText(/next evidence-based reassessment: 5 oct 2026/i)).not.toBeNull();
    expect(screen.queryByText(/you will be approved|you now qualify/i)).toBeNull();
  });
});

describe("RecoveryNextCard", () => {
  it("explains a waiting state without creating an action CTA", () => {
    render(<RecoveryNextCard projection={projection()} />);

    expect(screen.getByText(/waiting|review point|evidence/i)).not.toBeNull();
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("keeps ready-to-check language separate from lender approval", () => {
    render(<RecoveryNextCard projection={projection({
      stage: "ready_to_check",
      state: "ready_to_check",
      headline: "You’ve made the progress we were waiting for.",
      summary: "Based on the information we have, you’re ready to check eligibility again. This is not a guarantee of acceptance.",
      readiness: { status: "green", explanation: "Ready to check" },
    })} />);

    expect(screen.getByText(/ready to check eligibility again/i)).not.toBeNull();
    expect(screen.getByText(/not a guarantee/i)).not.toBeNull();
    expect(screen.queryByText(/approved|you now qualify/i)).toBeNull();
  });
});
