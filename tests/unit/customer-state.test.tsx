import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CustomerErrorState,
  CustomerLoadingState,
  CustomerNotFoundState,
} from "@/components/customer/customer-state";

afterEach(() => cleanup());

describe("customer route states", () => {
  it("renders loading inside the premium customer shell", () => {
    render(<CustomerLoadingState label="Loading your plan…" />);

    expect(screen.getByTestId("customer-shell")).not.toBeNull();
    expect(screen.getByTestId("customer-loading-state").className).toContain("cq-panel");
    expect(screen.getByRole("status")).not.toBeNull();
  });

  it("renders a premium not-found state with a safe route home", () => {
    render(<CustomerNotFoundState title="That page is not available" body="Return to your Quest Feed." />);

    expect(screen.getByTestId("customer-not-found-state").className).toContain("cq-panel");
    expect(screen.getByRole("link", { name: /back to quest/i }).getAttribute("href")).toBe("/dashboard");
  });

  it("renders a recoverable premium error state", () => {
    const reset = vi.fn();
    render(<CustomerErrorState reset={reset} />);

    const state = screen.getByTestId("customer-error-state");
    expect(state.className).toContain("cq-panel");
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(reset).toHaveBeenCalledTimes(1);
  });
});
