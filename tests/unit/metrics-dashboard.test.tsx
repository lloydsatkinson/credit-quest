import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MetricsDashboard } from "@/components/admin/metrics-dashboard";

const metrics = {
  available: true as const,
  windowDays: 30,
  journey: {
    onboardingCompleted: 12,
    missionStarted: 10,
    missionCompleted: 7,
    reassessments: 4,
    readinessChanged: 3,
    readinessMovement: { red_to_amber: 1, amber_to_green: 1, other: 1 },
    remindersSent: 5,
  },
  commercial: {
    sandboxReferrals: 2,
    consentAccepted: 2,
    revenueEvents: 0,
    confirmedRevenueMinor: 0,
  },
};

afterEach(cleanup);

describe("V2.2 admin metrics", () => {
  it("puts customer progress before commercial reporting", () => {
    render(<MetricsDashboard result={metrics} />);
    const progress = screen.getByRole("heading", { name: "Customer progress" });
    const commercial = screen.getByRole("heading", { name: "Commercial readiness" });
    expect(progress.compareDocumentPosition(commercial) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByText(/Revenue is reporting only/i)).toBeTruthy();
  });

  it("shows unavailable rather than zero when reads fail", () => {
    render(<MetricsDashboard result={{ available: false, reason: "unavailable" }} />);
    expect(screen.getByText(/Metrics are temporarily unavailable/i)).toBeTruthy();
    expect(screen.queryByText("£0.00")).toBeNull();
  });
});
