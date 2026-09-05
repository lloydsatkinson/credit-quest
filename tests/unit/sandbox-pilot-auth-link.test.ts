import { describe, expect, it, vi } from "vitest";
import * as pilotRepository from "@/lib/server/sandbox-pilot-repository";

type GenerateSandboxPilotAuthLink = (
  admin: unknown,
  targetUserId: string,
  siteOrigin: string,
  nextPath: string,
) => Promise<string>;

const PILOT_USER_ID = "ca79d264-e2f1-4467-b655-eb7a66a289fa";
const SITE_ORIGIN = "https://credit-quest-app.vercel.app";
const HANDOFF_PATH = `/recovery/handoff/${"A".repeat(43)}`;

function generator() {
  const value = (
    pilotRepository as unknown as {
      generateSandboxPilotAuthLink?: GenerateSandboxPilotAuthLink;
    }
  ).generateSandboxPilotAuthLink;
  expect(typeof value).toBe("function");
  if (!value) throw new Error("generateSandboxPilotAuthLink missing");
  return value;
}

function adminClient(overrides?: {
  email?: string | null;
  appMetadata?: Record<string, unknown>;
  userMetadata?: Record<string, unknown>;
  generateLinkError?: Error;
  hashedToken?: string | null;
}) {
  const user = {
    id: PILOT_USER_ID,
    email: overrides?.email === undefined
      ? "cq-internal-pilot-3dbb2ff3@example.com"
      : overrides.email,
    app_metadata: overrides?.appMetadata ?? {
      provider: "email",
      credit_quest_internal_test: true,
      credit_quest_sandbox_pilot: true,
    },
    user_metadata: overrides?.userMetadata ?? {},
  };
  const getUserById = vi.fn().mockResolvedValue({ data: { user }, error: null });
  const generateLink = vi.fn().mockResolvedValue({
    data: {
      properties: { hashed_token: overrides?.hashedToken === undefined ? "pilot-token-hash" : overrides.hashedToken },
      user,
    },
    error: overrides?.generateLinkError ?? null,
  });

  return {
    client: { auth: { admin: { getUserById, generateLink } } },
    getUserById,
    generateLink,
  };
}

describe("sandbox pilot auth link", () => {
  it("generates a token-hash confirmation link for the internal synthetic pilot identity", async () => {
    const generateSandboxPilotAuthLink = generator();
    const target = adminClient();
    const link = await generateSandboxPilotAuthLink(
      target.client,
      PILOT_USER_ID,
      SITE_ORIGIN,
      HANDOFF_PATH,
    );

    expect(target.getUserById).toHaveBeenCalledWith(PILOT_USER_ID);
    expect(target.generateLink).toHaveBeenCalledWith({
      type: "magiclink",
      email: "cq-internal-pilot-3dbb2ff3@example.com",
    });

    const url = new URL(link);
    expect(url.origin).toBe(SITE_ORIGIN);
    expect(url.pathname).toBe("/auth/confirm");
    expect(url.searchParams.get("token_hash")).toBe("pilot-token-hash");
    expect(url.searchParams.get("type")).toBe("magiclink");
    expect(url.searchParams.get("next")).toBe(HANDOFF_PATH);
  });

  it("rejects identities not controlled by both internal-test and sandbox-pilot app metadata", async () => {
    const generateSandboxPilotAuthLink = generator();

    const missingPilot = adminClient({
      appMetadata: { credit_quest_internal_test: true },
      userMetadata: { credit_quest_sandbox_pilot: true },
    });
    await expect(generateSandboxPilotAuthLink(
      missingPilot.client,
      PILOT_USER_ID,
      SITE_ORIGIN,
      HANDOFF_PATH,
    )).rejects.toThrow(/pilot/i);
    expect(missingPilot.generateLink).not.toHaveBeenCalled();

    const missingInternal = adminClient({
      appMetadata: { credit_quest_sandbox_pilot: true },
    });
    await expect(generateSandboxPilotAuthLink(
      missingInternal.client,
      PILOT_USER_ID,
      SITE_ORIGIN,
      HANDOFF_PATH,
    )).rejects.toThrow(/internal/i);
    expect(missingInternal.generateLink).not.toHaveBeenCalled();
  });

  it("rejects non-synthetic email addresses before generating a link", async () => {
    const generateSandboxPilotAuthLink = generator();
    const target = adminClient({ email: "real-customer@gmail.com" });

    await expect(generateSandboxPilotAuthLink(
      target.client,
      PILOT_USER_ID,
      SITE_ORIGIN,
      HANDOFF_PATH,
    )).rejects.toThrow(/synthetic/i);
    expect(target.generateLink).not.toHaveBeenCalled();
  });

  it("rejects non-canonical origins and non-handoff return paths", async () => {
    const generateSandboxPilotAuthLink = generator();

    const badOrigin = adminClient();
    await expect(generateSandboxPilotAuthLink(
      badOrigin.client,
      PILOT_USER_ID,
      "https://evil.example",
      HANDOFF_PATH,
    )).rejects.toThrow(/origin/i);
    expect(badOrigin.generateLink).not.toHaveBeenCalled();

    const badPath = adminClient();
    await expect(generateSandboxPilotAuthLink(
      badPath.client,
      PILOT_USER_ID,
      SITE_ORIGIN,
      "/admin",
    )).rejects.toThrow(/handoff/i);
    expect(badPath.generateLink).not.toHaveBeenCalled();
  });

  it("fails closed when Supabase link generation fails or omits the token hash", async () => {
    const generateSandboxPilotAuthLink = generator();

    const failed = adminClient({ generateLinkError: new Error("auth unavailable") });
    await expect(generateSandboxPilotAuthLink(
      failed.client,
      PILOT_USER_ID,
      SITE_ORIGIN,
      HANDOFF_PATH,
    )).rejects.toThrow("auth unavailable");

    const missingHash = adminClient({ hashedToken: null });
    await expect(generateSandboxPilotAuthLink(
      missingHash.client,
      PILOT_USER_ID,
      SITE_ORIGIN,
      HANDOFF_PATH,
    )).rejects.toThrow(/token/i);
  });
});
