import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ExperimentForm } from "@/components/admin/experiment-form";

afterEach(cleanup);

describe("admin experiment form", () => {
  it("offers only approved presentation variants for the selected surface", () => {
    render(<ExperimentForm />);

    const surface = screen.getByLabelText("Experiment surface") as HTMLSelectElement;
    const primary = screen.getByLabelText("Primary presentation") as HTMLSelectElement;
    const secondary = screen.getByLabelText("Secondary presentation") as HTMLSelectElement;

    expect(Array.from(primary.options).map((option) => option.value)).toEqual(["control", "reverse"]);
    expect(Array.from(secondary.options).map((option) => option.value)).toEqual(["control", "reverse"]);

    fireEvent.change(surface, { target: { value: "journey_status_copy" } });
    const updatedPrimary = screen.getByLabelText("Primary presentation") as HTMLSelectElement;
    const updatedSecondary = screen.getByLabelText("Secondary presentation") as HTMLSelectElement;
    expect(Array.from(updatedPrimary.options).map((option) => option.value)).toEqual(["control", "concise"]);
    expect(Array.from(updatedSecondary.options).map((option) => option.value)).toEqual(["control", "concise"]);
  });
});
