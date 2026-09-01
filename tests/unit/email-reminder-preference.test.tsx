import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EmailReminderPreference } from "@/components/journey/email-reminder-preference";

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.unstubAllGlobals();
});

describe("EmailReminderPreference", () => {
  it("describes opt-in service reminders without promotional language", () => {
    render(<EmailReminderPreference initialEnabled={false} demo={true} />);
    expect(screen.getByText(/Email me when it’s time to review my Credit Quest plan/i)).toBeTruthy();
    expect(screen.getByText(/Service reminders only\. This does not sign you up for marketing\./i)).toBeTruthy();
    expect(screen.queryByText(/deals|discounts|exclusive offers/i)).toBeNull();
  });

  it("records preference telemetry only after the user changes it", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    render(<EmailReminderPreference initialEnabled={false} demo={true} />);
    expect(JSON.stringify(fetchMock.mock.calls)).not.toContain("journey_email_preference_changed");

    fireEvent.click(screen.getByRole("checkbox"));

    await waitFor(() => expect(JSON.stringify(fetchMock.mock.calls)).toContain("journey_email_preference_changed"));
    const call = fetchMock.mock.calls.find(([, init]) => String((init as RequestInit | undefined)?.body ?? "").includes("journey_email_preference_changed"));
    const payload = JSON.parse(String((call?.[1] as RequestInit).body));
    expect(payload).toEqual({
      name: "journey_email_preference_changed",
      metadata: { enabled: true, mode: "demo" },
    });
  });
});
