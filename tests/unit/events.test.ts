import { describe, expect, it } from "vitest";
import { eventPayloadSchema } from "@/lib/events";

describe("event payload validation", () => {
  it("accepts supported event names", () => {
    expect(eventPayloadSchema.safeParse({ name: "offer_clicked", metadata: { offerId: "o1" } }).success).toBe(true);
    expect(eventPayloadSchema.safeParse({ name: "mission_started", metadata: { missionSlug: "set-up-direct-debit" } }).success).toBe(true);
    expect(eventPayloadSchema.safeParse({ name: "mission_completed", metadata: { missionSlug: "set-up-direct-debit" } }).success).toBe(true);
    expect(eventPayloadSchema.safeParse({ name: "mission_deferred", metadata: { missionSlug: "set-up-direct-debit" } }).success).toBe(true);
    expect(eventPayloadSchema.safeParse({ name: "mission_dismissed", metadata: { missionSlug: "set-up-direct-debit" } }).success).toBe(true);
    expect(eventPayloadSchema.safeParse({ name: "action_resolved", metadata: { missionSlug: "register-electoral-roll", actionId: "a1" } }).success).toBe(true);
    expect(eventPayloadSchema.safeParse({ name: "action_started", metadata: { missionSlug: "register-electoral-roll", actionId: "a1" } }).success).toBe(true);
    expect(eventPayloadSchema.safeParse({ name: "action_returned", metadata: { missionSlug: "register-electoral-roll" } }).success).toBe(true);
    expect(eventPayloadSchema.safeParse({ name: "action_submitted", metadata: { missionSlug: "register-electoral-roll" } }).success).toBe(true);
    expect(eventPayloadSchema.safeParse({ name: "action_self_confirmed", metadata: { missionSlug: "set-up-direct-debit" } }).success).toBe(true);
    expect(eventPayloadSchema.safeParse({ name: "action_verified", metadata: { missionSlug: "register-electoral-roll" } }).success).toBe(true);
    expect(eventPayloadSchema.safeParse({ name: "action_cancelled", metadata: { missionSlug: "register-electoral-roll" } }).success).toBe(true);
  });

  it("accepts Academy learning events", () => {
    const names = [
      "academy_card_shown",
      "academy_article_opened",
      "academy_article_completed",
      "academy_still_confused",
      "academy_search_used",
      "academy_related_mission_started",
    ];

    for (const name of names) {
      expect(eventPayloadSchema.safeParse({ name, metadata: { contentKey: "credit-file-basics" } }).success).toBe(true);
    }
  });

  it("rejects unsupported events and client-supplied user ids", () => {
    expect(eventPayloadSchema.safeParse({ name: "credit_approved" }).success).toBe(false);
    expect(eventPayloadSchema.safeParse({ name: "offer_clicked", userId: "someone-else" }).success).toBe(false);
  });
});
