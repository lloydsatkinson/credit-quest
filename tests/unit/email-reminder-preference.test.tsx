import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EmailReminderPreference } from "@/components/journey/email-reminder-preference";

describe("EmailReminderPreference", () => {
  it("describes opt-in service reminders without promotional language", () => {
    render(<EmailReminderPreference initialEnabled={false} demo={true} />);
    expect(screen.getByText(/Email me when it’s time to review my Credit Quest plan/i)).toBeTruthy();
    expect(screen.getByText(/Service reminders only\. This does not sign you up for marketing\./i)).toBeTruthy();
    expect(screen.queryByText(/deals|discounts|exclusive offers/i)).toBeNull();
  });
});
