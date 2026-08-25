import { describe, expect, it } from "vitest";
import { eventPayloadSchema } from "@/lib/events";

describe("event payload validation", () => {
  it("accepts supported event names", () => {
    expect(eventPayloadSchema.safeParse({ name: "offer_clicked", metadata: { offerId: "o1" } }).success).toBe(true);
  });

  it("rejects unsupported events and client-supplied user ids", () => {
    expect(eventPayloadSchema.safeParse({ name: "credit_approved" }).success).toBe(false);
    expect(eventPayloadSchema.safeParse({ name: "offer_clicked", userId: "someone-else" }).success).toBe(false);
  });
});
