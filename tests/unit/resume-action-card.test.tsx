import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ResumeActionCard } from "@/components/actions/resume-action-card";
import type { ActionAttempt } from "@/lib/domain/types";

afterEach(cleanup);

const attempt: ActionAttempt = {
  id: "11111111-1111-4111-8111-111111111111",
  userId: "u1",
  missionInstanceId: "22222222-2222-4222-8222-222222222222",
  actionRegistryId: "33333333-3333-4333-8333-333333333333",
  accountId: null,
  status: "started",
  startedAt: "2026-08-26T12:00:00.000Z",
  returnedAt: null,
  selfConfirmedAt: null,
  verifiedAt: null,
  nextReviewAt: null,
};

describe("ResumeActionCard", () => {
  it("uses electoral-roll submission language instead of generic completion", () => {
    render(<ResumeActionCard
      attempt={attempt}
      missionSlug="register-electoral-roll"
      missionTitle="Get on the electoral roll"
      providerLabel="GOV.UK"
    />);

    expect(screen.getByText(/welcome back/i)).not.toBeNull();
    expect(screen.getByRole("button", { name: /i submitted my registration/i })).not.toBeNull();
    expect(screen.getByRole("button", { name: /i started but did not finish/i })).not.toBeNull();
    expect(screen.queryByRole("button", { name: /mark complete/i })).toBeNull();
  });

  it("switches electoral roll to registration confirmation after the review wait", () => {
    render(<ResumeActionCard
      attempt={{ ...attempt, status: "submitted", nextReviewAt: "2026-09-25T12:00:00.000Z" }}
      missionSlug="register-electoral-roll"
      missionTitle="Get on the electoral roll"
      providerLabel="GOV.UK"
    />);

    expect(screen.getByRole("button", { name: /i'm now registered/i })).not.toBeNull();
    expect(screen.queryByRole("button", { name: /i submitted my registration/i })).toBeNull();
  });

  it("uses direct-debit completion language for a card action", () => {
    render(<ResumeActionCard
      attempt={{ ...attempt, accountId: "a1" }}
      missionSlug="set-up-direct-debit"
      missionTitle="Protect your payment history"
      providerLabel="My card"
    />);

    expect(screen.getByRole("button", { name: /i set up the direct debit/i })).not.toBeNull();
  });

  it("asks for account-opened confirmation when a product journey returns after review", () => {
    render(<ResumeActionCard
      attempt={{ ...attempt, status: "submitted", nextReviewAt: "2026-09-25T12:00:00.000Z" }}
      missionSlug="build-revolving-history"
      missionTitle="Consider building revolving credit history"
      providerLabel="Provider"
    />);

    expect(screen.getByRole("button", { name: /i opened the account/i })).not.toBeNull();
  });
});
