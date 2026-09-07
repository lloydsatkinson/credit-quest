import { readFileSync } from "node:fs";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { WaitingReviewCard } from "@/components/dashboard/waiting-review-card";

afterEach(cleanup);

describe("standard Quest waiting review state", () => {
  it("explains that a submitted mission is waiting for review instead of saying the user is up to date", () => {
    render(
      <WaitingReviewCard
        missionTitle="Get on the electoral roll"
        nextReviewAt="2026-10-07T11:42:58.064Z"
      />,
    );

    expect(screen.getByText(/registration is in review/i)).not.toBeNull();
    expect(screen.getByText(/7 October 2026/i)).not.toBeNull();
    expect(screen.queryByText(/up to date for now/i)).toBeNull();
  });

  it("uses the waiting review card in the normal seven-card Quest Feed", () => {
    const source = readFileSync("app/dashboard/page.tsx", "utf8");

    expect(source).toContain("WaitingReviewCard");
    expect(source).toContain("waitingReview");
  });
});
