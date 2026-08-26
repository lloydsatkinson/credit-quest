import { describe, expect, it } from "vitest";
import { applyActionResponse } from "@/lib/domain/action-lifecycle";

const now = new Date("2026-08-26T12:00:00Z");

describe("action lifecycle", () => {
  it("puts electoral roll submission into review without claiming registration", () => {
    const result = applyActionResponse({
      missionSlug: "register-electoral-roll",
      response: "submitted",
      now,
    });
    expect(result.attemptStatus).toBe("submitted");
    expect(result.missionState).toBe("in_review");
    expect(result.profilePatch).toEqual({});
    expect(result.nextReviewAt).toBe("2026-09-25T12:00:00.000Z");
  });

  it("only confirmed registration completes electoral roll and patches the profile", () => {
    const result = applyActionResponse({
      missionSlug: "register-electoral-roll",
      response: "confirmed_registered",
      now,
    });
    expect(result.attemptStatus).toBe("verified");
    expect(result.missionState).toBe("completed");
    expect(result.profilePatch).toEqual({ electoralRoll: true });
  });

  it("self-confirming direct debit updates only the target account", () => {
    const result = applyActionResponse({
      missionSlug: "set-up-direct-debit",
      response: "completed",
      now,
    });
    expect(result.attemptStatus).toBe("self_confirmed");
    expect(result.missionState).toBe("completed");
    expect(result.profilePatch).toEqual({});
    expect(result.accountPatch).toEqual({ directDebitStatus: "yes" });
  });

  it("starting an application cooldown creates cooldown state rather than completion", () => {
    const result = applyActionResponse({
      missionSlug: "application-cooldown",
      response: "started",
      now,
    });
    expect(result.attemptStatus).toBe("verified");
    expect(result.missionState).toBe("cooldown");
    expect(result.nextReviewAt).toBe("2026-09-25T12:00:00.000Z");
  });

  it("keeps an unfinished external action started", () => {
    const result = applyActionResponse({
      missionSlug: "set-up-direct-debit",
      response: "not_finished",
      now,
    });
    expect(result.attemptStatus).toBe("returned");
    expect(result.missionState).toBe("started");
  });

  it("defers an action for seven days when the user chooses do later", () => {
    const result = applyActionResponse({
      missionSlug: "reduce-utilisation",
      response: "do_later",
      now,
    });
    expect(result.missionState).toBe("deferred");
    expect(result.nextReviewAt).toBe("2026-09-02T12:00:00.000Z");
  });
});
