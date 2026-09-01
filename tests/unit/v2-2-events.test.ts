import { describe, expect, it } from "vitest";
import { eventNames, eventPayloadSchema } from "@/lib/events";

const v22Names = [
  "journey_status_shown",
  "journey_reassessment_completed",
  "journey_readiness_changed",
  "journey_reminder_shown",
  "journey_email_preference_changed",
  "journey_email_sent",
  "commercial_routes_shown",
  "referral_consent_accepted",
  "referral_consent_declined",
  "sandbox_referral_created",
  "experiment_exposed",
] as const;

describe("V2.2 analytics taxonomy", () => {
  it("accepts only the controlled V2.2 event names", () => {
    for (const name of v22Names) {
      expect(eventNames).toContain(name);
      expect(eventPayloadSchema.safeParse({ name, metadata: { source: "test" } }).success).toBe(true);
    }
    expect(eventPayloadSchema.safeParse({ name: "commercial_revenue_ranked", metadata: {} }).success).toBe(false);
  });
});
