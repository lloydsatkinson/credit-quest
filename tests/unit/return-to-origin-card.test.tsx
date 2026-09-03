import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ReturnToOriginCard } from "@/components/recovery/return-to-origin-card";

const props = {
  recoveryJourneyId: "a6d4e69a-73bf-4a02-b196-4117be8e8722",
  partnerDisplayName: "Example Bank",
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("ReturnToOriginCard", () => {
  it("uses ready-to-check language without implying approval or qualification", () => {
    render(<ReturnToOriginCard {...props} />);

    expect(screen.getByText(/You’ve made the progress we were waiting for/i)).toBeTruthy();
    expect(screen.getByText(/ready to check eligibility again/i)).toBeTruthy();
    expect(screen.getByText(/does not mean Example Bank will approve/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Continue with Example Bank" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Not now/i })).toBeTruthy();

    expect(document.body.textContent).not.toMatch(/you now qualify|you'll be approved|will accept you/i);
  });

  it("posts only the recovery journey id and explicit continue choice", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: vi.fn().mockResolvedValue({ error: "not available" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<ReturnToOriginCard {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Continue with Example Bank" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/recovery/return");
    expect(JSON.parse(String(init.body))).toEqual({
      recoveryJourneyId: props.recoveryJourneyId,
      customerChoice: "continue",
    });
    expect(String(init.body)).not.toMatch(/partner|environment|destination|callback|readiness|userId/i);
  });

  it("records an explicit not-now choice without needing a destination", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ status: "declined", returnAttemptId: "attempt-1" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<ReturnToOriginCard {...props} />);
    fireEvent.click(screen.getByRole("button", { name: /Not now/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({
      recoveryJourneyId: props.recoveryJourneyId,
      customerChoice: "decline",
    });
    expect(await screen.findByText(/No problem/i)).toBeTruthy();
  });

  it("fails closed if a supposedly successful response contains a non-sandbox destination", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        status: "redirect",
        returnAttemptId: "attempt-1",
        destinationUrl: "https://attacker.example/steal",
        partnerDisplayName: "Example Bank",
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<ReturnToOriginCard {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Continue with Example Bank" }));

    expect(await screen.findByText(/return route is not available right now/i)).toBeTruthy();
  });
});
