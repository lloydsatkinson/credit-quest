import { describe, expect, it } from "vitest";
import { isAllowedDestination, resolveAction } from "@/lib/domain/action-resolver";
import type { ActionDefinition, ProviderDefinition } from "@/lib/domain/types";

const provider: ProviderDefinition = {
  id: "p1",
  slug: "issuer",
  displayName: "Issuer",
  providerType: "card_issuer",
  allowedHosts: ["issuer.example"],
  active: true,
};

const action = (overrides: Partial<ActionDefinition>): ActionDefinition => ({
  id: "a1",
  actionKey: "k",
  missionSlug: "set-up-direct-debit",
  providerId: null,
  accountType: null,
  mode: "external_link",
  destinationUrl: "https://issuer.example/manage",
  instructions: "Manage your account",
  verificationMode: "self_confirm",
  safeModeAllowed: true,
  minAge: null,
  priority: 100,
  active: true,
  ...overrides,
});

describe("action resolver", () => {
  it("prefers exact provider and account type over generic actions", () => {
    const resolved = resolveAction({
      missionSlug: "set-up-direct-debit",
      provider,
      providers: [provider],
      accountType: "credit_card",
      actions: [
        action({ id: "generic", actionKey: "generic", destinationUrl: "/accounts", mode: "internal_flow" }),
        action({ id: "exact", actionKey: "exact", providerId: "p1", accountType: "credit_card" }),
      ],
      age: 36,
      safeMode: false,
    });

    expect(resolved?.actionId).toBe("exact");
    expect(resolved?.fallbackUsed).toBe(false);
  });

  it("resolves a profile-scoped official action using the action provider allowlist", () => {
    const gov: ProviderDefinition = {
      id: "gov",
      slug: "gov-uk",
      displayName: "GOV.UK",
      providerType: "government",
      allowedHosts: ["www.gov.uk", "gov.uk"],
      active: true,
    };
    const resolved = resolveAction({
      missionSlug: "register-electoral-roll",
      provider: null,
      providers: [gov],
      accountType: null,
      actions: [action({
        id: "electoral",
        actionKey: "electoral-roll-gov-uk",
        missionSlug: "register-electoral-roll",
        providerId: "gov",
        destinationUrl: "https://www.gov.uk/register-to-vote",
        verificationMode: "self_confirm_review",
      })],
      age: 36,
      safeMode: false,
    });

    expect(resolved?.actionId).toBe("electoral");
    expect(resolved?.providerName).toBe("GOV.UK");
    expect(resolved?.destinationUrl).toBe("https://www.gov.uk/register-to-vote");
    expect(resolved?.fallbackUsed).toBe(false);
  });

  it("rejects an external destination outside the provider allowlist", () => {
    expect(isAllowedDestination("https://evil.example/phish", provider)).toBe(false);
  });

  it("accepts an https destination on the provider allowlist", () => {
    expect(isAllowedDestination("https://issuer.example/manage", provider)).toBe(true);
  });

  it("accepts an internal route without a provider", () => {
    expect(isAllowedDestination("/offers", null)).toBe(true);
  });

  it("suppresses an adult-only action for a 17 year old", () => {
    expect(resolveAction({
      missionSlug: "build-revolving-history",
      provider: null,
      providers: [],
      accountType: null,
      actions: [action({
        missionSlug: "build-revolving-history",
        minAge: 18,
        mode: "referral",
        destinationUrl: "/offers",
      })],
      age: 17,
      safeMode: false,
    })).toBeNull();
  });

  it("suppresses an action that is not allowed in Safe Mode", () => {
    expect(resolveAction({
      missionSlug: "build-revolving-history",
      provider: null,
      providers: [],
      accountType: null,
      actions: [action({
        missionSlug: "build-revolving-history",
        minAge: 18,
        safeModeAllowed: false,
        mode: "referral",
        destinationUrl: "/offers",
      })],
      age: 36,
      safeMode: true,
    })).toBeNull();
  });
});
