import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { InAppReminders } from "@/components/journey/in-app-reminders";

const reminder = {
  id: "r1",
  reason: "reassessment_due",
  dueAt: "2026-09-01T08:00:00.000Z",
  templateKey: "reassessment-due-v1",
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("InAppReminders", () => {
  it("shows factual review prompts without urgency", () => {
    render(<InAppReminders reminders={[reminder]} />);

    expect(screen.getByText(/review your Credit Quest position/i)).toBeTruthy();
    expect(screen.queryByText(/act now|limited time|approved/i)).toBeNull();
  });

  it("renders at most three reminders", () => {
    const { container } = render(<InAppReminders reminders={[
      reminder,
      { id: "r2", reason: "mission_incomplete", dueAt: "2026-09-01T08:00:00.000Z", templateKey: "mission-incomplete-v1" },
      { id: "r3", reason: "cooldown_ending", dueAt: "2026-09-01T08:00:00.000Z", templateKey: "cooldown-ending-v1" },
      { id: "r4", reason: "readiness_changed", dueAt: "2026-09-01T08:00:00.000Z", templateKey: "readiness-changed-v1" },
    ]} />);

    expect(container.querySelectorAll('[data-testid="in-app-reminder"]')).toHaveLength(3);
  });

  it("records only reminder reason and template exposure", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    render(<InAppReminders reminders={[reminder]} />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const payload = JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body));
    expect(payload).toEqual({
      name: "journey_reminder_shown",
      metadata: { reason: "reassessment_due", templateKey: "reassessment-due-v1" },
    });
  });
});
