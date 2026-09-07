import { readFileSync } from "node:fs";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { WaitingReviewCard } from "@/components/dashboard/waiting-review-card";

afterEach(cleanup);

describe("standard Quest waiting review state", () => {
  it("explains that a submitted electoral-roll mission is waiting for review instead of saying the user is up to date", () => {
    render(
      <WaitingReviewCard
        missionSlug="register-electoral-roll"
        missionTitle="Get on the electoral roll"
        nextReviewAt="2026-10-07T11:42:58.064Z"
        reviewCount={1}
      />,
    );

    expect(screen.getByText(/electoral-roll registration is in review/i)).not.toBeNull();
    expect(screen.getByText(/7 October 2026/i)).not.toBeNull();
    expect(screen.queryByText(/up to date for now/i)).toBeNull();
  });

  it("keeps the most recently submitted mission visible when more than one item is in review", () => {
    render(
      <WaitingReviewCard
        missionSlug="build-revolving-history"
        missionTitle="Consider building revolving credit history"
        nextReviewAt="2026-10-07T14:13:16.007Z"
        reviewCount={2}
      />,
    );

    expect(screen.getByText(/revolving-credit update is in review/i)).not.toBeNull();
    expect(screen.getByText(/2 items currently in review/i)).not.toBeNull();
    expect(screen.getByText(/7 October 2026/i)).not.toBeNull();
  });

  it("uses open action attempts to keep the latest submitted review visible in the normal seven-card Quest Feed", () => {
    const source = readFileSync("app/dashboard/page.tsx", "utf8");

    expect(source).toContain("WaitingReviewCard");
    expect(source).toContain("waitingReviewItems");
    expect(source).toContain("listOpenActionAttempts");
    expect(source).toContain("reviewCount={waitingReviewItems.length}");
  });

  it("does not expose a Passport restart link while the electoral-roll mission is in review", () => {
    const source = readFileSync("app/dashboard/page.tsx", "utf8");

    expect(source).toContain('electoralRollMission.instance.state !== "in_review"');
  });
});
