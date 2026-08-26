import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OnboardingForm } from "@/components/onboarding/onboarding-form";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

function goToWorkStep() {
  render(<OnboardingForm />);
  fireEvent.change(screen.getByTestId("dob"), { target: { value: "1990-01-01" } });
  fireEvent.click(screen.getByTestId("next"));
}

function goToCreditStep() {
  goToWorkStep();
  fireEvent.click(screen.getByTestId("next"));
  fireEvent.click(screen.getByTestId("next"));
  fireEvent.click(screen.getByTestId("next"));
}

describe("OnboardingForm clarity", () => {
  beforeEach(() => {
    push.mockReset();
  });

  it("does not ask unemployed users to choose an income band", () => {
    goToWorkStep();

    const selects = screen.getAllByRole("combobox");
    fireEvent.change(selects[0], { target: { value: "unemployed" } });

    expect(screen.getAllByRole("combobox")).toHaveLength(1);
  });

  it("visibly labels revolving credit utilisation as a percentage", () => {
    goToCreditStep();
    fireEvent.click(screen.getByRole("button", { name: "Yes" }));

    expect(screen.queryByText("Credit utilisation (%)")).not.toBeNull();
    expect(screen.queryByText(/enter 30/i)).not.toBeNull();
  });
});
