import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import LoginPage from "@/app/(auth)/login/page";
import { ResumeActionCard } from "@/components/actions/resume-action-card";
import { EmailReminderPreference } from "@/components/journey/email-reminder-preference";
import { JourneyStatusCard } from "@/components/journey/journey-status-card";
import type { ActionAttempt } from "@/lib/domain/types";
import type { JourneyState } from "@/lib/journey/types";

vi.mock("@/lib/events", () => ({
  trackEvent: vi.fn().mockResolvedValue(undefined),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const journeyState = {
  stage: "waiting",
  nextReassessmentAt: null,
  lastReadinessBand: "amber",
} as JourneyState;

const attempt: ActionAttempt = {
  id: "attempt-1",
  userId: "user-1",
  missionInstanceId: "mission-instance-1",
  actionRegistryId: "action-1",
  accountId: null,
  status: "started",
  startedAt: "2026-09-01T09:00:00.000Z",
  returnedAt: null,
  selfConfirmedAt: null,
  verifiedAt: null,
  nextReviewAt: null,
};

describe("remaining customer UI consistency", () => {
  it("renders login inside the premium customer shell", () => {
    render(<LoginPage />);

    expect(screen.getByTestId("customer-shell")).not.toBeNull();
    expect(screen.getByTestId("login-panel").className).toContain("cq-panel");
    expect(screen.getByText(/passwordless access/i)).not.toBeNull();
  });

  it("renders journey status and email preferences as premium panels", () => {
    render(
      <>
        <JourneyStatusCard state={journeyState} latestOutcome={null} />
        <EmailReminderPreference initialEnabled={false} demo={false} />
      </>,
    );

    expect(screen.getByTestId("journey-status").className).toContain("cq-panel");
    expect(screen.getByTestId("email-reminder-preference").className).toContain("cq-panel");
    expect(screen.getByText(/does not sign you up for marketing/i)).not.toBeNull();
  });

  it("renders resume-action follow-up as a premium panel without weakening verification copy", () => {
    render(
      <ResumeActionCard
        attempt={attempt}
        missionSlug="register-electoral-roll"
        missionTitle="Register on the electoral roll"
        providerLabel="GOV.UK"
      />,
    );

    expect(screen.getByTestId("resume-action-card").className).toContain("cq-panel");
    expect(screen.getByText(/keep this mission accurate/i)).not.toBeNull();
  });
});
