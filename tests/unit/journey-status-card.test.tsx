import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { JourneyStatusCard } from "@/components/journey/journey-status-card";

const baseState = {
  userId: "u1",
  stage: "ready" as const,
  activeMissionId: null,
  nextReassessmentAt: null,
  lastReassessedAt: "2026-08-29T08:00:00.000Z",
  lastReadinessBand: "green" as const,
  updatedAt: "2026-08-29T08:00:00.000Z",
};

describe("JourneyStatusCard", () => {
  it("explains a readiness improvement without promising approval", () => {
    render(
      <JourneyStatusCard
        state={baseState}
        latestOutcome={{
          id: "o1",
          userId: "u1",
          eventType: "readiness_changed",
          source: "reassessment",
          sourceKey: "reassessment:u1:1:readiness:amber:green",
          missionInstanceId: null,
          readinessBefore: "amber",
          readinessAfter: "green",
          metadata: {},
          occurredAt: "2026-08-29T08:00:00.000Z",
        }}
      />,
    );

    expect(screen.getByTestId("journey-status")).toBeInTheDocument();
    expect(screen.getByText(/Amber → Green/i)).toBeInTheDocument();
    expect(screen.getByText(/what happens next/i)).toBeInTheDocument();
    expect(screen.queryByText(/guaranteed|approved|approval odds/i)).not.toBeInTheDocument();
  });

  it("shows the next deterministic reassessment date", () => {
    render(
      <JourneyStatusCard
        state={{
          ...baseState,
          stage: "cooldown",
          lastReadinessBand: "amber",
          nextReassessmentAt: "2026-09-15T08:00:00.000Z",
        }}
        latestOutcome={null}
      />,
    );

    expect(screen.getByText(/15 Sept 2026/i)).toBeInTheDocument();
    expect(screen.getByText(/reassess/i)).toBeInTheDocument();
  });

  it("renders nothing when Journey state is unavailable", () => {
    const { container } = render(<JourneyStatusCard state={null} latestOutcome={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});
