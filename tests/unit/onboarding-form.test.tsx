import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OnboardingForm } from "@/components/onboarding/onboarding-form";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

afterEach(() => cleanup());

function goToWorkStep() {
  render(<OnboardingForm />);
  fireEvent.change(screen.getByTestId("dob"), { target: { value: "1990-01-01" } });
  fireEvent.click(screen.getByTestId("next"));
}

function completeWorkStep() {
  fireEvent.change(screen.getByLabelText("Employment status"), { target: { value: "employed" } });
  fireEvent.change(screen.getByLabelText("Annual personal income band"), { target: { value: "30_50k" } });
  fireEvent.click(screen.getByTestId("next"));
}

function goToIdentityStep() {
  goToWorkStep();
  completeWorkStep();
  fireEvent.change(screen.getByLabelText("Housing situation"), { target: { value: "rent" } });
  fireEvent.click(screen.getByTestId("next"));
}

function goToCreditStep() {
  goToIdentityStep();
  fireEvent.click(screen.getByRole("button", { name: "No" }));
  fireEvent.click(screen.getByTestId("next"));
}

describe("OnboardingForm clarity", () => {
  beforeEach(() => {
    push.mockReset();
  });

  it("does not preselect employment or income", () => {
    goToWorkStep();
    expect((screen.getByLabelText("Employment status") as HTMLSelectElement).value).toBe("");
    expect(screen.queryByLabelText("Annual personal income band")).toBeNull();
  });

  it("asks for income only after an applicable employment choice", () => {
    goToWorkStep();
    fireEvent.change(screen.getByLabelText("Employment status"), { target: { value: "employed" } });
    expect((screen.getByLabelText("Annual personal income band") as HTMLSelectElement).value).toBe("");
  });

  it("does not ask unemployed users to choose an income band", () => {
    goToWorkStep();
    fireEvent.change(screen.getByLabelText("Employment status"), { target: { value: "unemployed" } });
    expect(screen.queryByLabelText("Annual personal income band")).toBeNull();
    expect(screen.getByText(/no income band is needed/i)).not.toBeNull();
  });

  it("does not preselect housing", () => {
    goToWorkStep();
    completeWorkStep();
    expect((screen.getByLabelText("Housing situation") as HTMLSelectElement).value).toBe("");
  });

  it("lets the user explicitly say they do not know electoral-roll status", () => {
    goToIdentityStep();
    const unknown = screen.getByRole("button", { name: "I don't know" });
    expect(unknown.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(unknown);
    expect(unknown.getAttribute("aria-pressed")).toBe("true");
  });

  it("visibly labels revolving credit utilisation as a percentage", () => {
    goToCreditStep();
    fireEvent.click(screen.getByRole("button", { name: "Yes" }));

    expect(screen.queryByText("Credit utilisation (%)")).not.toBeNull();
    expect(screen.queryByText(/enter 30/i)).not.toBeNull();
    expect(screen.getByRole("button", { name: /don't know my utilisation/i })).not.toBeNull();
  });
});
