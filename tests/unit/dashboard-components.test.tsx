import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { NextMissionCard } from "@/components/dashboard/next-mission-card";
import type { RankedMission } from "@/lib/domain/types";

afterEach(() => cleanup());

const rankedMission: RankedMission = {
  priorityScore: 90,
  reasons: ["You are not registered."],
  mission: {
    id: "m1", slug: "register-electoral-roll", title: "Get on the electoral roll",
    description: "Register at your current address.", rationale: "It helps lenders verify your address.",
    stage: "setup", impact: "high", questScoreDelta: 10, priorityWeight: 90, safeModeAllowed: true,
    scope: "profile",
    isEligible: () => true,
  },
};

describe("NextMissionCard", () => {
  it("renders the action, rationale, impact, score movement and timing", () => {
    render(<NextMissionCard rankedMission={rankedMission} reviewTiming="30 days" />);
    expect(screen.getByText("Get on the electoral roll")).not.toBeNull();
    expect(screen.getByText(/helps lenders verify/i)).not.toBeNull();
    expect(screen.getByText(/high impact/i)).not.toBeNull();
    expect(screen.getByText(/\+10 Quest Score/i)).not.toBeNull();
    expect(screen.getByText(/30 days/i)).not.toBeNull();
  });

  it("shows Start before a mission has begun", () => {
    render(<NextMissionCard rankedMission={rankedMission} progress={{ state: "not_started" }} />);
    expect(screen.getByRole("button", { name: "Start this mission" })).not.toBeNull();
    expect(screen.queryByRole("button", { name: "Mark complete" })).toBeNull();
  });

  it("routes a started mission into the Action Screen instead of offering immediate completion", () => {
    render(<NextMissionCard
      rankedMission={rankedMission}
      progress={{ state: "started" }}
      actionHref="/actions/11111111-1111-4111-8111-111111111111"
    />);
    expect(screen.getByRole("link", { name: /continue this mission/i }).getAttribute("href"))
      .toBe("/actions/11111111-1111-4111-8111-111111111111");
    expect(screen.queryByRole("button", { name: "Mark complete" })).toBeNull();
  });

  it("renders partner disclosure when an offer exists", () => {
    render(<NextMissionCard rankedMission={rankedMission} offer={{ id: "o1", provider: "Demo", productName: "Demo Card", category: "credit_builder_card", affiliateUrl: "https://example.com", disclosure: "Partner link — Credit Quest may earn a commission.", minAge: 18, active: true }} />);
    expect(screen.getByText(/may earn a commission/i)).not.toBeNull();
  });
});
