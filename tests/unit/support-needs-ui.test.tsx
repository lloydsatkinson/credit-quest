import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SupportNeedsProfile } from "@/components/recovery/support-needs-profile";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("SupportNeedsProfile", () => {
  it("asks only what would make Credit Quest easier to use", () => {
    render(<SupportNeedsProfile initialNeeds={[]} demo={true} />);

    expect(screen.getByRole("heading", { name: /would anything make credit quest easier for you to use right now/i })).toBeTruthy();
    expect(screen.getByText(/you do not need to tell us why/i)).toBeTruthy();
    expect(screen.getByLabelText(/use simpler explanations/i)).toBeTruthy();
    expect(screen.getByLabelText(/make text larger/i)).toBeTruthy();
    expect(screen.getByLabelText(/show fewer steps at once/i)).toBeTruthy();
    expect(screen.getByLabelText(/give me more time/i)).toBeTruthy();
    expect(screen.getByLabelText(/reduce motion and animation/i)).toBeTruthy();
    expect(screen.getByLabelText(/help me remember/i)).toBeTruthy();
    expect(screen.getByLabelText(/i’d prefer human support/i)).toBeTruthy();
    expect(screen.getByLabelText(/help me with digital steps/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /save support preferences/i })).toBeTruthy();
  });

  it("contains no medical diagnosis capture and explains the Safe Mode boundary", () => {
    render(<SupportNeedsProfile initialNeeds={[]} demo={true} />);

    expect(screen.queryByLabelText(/diagnosis/i)).toBeNull();
    expect(screen.queryByLabelText(/medical/i)).toBeNull();
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.getByText(/choosing support does not change your credit readiness or automatically turn on safe mode/i)).toBeTruthy();
  });

  it("saves only the selected functional codes", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ persisted: false, needs: ["larger_text", "more_time"] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<SupportNeedsProfile initialNeeds={[]} demo={true} />);
    fireEvent.click(screen.getByLabelText(/make text larger/i));
    fireEvent.click(screen.getByLabelText(/give me more time/i));
    fireEvent.click(screen.getByRole("button", { name: /save support preferences/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(String((init as RequestInit).body))).toEqual({
      needs: ["larger_text", "more_time"],
    });
  });
});
