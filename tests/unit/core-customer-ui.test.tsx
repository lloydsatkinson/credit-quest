import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OnboardingForm } from "@/components/onboarding/onboarding-form";
import { AccountsClient } from "@/components/accounts/accounts-client";
import { PassportDetail } from "@/components/passport/passport-detail";
import { ReadinessDetail } from "@/components/readiness/readiness-detail";
import { OfferCard } from "@/components/offers/offer-card";
import { CommercialGatewayCard } from "@/components/commercial/commercial-gateway-card";
import { ActionScreen } from "@/components/actions/action-screen";
import type { ApplicationReadiness, CreditPassport, OfferDefinition, ProviderDefinition } from "@/lib/domain/types";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/lib/events", () => ({ trackEvent: vi.fn().mockResolvedValue(undefined) }));

const providers: ProviderDefinition[] = [{
  id: "11111111-1111-1111-1111-111111111111",
  slug: "demo-bank",
  displayName: "Demo Bank",
  providerType: "card_issuer",
  allowedHosts: ["demo.example"],
  active: true,
}];

const passport: CreditPassport = {
  pillars: [{
    id: "identity",
    title: "Identity",
    status: "green",
    strength: "Address evidence is consistent.",
    helping: ["Electoral roll evidence"],
    hurting: [],
    unknowns: [],
    nextActions: ["Keep details consistent"],
  }],
};

const readiness: ApplicationReadiness = {
  state: "amber",
  headline: "Build a little more evidence first.",
  reasons: ["Recent evidence is still developing."],
  avoid: ["Repeated applications"],
  actions: ["Complete the next mission"],
  reassessAt: null,
  daysUntilReassessment: null,
};

const offer: OfferDefinition = {
  id: "example-offer",
  provider: "Example provider",
  productName: "Example builder",
  category: "credit_builder_card",
  affiliateUrl: "https://example.com",
  disclosure: "Demo disclosure",
  minAge: 18,
  active: true,
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("premium customer surfaces", () => {
  it("uses the premium panel and field system in onboarding", () => {
    render(<OnboardingForm />);
    const panel = screen.getByTestId("onboarding-form-panel");
    expect(panel.className).toContain("cq-panel");
    expect(panel.className).not.toContain("bg-white");
    expect(screen.getByTestId("dob").className).toContain("cq-field");
  });

  it("uses premium Accounts panels without changing safe data collection", () => {
    render(<AccountsClient initialAccounts={[]} providers={providers} />);
    const panel = screen.getByTestId("accounts-add-panel");
    expect(panel.className).toContain("cq-panel");
    expect(panel.className).not.toContain("bg-white");
    expect(screen.getByText(/never enter your full card number/i)).not.toBeNull();
  });

  it("uses premium Passport and Readiness semantic panels", () => {
    const { rerender } = render(<PassportDetail passport={passport} />);
    expect(screen.getByTestId("passport-pillar-identity").className).toContain("cq-panel");

    rerender(<ReadinessDetail readiness={readiness} />);
    expect(screen.getByTestId("readiness-overview").className).toContain("cq-panel");
    expect(screen.getByText(/not a lender approval prediction/i)).not.toBeNull();
  });

  it("uses premium optional-commercial cards while retaining sandbox disclosure", () => {
    const { rerender } = render(<OfferCard offer={offer} />);
    expect(screen.getByTestId("offer-card-example-offer").className).toContain("cq-panel");
    expect(screen.getByText(/Demo only — no application is sent/i)).not.toBeNull();

    rerender(<CommercialGatewayCard route={{
      id: "route-1",
      routeKey: "demo-route",
      partnerDisplayName: "Sandbox partner",
      disclosure: { id: "disclosure-1", body: "Sandbox disclosure" },
    }} />);
    const routeCard = document.querySelector('[data-route-key="demo-route"]');
    expect(routeCard?.className).toContain("cq-panel");
    expect(screen.getByText(/no lender or credit application will be contacted/i)).not.toBeNull();
  });

  it("keeps mission actions inside the premium visual system", () => {
    render(<ActionScreen
      missionTitle="Set up a direct debit"
      rationale="Protect your payment record."
      missionInstanceId="mission-1"
      targetLabel="Demo Bank · ending 1234"
      resolvedAction={{
        actionId: "action-1",
        mode: "external_link",
        providerName: "Demo Bank",
        destinationUrl: "https://demo.example",
        instructions: "Use the provider's secure service.",
        verificationMode: "self_confirm",
        fallbackUsed: false,
      }}
    />);
    expect(screen.getByTestId("mission-action-shell").className).toContain("text-white");
    expect(screen.getByTestId("action-instructions-panel").className).toContain("cq-panel");
    expect(screen.getByText(/does not complete the mission/i)).not.toBeNull();
  });
});
