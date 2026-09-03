import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import RecoveryPage from "@/app/recovery/page";

afterEach(() => {
  cleanup();
});

describe("direct decline recovery customer entry", () => {
  it("uses the premium customer shell and neutral recovery copy", () => {
    render(<RecoveryPage />);

    expect(screen.getByTestId("customer-shell")).toBeTruthy();
    expect(screen.getByRole("heading", { name: /i’ve just been declined/i })).toBeTruthy();
    expect(screen.getByText(/credit quest can help you understand what to work on next/i)).toBeTruthy();
    expect(screen.getByLabelText(/what type of credit was it/i)).toBeTruthy();
    expect(screen.getByLabelText(/when were you declined/i)).toBeTruthy();
    expect(screen.getByLabelText(/did they give you a reason/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /build my recovery plan/i })).toBeTruthy();
  });

  it("does not present partner, live-routing or lender-diagnosis controls", () => {
    render(<RecoveryPage />);

    expect(screen.queryByLabelText(/partner/i)).toBeNull();
    expect(screen.queryByLabelText(/environment/i)).toBeNull();
    expect(screen.queryByLabelText(/return url/i)).toBeNull();
    expect(screen.queryByText(/we know why the lender declined you/i)).toBeNull();
  });
});
