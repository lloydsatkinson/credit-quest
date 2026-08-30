import { describe, expect, it } from "vitest";
import { renderApprovedReminderTemplate } from "@/lib/reminders/templates";

describe("approved reminder templates", () => {
  it("uses service language and never promises approval", () => {
    const copy = renderApprovedReminderTemplate({
      templateKey: "readiness-changed-v1",
      dueAt: "2026-08-29T08:00:00.000Z",
      readinessBefore: "amber",
      readinessAfter: "green",
      safeMode: false,
      ageMode: "adult",
    });
    const all = `${copy.subject} ${copy.text} ${copy.html}`.toLowerCase();
    expect(all).toContain("credit quest");
    expect(all).not.toMatch(/guaranteed|approved|approval odds|apply now/);
  });

  it("does not encourage products for education mode", () => {
    const copy = renderApprovedReminderTemplate({
      templateKey: "reassessment-due-v1",
      dueAt: "2026-09-01T08:00:00.000Z",
      safeMode: false,
      ageMode: "education",
    });
    expect(copy.text.toLowerCase()).not.toMatch(/credit card|apply|eligibility/);
  });
});
