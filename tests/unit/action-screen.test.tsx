import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ActionScreen } from "@/components/actions/action-screen";

afterEach(cleanup);

describe("ActionScreen", () => {
  it("explains external ownership and does not claim completion", () => {
    render(<ActionScreen
      missionTitle="Get on the electoral roll"
      rationale="Address matching can help lenders verify your identity and residence."
      resolvedAction={{
        actionId: "a1",
        mode: "external_link",
        providerName: "GOV.UK",
        destinationUrl: "https://www.gov.uk/register-to-vote",
        instructions: "Use the official service to submit your registration.",
        verificationMode: "self_confirm_review",
        fallbackUsed: false,
      }}
      missionInstanceId="mi1"
    />);

    expect(screen.getByText(/operated by GOV\.UK/i)).not.toBeNull();
    expect(screen.getByText(/does not mean the mission is complete/i)).not.toBeNull();
    expect(screen.queryByText(/mission completed/i)).toBeNull();
    expect(screen.getByRole("button", { name: /continue to GOV\.UK/i })).not.toBeNull();
  });
});
