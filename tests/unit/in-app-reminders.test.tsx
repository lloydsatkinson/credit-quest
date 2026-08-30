import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { InAppReminders } from "@/components/journey/in-app-reminders";

describe("InAppReminders", () => {
  it("shows factual review prompts without urgency", () => {
    render(<InAppReminders reminders={[{
      id: "r1",
      reason: "reassessment_due",
      dueAt: "2026-09-01T08:00:00.000Z",
      templateKey: "reassessment-due-v1",
    }]} />);

    expect(screen.getByText(/review your Credit Quest position/i)).toBeTruthy();
    expect(screen.queryByText(/act now|limited time|approved/i)).toBeNull();
  });

  it("renders at most three reminders", () => {
    render(<InAppReminders reminders={[
      { id: "r1", reason: "reassessment_due", dueAt: "2026-09-01T08:00:00.000Z", templateKey: "reassessment-due-v1" },
      { id: "r2", reason: "mission_incomplete", dueAt: "2026-09-01T08:00:00.000Z", templateKey: "mission-incomplete-v1" },
      { id: "r3", reason: "cooldown_ending", dueAt: "2026-09-01T08:00:00.000Z", templateKey: "cooldown-ending-v1" },
      { id: "r4", reason: "readiness_changed", dueAt: "2026-09-01T08:00:00.000Z", templateKey: "readiness-changed-v1" },
    ]} />);

    expect(screen.getAllByTestId("in-app-reminder")).toHaveLength(3);
  });
});
