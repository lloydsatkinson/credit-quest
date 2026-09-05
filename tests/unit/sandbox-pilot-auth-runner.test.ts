import { describe, expect, it, vi } from "vitest";

const PILOT_USER_ID = "ca79d264-e2f1-4467-b655-eb7a66a289fa";
const PILOT_EMAIL = "cq-internal-pilot-3dbb2ff3@example.com";
const SITE_ORIGIN = "https://credit-quest-app.vercel.app";
const HANDOFF_TOKEN = "A".repeat(43);

type RunnerModule = {
  generatePilotAuthLink: (options: {
    createClient: (...args: unknown[]) => unknown;
    env: Record<string, string | undefined>;
    handoffToken: string;
  }) => Promise<string>;
};

async function loadRunner(): Promise<RunnerModule> {
  return import("../../scripts/generate-sandbox-pilot-auth-link.mjs") as Promise<RunnerModule>;
}

function fakeSupabase(overrides?: {
  id?: string;
  email?: string;
  appMetadata?: Record<string, unknown>;
  tokenHash?: string | null;
}) {
  const user = {
    id: overrides?.id ?? PILOT_USER_ID,
    email: overrides?.email ?? PILOT_EMAIL,
    app_metadata: overrides?.appMetadata ?? {
      credit_quest_internal_test: true,
      credit_quest_sandbox_pilot: true,
    },
  };
  const tokenHash = overrides?.tokenHash === undefined
    ? "operator-token-hash"
    : overrides.tokenHash;
  const getUserById = vi.fn().mockResolvedValue({ data: { user }, error: null });
  const generateLink = vi.fn().mockResolvedValue({
    data: { properties: { hashed_token: tokenHash } },
    error: null,
  });
  const client = { auth: { admin: { getUserById, generateLink } } };
  const createClient = vi.fn().mockReturnValue(client);
  return { createClient, getUserById, generateLink };
}

const env = {
  NEXT_PUBLIC_SUPABASE_URL: "https://kcgghgziyfcamrxkudwe.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-test-key",
};

describe("sandbox pilot auth operator runner", () => {
  it("generates a one-time confirmation URL for only the fixed synthetic pilot identity", async () => {
    const { generatePilotAuthLink } = await loadRunner();
    const target = fakeSupabase();

    const link = await generatePilotAuthLink({
      createClient: target.createClient,
      env,
      handoffToken: HANDOFF_TOKEN,
    });

    expect(target.createClient).toHaveBeenCalledWith(
      env.NEXT_PUBLIC_SUPABASE_URL,
      env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    expect(target.getUserById).toHaveBeenCalledWith(PILOT_USER_ID);
    expect(target.generateLink).toHaveBeenCalledWith({
      type: "magiclink",
      email: PILOT_EMAIL,
    });

    const url = new URL(link);
    expect(url.origin).toBe(SITE_ORIGIN);
    expect(url.pathname).toBe("/auth/confirm");
    expect(url.searchParams.get("token_hash")).toBe("operator-token-hash");
    expect(url.searchParams.get("type")).toBe("magiclink");
    expect(url.searchParams.get("next")).toBe(`/recovery/handoff/${HANDOFF_TOKEN}`);
  });

  it("fails before Supabase access when required environment or handoff token is invalid", async () => {
    const { generatePilotAuthLink } = await loadRunner();
    const target = fakeSupabase();

    await expect(generatePilotAuthLink({
      createClient: target.createClient,
      env: { ...env, SUPABASE_SERVICE_ROLE_KEY: undefined },
      handoffToken: HANDOFF_TOKEN,
    })).rejects.toThrow(/environment/i);

    await expect(generatePilotAuthLink({
      createClient: target.createClient,
      env,
      handoffToken: "not-a-token",
    })).rejects.toThrow(/handoff/i);

    expect(target.createClient).not.toHaveBeenCalled();
  });

  it("fails closed if the fixed auth user is not the expected synthetic internal pilot", async () => {
    const { generatePilotAuthLink } = await loadRunner();

    for (const target of [
      fakeSupabase({ id: "00000000-0000-0000-0000-000000000000" }),
      fakeSupabase({ email: "real-customer@gmail.com" }),
      fakeSupabase({ appMetadata: { credit_quest_internal_test: true } }),
      fakeSupabase({ appMetadata: { credit_quest_sandbox_pilot: true } }),
    ]) {
      await expect(generatePilotAuthLink({
        createClient: target.createClient,
        env,
        handoffToken: HANDOFF_TOKEN,
      })).rejects.toThrow(/pilot|synthetic|internal/i);
      expect(target.generateLink).not.toHaveBeenCalled();
    }
  });

  it("fails closed if Supabase does not return a token hash", async () => {
    const { generatePilotAuthLink } = await loadRunner();
    const target = fakeSupabase({ tokenHash: null });

    await expect(generatePilotAuthLink({
      createClient: target.createClient,
      env,
      handoffToken: HANDOFF_TOKEN,
    })).rejects.toThrow(/token/i);
  });
});
