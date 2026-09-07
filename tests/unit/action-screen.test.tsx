import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ActionPage from "@/app/actions/[missionInstanceId]/page";
import { ActionScreen } from "@/components/actions/action-screen";

void ActionPage;
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

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

    expect(screen.getByTestId("mission-action-shell")).not.toBeNull();
    expect(screen.getByText("One clear action", { exact: true })).not.toBeNull();
    expect(screen.getByText("What happens next", { exact: true })).not.toBeNull();
    expect(screen.getByText(/operated by GOV\.UK/i)).not.toBeNull();
    expect(screen.getByText(/does not mean the mission is complete/i)).not.toBeNull();
    expect(screen.queryByText(/mission completed/i)).toBeNull();
    expect(screen.getByRole("button", { name: /continue to GOV\.UK/i })).not.toBeNull();
  });

  it("opens an external action in a new tab so Credit Quest stays available for the return flow", async () => {
    const open = vi.fn();
    vi.stubGlobal("open", open);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        attemptId: "attempt-1",
        destinationUrl: "https://www.gov.uk/register-to-vote",
      }),
    }));

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

    fireEvent.click(screen.getByRole("button", { name: /continue to GOV\.UK/i }));

    await waitFor(() => {
      expect(open).toHaveBeenCalledWith(
        "https://www.gov.uk/register-to-vote",
        "_blank",
        "noopener,noreferrer",
      );
    });
  });

  it("provides a protected mission action page", () => {
    expect(typeof ActionPage).toBe("function");
  });
});
