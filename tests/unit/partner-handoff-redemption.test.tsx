import React from "react";
import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  createAdminSupabaseClient: vi.fn(),
  createServerSupabaseClient: vi.fn(),
  getPartnerIntakeFeatureEnabled: vi.fn(),
  getPartnerCredentialByKey: vi.fn(),
  findPartnerIntakeByNonce: vi.fn(),
  findPartnerIntakeByIdempotency: vi.fn(),
  insertPartnerIntakeSession: vi.fn(),
  getPartnerHandoffByTokenHash: vi.fn(),
  consumePartnerIntakeSession: vi.fn(),
  redeemPartnerHandoffAtomically: vi.fn(),
  createPartnerRecoveryJourney: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminSupabaseClient: mocks.createAdminSupabaseClient,
}));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: mocks.createServerSupabaseClient,
}));
vi.mock("@/lib/server/partner-intake-repository", () => ({
  getPartnerIntakeFeatureEnabled: mocks.getPartnerIntakeFeatureEnabled,
  getPartnerCredentialByKey: mocks.getPartnerCredentialByKey,
  findPartnerIntakeByNonce: mocks.findPartnerIntakeByNonce,
  findPartnerIntakeByIdempotency: mocks.findPartnerIntakeByIdempotency,
  insertPartnerIntakeSession: mocks.insertPartnerIntakeSession,
  getPartnerHandoffByTokenHash: mocks.getPartnerHandoffByTokenHash,
  consumePartnerIntakeSession: mocks.consumePartnerIntakeSession,
  redeemPartnerHandoffAtomically: mocks.redeemPartnerHandoffAtomically,
}));
vi.mock("@/lib/server/recovery-repository", () => ({
  createPartnerRecoveryJourney: mocks.createPartnerRecoveryJourney,
}));

import { POST, redeemHandoffSchema } from "@/app/api/recovery/handoff/redeem/route";
import { PartnerContextReview } from "@/components/recovery/partner-context-review";
import {
  previewPartnerHandoff,
  redeemPartnerHandoff,
} from "@/lib/server/partner-intake-service";

const NOW = new Date("2026-09-03T07:00:00.000Z");
const TOKEN = "A".repeat(43);
const USER_ID = "11111111-1111-4111-8111-111111111111";

const session = {
  id: "22222222-2222-4222-8222-222222222222",
  partnerId: "33333333-3333-4333-8333-333333333333",
  environment: "sandbox" as const,
  originReference: "application-abc-123",
  productCategory: "credit_card" as const,
  declinedAt: "2026-09-02T15:30:00.000Z",
  declineReasonCode: "partner_reason_affordability",
  declineReasonSource: "partner" as const,
  attributionKey: "campaign-42",
  additionalSupportMayBeNeeded: null,
  disclosureVersion: "decline-v1",
  consentVersion: "handoff-v1",
  tokenExpiresAt: "2026-09-03T07:10:00.000Z",
  consumedAt: null,
  boundUserId: null,
  partnerDisplayName: "Example Lender",
  partnerEnabled: true,
  partnerSandboxEnabled: true,
  partnerLiveEnabled: false,
};

const recovery = {
  id: "44444444-4444-4444-8444-444444444444",
  origin: "partner" as const,
  productCategory: "credit_card" as const,
  declineReasonKnown: true,
  declineReasonCode: "partner_reason_affordability",
  declineReasonSource: "partner" as const,
  contextConfirmation: "confirmed" as const,
};

