import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AccountsClient } from "@/components/accounts/accounts-client";
import type { ProviderDefinition, UserAccount } from "@/lib/domain/types";

const providers: ProviderDefinition[] = [{
  id: "11111111-1111-1111-1111-111111111111",
  slug: "demo-bank",
  displayName: "Demo Bank",
  providerType: "card_issuer",
  allowedHosts: ["demo.example"],
  active: true,
}];

const existingAccount: UserAccount = {
  id: "a1",
  userId: "u1",
  providerId: providers[0].id,
  providerName: "Demo Bank",
  accountType: "credit_card",
  nickname: "Main card",
  lastFour: "1234",
  balanceMinor: 62000,
  creditLimitMinor: 100000,
  currency: "GBP",
  directDebitStatus: "no",
  source: "manual",
  active: true,
  lastVerifiedAt: null,
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("AccountsClient", () => {
  it("never asks for a full card number", () => {
    render(<AccountsClient initialAccounts={[]} providers={providers} />);

    expect(screen.queryByLabelText(/^card number$/i)).toBeNull();
    expect(screen.getByLabelText(/last four digits/i)).not.toBeNull();
    expect(screen.getByText(/never enter your full card number/i)).not.toBeNull();
  });

  it("can add more than one account without replacing the first", async () => {
    let sequence = 0;
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
      sequence += 1;
      return new Response(JSON.stringify({
        account: {
          id: `a${sequence}`,
          userId: "u1",
          providerId: providers[0].id,
          providerName: "Demo Bank",
          accountType: "credit_card",
          nickname: `Card ${sequence}`,
          lastFour: sequence === 1 ? "1111" : "2222",
          balanceMinor: null,
          creditLimitMinor: null,
          currency: "GBP",
          directDebitStatus: "unknown",
          source: "manual",
          active: true,
          lastVerifiedAt: null,
        },
      }), { status: 201, headers: { "content-type": "application/json" } });
    });

    render(<AccountsClient initialAccounts={[]} providers={providers} />);

    fireEvent.change(screen.getByLabelText(/account nickname/i), { target: { value: "Card 1" } });
    fireEvent.change(screen.getByLabelText(/last four digits/i), { target: { value: "1111" } });
    fireEvent.click(screen.getByRole("button", { name: /add account/i }));
    await waitFor(() => expect(screen.getByText(/Card 1/)).not.toBeNull());

    fireEvent.change(screen.getByLabelText(/account nickname/i), { target: { value: "Card 2" } });
    fireEvent.change(screen.getByLabelText(/last four digits/i), { target: { value: "2222" } });
    fireEvent.click(screen.getByRole("button", { name: /add account/i }));

    await waitFor(() => expect(screen.getByText(/Card 2/)).not.toBeNull());
    expect(screen.getByText(/Card 1/)).not.toBeNull();
  });

  it("lets the user update balance evidence for an existing card", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      expect(String(input)).toContain("/api/accounts/a1");
      expect(init?.method).toBe("PATCH");
      expect(JSON.parse(String(init?.body))).toMatchObject({
        balanceMinor: 28000,
        creditLimitMinor: 100000,
      });
      return new Response(JSON.stringify({
        account: { ...existingAccount, balanceMinor: 28000 },
      }), { status: 200, headers: { "content-type": "application/json" } });
    });

    render(<AccountsClient initialAccounts={[existingAccount]} providers={providers} />);
    const accountCard = screen.getByTestId("account-a1");
    fireEvent.click(within(accountCard).getByRole("button", { name: /edit/i }));

    const editForm = screen.getByTestId("edit-account-a1");
    fireEvent.change(within(editForm).getByLabelText(/current balance/i), { target: { value: "280" } });
    fireEvent.click(within(editForm).getByRole("button", { name: /save changes/i }));

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(within(screen.getByTestId("account-a1")).getByText(/balance £280\.00/i)).not.toBeNull());
  });
});
