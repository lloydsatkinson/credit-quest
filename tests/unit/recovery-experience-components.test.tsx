import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RecoveryHero } from "@/components/recovery/recovery-hero";
import { trackEvent } from "@/lib/events";
import type {
  RecoveryExperienceProjection,
  RecoveryExperienceState,
  RecoveryTimelineItem,
} from "@/lib/recovery/experience";

vi.mock("@/lib/events", () => ({
  trackEvent: vi.fn().mockResolvedValue(undefined),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const timelineFor = (state: RecoveryExperienceState): RecoveryTimelineItem[] => {
  const current = state === "waiting_for_evidence"
    ? "waiting"
    : state === "reassessment_due"
      ? "reassessment"
      : state === "ready_to_check"
        ? "ready"
        : "fixing";
  const keys: RecoveryTimelineItem["key"][] = ["declined", "fixing", "waiting", "reassessment", "ready"];
  const labels = ["Declined", "Fixing now", "Evidence pending", "Reassessment", "Ready"];
  const currentIndex = keys.indexOf(current);
  return keys.map((key, index) => ({
    key,
    label: labels[index],
    state: index < currentIndex ? "complete" : index === currentIndex ? "current" : "future",
  }));
};

function projection(state: RecoveryExperienceState): RecoveryExperienceProjection {
  const actionRequired = state === "action_required";
  return {
    mode: "recovery",
    recoveryJourneyId: "recovery-1",
    stage: state === "ready_to_check" ? "ready_to_check" : "rebuilding",
    state,
    headline: state === "ready_to_check"
      ? "You’ve made the progress we were waiting for."
      : "Here’s where your recovery stands.",
    summary: state === "ready_to_check"
      ? "Based on the information we have, you’re ready to check eligibility again. This is not a guarantee of acceptance."
      : "Your current Credit Quest evidence determines the next step.",
    nextAction: {
      missionInstanceId: actionRequired ? "mission-instance-1" : null,
      missionSlug: actionRequired ? "register-electoral-roll" : null,
      title: actionRequired ? "Register on the electoral roll" : "Keep building your evidence",
      rationale: "This is the highest-priority action from your current Credit Quest guidance.",
      actionHref: actionRequired ? "/actions/mission-instance-1" : null,
      impactLabel: actionRequired ? "high" : null,
      effortLabel: actionRequired ? "About 5 minutes" : null,
      reviewTimingLabel: actionRequired ? "around 35 days" : null,
    },
    evidence: [],
    timeline: timelineFor(state),
    readiness: {
      status: state === "ready_to_check" ? "green" : "amber",
      explanation: state === "ready_to_check" ? "Ready to check" : "Not quite ready yet",
    },
    reassessment: {
      dueAt: state === "waiting_for_evidence" ? "2026-10-05T09:00:00.000Z" : null,
      label: state === "waiting_for_evidence"
        ? "Next evidence-based reassessment: 5 Oct 2026."
        : "No reassessment date is being guessed.",
    },
    returnState: {
      status: "unavailable",
      reason: "direct_recovery",
      partnerLabel: null,
    },
  };
}

describe("RecoveryHero", () => {
  it.each<RecoveryExperienceState>([
    "action_required",
    "waiting_for_evidence",
    "reassessment_due",
    "not_ready",
    "ready_to_check",
  ])("renders the recovery region and five-step timeline for %s", (state) => {
    render(<RecoveryHero projection={projection(state)} />);

    expect(screen.getByRole("region", { name: /your recovery plan/i })).not.toBeNull();
    expect(screen.getAllByTestId("recovery-timeline-step")).toHaveLength(5);
    expect(screen.getByTestId("recovery-timeline-current").getAttribute("aria-current")).toBe("step");
    expect(screen.queryByText(/you will be approved|you now qualify/i)).toBeNull();
  });

  it("shows exactly one dominant action CTA only when action is required", () => {
    render(<RecoveryHero projection={projection("action_required")} />);

    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(1);
    expect(links[0].getAttribute("href")).toBe("/actions/mission-instance-1");
    expect(links[0].textContent).toMatch(/start quest|take action/i);
  });

  it.each<RecoveryExperienceState>([
    "waiting_for_evidence",
    "reassessment_due",
    "not_ready",
    "ready_to_check",
  ])("does not invent an action CTA for %s", (state) => {
    render(<RecoveryHero projection={projection(state)} />);
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("shows grounded action metadata when it exists", () => {
    render(<RecoveryHero projection={projection("action_required")} />);

    expect(screen.getByText(/high impact/i)).not.toBeNull();
    expect(screen.getByText(/about 5 minutes/i)).not.toBeNull();
    expect(screen.getByText(/around 35 days/i)).not.toBeNull();
  });

  it("emits only controlled presentation events for a waiting state", () => {
    render(<RecoveryHero projection={projection("waiting_for_evidence")} />);

    const expectedMetadata = {
      recoveryJourneyId: "recovery-1",
      state: "waiting_for_evidence",
      stage: "rebuilding",
    };
    expect(trackEvent).toHaveBeenCalledWith("recovery_hero_shown", expectedMetadata);
    expect(trackEvent).toHaveBeenCalledWith("recovery_state_shown", expectedMetadata);
    expect(trackEvent).toHaveBeenCalledWith("recovery_waiting_for_evidence", expectedMetadata);
    expect(trackEvent).not.toHaveBeenCalledWith("recovery_reassessment_due", expect.anything());
    expect(JSON.stringify(vi.mocked(trackEvent).mock.calls)).not.toMatch(/income|balance|limit|support|vulnerab|health|diagnosis|commission|revenue|approval_probability/i);
  });

  it("emits the due event only when reassessment is due", () => {
    render(<RecoveryHero projection={projection("reassessment_due")} />);

    expect(trackEvent).toHaveBeenCalledWith("recovery_reassessment_due", {
      recoveryJourneyId: "recovery-1",
      state: "reassessment_due",
      stage: "rebuilding",
    });
    expect(trackEvent).not.toHaveBeenCalledWith("recovery_waiting_for_evidence", expect.anything());
  });
});