describe("one-time partner handoff redemption", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.setSystemTime(NOW);
    mocks.createAdminSupabaseClient.mockReturnValue({ kind: "admin" });
    mocks.createServerSupabaseClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: USER_ID } } }) },
    });
    mocks.getPartnerIntakeFeatureEnabled.mockResolvedValue(true);
    mocks.getPartnerHandoffByTokenHash.mockResolvedValue(session);
    mocks.redeemPartnerHandoffAtomically.mockResolvedValue(recovery);
  });

  afterEach(() => cleanup());

  it("keeps the redeem body strict and rejects trusted routing/identity fields", () => {
    const valid = {
      token: TOKEN,
      contextAction: "confirm",
      correctedReasonCode: null,
    };
    expect(redeemHandoffSchema.safeParse(valid).success).toBe(true);

    for (const forbidden of [
      { userId: USER_ID },
      { partnerId: session.partnerId },
      { environment: "live" },
      { returnUrl: "https://evil.example" },
      { safeMode: true },
      { readinessState: "ready_to_check" },
    ]) {
      expect(redeemHandoffSchema.safeParse({ ...valid, ...forbidden }).success).toBe(false);
    }
  });

  it("requires authentication before a token can bind to an account", async () => {
    mocks.createServerSupabaseClient.mockResolvedValueOnce({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    });

    const response = await POST(new Request("https://credit-quest-app.vercel.app/api/recovery/handoff/redeem", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: TOKEN, contextAction: "confirm", correctedReasonCode: null }),
    }));

    expect(response.status).toBe(401);
    expect(mocks.redeemPartnerHandoffAtomically).not.toHaveBeenCalled();
    expect(mocks.createPartnerRecoveryJourney).not.toHaveBeenCalled();
    expect(mocks.consumePartnerIntakeSession).not.toHaveBeenCalled();
  });

  it("resolves only the SHA-256 hash and previews minimal truthful partner context", async () => {
    const preview = await previewPartnerHandoff(TOKEN, NOW);
    const expectedHash = createHash("sha256").update(TOKEN).digest("hex");

    expect(mocks.getPartnerHandoffByTokenHash).toHaveBeenCalledWith(
      expect.anything(),
      expectedHash,
    );
    expect(preview).toEqual({
      partnerDisplayName: "Example Lender",
      productCategory: "credit_card",
      declinedAt: session.declinedAt,
      reason: {
        known: true,
        code: "partner_reason_affordability",
        source: "partner",
      },
    });
    expect(JSON.stringify(preview)).not.toContain(session.originReference);
    expect(JSON.stringify(preview)).not.toContain(session.attributionKey);
  });

  it("fails closed for expired, consumed, bound, wrong-environment, or disabled-partner tokens", async () => {
    const invalidSessions = [
      { ...session, tokenExpiresAt: "2026-09-03T06:59:59.000Z" },
      { ...session, consumedAt: "2026-09-03T06:58:00.000Z" },
      { ...session, boundUserId: USER_ID },
      { ...session, environment: "live" as const },
      { ...session, partnerEnabled: false },
      { ...session, partnerSandboxEnabled: false, partnerLiveEnabled: true },
    ];

    for (const invalid of invalidSessions) {
      mocks.getPartnerHandoffByTokenHash.mockResolvedValueOnce(invalid);
      await expect(redeemPartnerHandoff({
        token: TOKEN,
        userId: USER_ID,
        review: { contextAction: "confirm", correctedReasonCode: null },
        now: NOW,
      })).rejects.toMatchObject({ status: 410 });
    }

    expect(mocks.redeemPartnerHandoffAtomically).not.toHaveBeenCalled();
    expect(mocks.createPartnerRecoveryJourney).not.toHaveBeenCalled();
    expect(mocks.consumePartnerIntakeSession).not.toHaveBeenCalled();
  });

  it("fails closed if the partner intake kill switch is turned off after token issue", async () => {
    mocks.getPartnerIntakeFeatureEnabled.mockResolvedValueOnce(false);

    await expect(redeemPartnerHandoff({
      token: TOKEN,
      userId: USER_ID,
      review: { contextAction: "confirm", correctedReasonCode: null },
      now: NOW,
    })).rejects.toMatchObject({ status: 410 });

    expect(mocks.redeemPartnerHandoffAtomically).not.toHaveBeenCalled();
  });

  it("binds confirmed partner context through one atomic repository operation", async () => {
    const response = await POST(new Request("https://credit-quest-app.vercel.app/api/recovery/handoff/redeem", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: TOKEN, contextAction: "confirm", correctedReasonCode: null }),
    }));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(mocks.redeemPartnerHandoffAtomically).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        sessionId: session.id,
        userId: USER_ID,
        declineReasonKnown: true,
        declineReasonCode: "partner_reason_affordability",
        declineReasonSource: "partner",
        contextConfirmation: "confirmed",
        now: expect.any(Date),
      }),
    );
    expect(mocks.createPartnerRecoveryJourney).not.toHaveBeenCalled();
    expect(mocks.consumePartnerIntakeSession).not.toHaveBeenCalled();
    expect(body.recovery.id).toBe("44444444-4444-4444-8444-444444444444");
    expect(body.token).toBeUndefined();
  });

  it("lets the customer correct the reason without converting partner context into Credit Quest diagnosis", async () => {
    mocks.redeemPartnerHandoffAtomically.mockResolvedValueOnce({
      id: "55555555-5555-4555-8555-555555555555",
      origin: "partner",
      productCategory: "credit_card",
      declineReasonKnown: true,
      declineReasonCode: "customer_corrected_reason",
      declineReasonSource: "customer",
      contextConfirmation: "corrected",
    });

    await redeemPartnerHandoff({
      token: TOKEN,
      userId: USER_ID,
      review: { contextAction: "correct_reason", correctedReasonCode: "customer_corrected_reason" },
      now: NOW,
    });

    expect(mocks.redeemPartnerHandoffAtomically).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        sessionId: session.id,
        userId: USER_ID,
        declineReasonKnown: true,
        declineReasonCode: "customer_corrected_reason",
        declineReasonSource: "customer",
        contextConfirmation: "corrected",
        now: NOW,
      }),
    );
  });

  it("lets the customer mark the reason unknown or decline optional use", async () => {
    for (const contextAction of ["reason_unknown", "decline_optional_reason_use"] as const) {
      mocks.redeemPartnerHandoffAtomically.mockResolvedValueOnce({
        id: "journey",
        origin: "partner",
        productCategory: "credit_card",
        declineReasonKnown: false,
        declineReasonCode: null,
        declineReasonSource: "unknown",
        contextConfirmation: contextAction === "reason_unknown" ? "unknown" : "optional_use_declined",
      });

      await redeemPartnerHandoff({
        token: TOKEN,
        userId: USER_ID,
        review: { contextAction, correctedReasonCode: null },
        now: NOW,
      });
      expect(mocks.redeemPartnerHandoffAtomically).toHaveBeenLastCalledWith(
        expect.anything(),
        expect.objectContaining({
          sessionId: session.id,
          userId: USER_ID,
          declineReasonKnown: false,
          declineReasonCode: null,
          declineReasonSource: "unknown",
          contextConfirmation: contextAction === "reason_unknown" ? "unknown" : "optional_use_declined",
          now: NOW,
        }),
      );
    }

    expect(mocks.createPartnerRecoveryJourney).not.toHaveBeenCalled();
    expect(mocks.consumePartnerIntakeSession).not.toHaveBeenCalled();
  });

  it("renders partner provenance and gives the customer explicit confirm/correct/unknown/decline choices", () => {
    render(
      <PartnerContextReview
        token={TOKEN}
        context={{
          partnerDisplayName: "Example Lender",
          productCategory: "credit_card",
          declinedAt: session.declinedAt,
          reason: { known: true, code: "partner_reason_affordability", source: "partner" },
        }}
      />,
    );

    expect(screen.getByRole("heading", { name: /check what we received/i })).toBeTruthy();
    expect(screen.getByText(/Example Lender could not offer you this product today/i)).toBeTruthy();
    expect(screen.getByText(/supplied by Example Lender/i)).toBeTruthy();
    expect(screen.queryByText(/we know why/i)).toBeNull();
    expect(screen.queryByText(/you will be approved/i)).toBeNull();
    expect(screen.getByRole("button", { name: /yes, that.?s right/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /correct the reason/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /i.?m not sure/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /don.?t use the reason/i })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /correct the reason/i }));
    expect(screen.getByLabelText(/what did they actually tell you/i)).toBeTruthy();
  });
});
