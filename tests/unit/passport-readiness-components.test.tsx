import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { PassportCard } from "@/components/passport/passport-card";
import { PassportDetail } from "@/components/passport/passport-detail";
import { ReadinessCard } from "@/components/readiness/readiness-card";
import { ReadinessDetail } from "@/components/readiness/readiness-detail";
import type { ApplicationReadiness, CreditPassport } from "@/lib/domain/types";

afterEach(cleanup);

const readiness: ApplicationReadiness = {
  state: "green",
  headline: "Worth checking eligibility",
  reasons: ["The blockers Credit Quest currently checks are not present in the information you gave us."],
  avoid: ["Avoid going straight to a hard application when a soft-search route is available."],
  actions: ["Use a soft eligibility check where available before considering an application."],
  reassessAt: null,
  daysUntilReassessment: null,
};

const passport: CreditPassport = {
  pillars: [
    { id: "identity", title: "Identity & Traceability", status: "green", strength: "Identity signal in place.", helping: ["Electoral roll confirmed."], hurting: [], unknowns: [], nextActions: [] },
    { id: "payment_health", title: "Payment Health", status: "green", strength: "Payments look stable.", helping: ["No missed payments reported."], hurting: [], unknowns: [], nextActions: [] },
    { id: "debt_headroom", title: "Debt & Headroom", status: "amber", strength: "There is room to improve headroom.", helping: [], hurting: ["Utilisation is above the planning range."], unknowns: [], nextActions: ["Reduce utilisation where practical."] },
    { id: "affordability_stability", title: "Affordability & Stability", status: "unknown", strength: "Not assessed with current data.", helping: [], hurting: [], unknowns: ["Current profile data is not enough for a responsible affordability assessment."], nextActions: [] },
    { id: "application_readiness", title: "Application Readiness", status: "green", strength: "Worth checking eligibility", helping: readiness.reasons, hurting: [], unknowns: [], nextActions: readiness.actions },
  ],
};

describe("Passport and Readiness presentation", () => {
  it("renders all five Passport pillars with readable status words, including unknown affordability", () => {
    render(<PassportCard passport={passport} />);
    expect(screen.getAllByTestId("passport-pillar")).toHaveLength(5);
    expect(screen.getByText("Affordability & Stability")).not.toBeNull();
    expect(screen.getByText("Unknown", { exact: true })).not.toBeNull();
    expect(screen.getByRole("link", { name: /see my full passport/i }).getAttribute("href")).toBe("/passport");
  });

  it("explains Passport evidence without pretending to be a bureau or lender score", () => {
    render(<PassportDetail passport={passport} />);
    expect(screen.getByRole("heading", { name: "Your Credit Passport" })).not.toBeNull();
    expect(screen.getByText(/not a credit-reference-agency score/i)).not.toBeNull();
    expect(screen.getByText(/not enough for a responsible affordability assessment/i)).not.toBeNull();
  });

  it("renders green readiness with an explicit no-approval-prediction disclaimer", () => {
    render(<ReadinessCard readiness={readiness} />);
    expect(screen.getByText("Worth checking eligibility", { exact: true })).not.toBeNull();
    expect(screen.getByText(/not a lender approval prediction/i)).not.toBeNull();
    expect(screen.getByRole("link", { name: /understand my readiness/i }).getAttribute("href")).toBe("/readiness");
  });

  it("shows why, what to avoid and what to do without inventing a reassessment date", () => {
    render(<ReadinessDetail readiness={readiness} />);
    expect(screen.getByRole("heading", { name: "Can I apply yet?" })).not.toBeNull();
    expect(screen.getByText("Why", { exact: true })).not.toBeNull();
    expect(screen.getByText("What to avoid", { exact: true })).not.toBeNull();
    expect(screen.getByText("What to do next", { exact: true })).not.toBeNull();
    expect(screen.getByText(/no exact reassessment date/i)).not.toBeNull();
    expect(screen.getByText(/not a lender approval prediction/i)).not.toBeNull();
  });
});
