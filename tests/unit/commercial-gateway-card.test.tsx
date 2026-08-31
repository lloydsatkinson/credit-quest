import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CommercialGatewayCard } from "@/components/commercial/commercial-gateway-card";

const route = {
  id: "00000000-0000-0000-0000-000000000001",
  routeKey: "sandbox-route",
  partnerDisplayName: "Credit Quest Sandbox Partner",
  disclosure: {
    id: "00000000-0000-0000-0000-000000000002",
    body: "Sandbox only. No lender is contacted.",
  },
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("CommercialGatewayCard", () => {
  it("shows disclosure before requiring explicit sandbox consent", () => {
    render(<CommercialGatewayCard route={route} />);

    expect(screen.getByText(/Sandbox only/i)).toBeTruthy();
    const checkbox = screen.getByRole("checkbox", {
      name: /I understand this is a sandbox referral/i,
    }) as HTMLInputElement;
    const button = screen.getByRole("button", {
      name: /Continue sandbox journey/i,
    }) as HTMLButtonElement;

    expect(checkbox.checked).toBe(false);
    expect(button.disabled).toBe(true);
  });

  it("posts only stable ids plus consent", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: vi.fn().mockResolvedValue({ error: "not available" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<CommercialGatewayCard route={route} />);
    fireEvent.click(screen.getByRole("checkbox", {
      name: /I understand this is a sandbox referral/i,
    }));
    fireEvent.click(screen.getByRole("button", {
      name: /Continue sandbox journey/i,
    }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(String(init.body))).toEqual({
      routeId: route.id,
      disclosureId: route.disclosure.id,
      consent: true,
    });
  });
});
