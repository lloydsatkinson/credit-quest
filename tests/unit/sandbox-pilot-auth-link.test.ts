import { describe, expect, it, vi } from "vitest";
import * as pilotRepository from "@/lib/server/sandbox-pilot-repository";

type GenerateSandboxPilotAuthLink = (
  admin: unknown,
  targetUserId: string,
  siteOrigin: string,
  nextPath: string,
) => Promise<string>;

function adminClient() {
  const user = {
    id: "ca79d264-e2f1-4467-b655-eb7a66a289fa",
    email: "cq-internal-pilot-3dbb2ff3@example.com",
    app_metadata: {
      provider: "email",
      credit_quest_internal_test: true,
      credit_quest_sandbox_pilot: true,
    },
  };
  const getUserById = vi.fn().mockResolvedValue({ data: { user }, error: null });
  const generateLink = vi.fn().mockResolvedValue({
    data: {
      properties: { hashed_token: "pilot-token-hash" },
      user,
    },
    error: null,
  });

  return {
    client: { auth: { admin: { getUserById, generateLink } } },
    getUserById,
    generateLink,
  };
}

describe("sandbox pilot auth link", () => {
  it("generates a token-hash confirmation link for the internal synthetic pilot identity", async () => {
    const generateSandboxPilotAuthLink = (
      pilotRepository as unknown as {
        generateSandboxPilotAuthLink?: GenerateSandboxPilotAuthLink;
      }
    ).generateSandboxPilotAuthLink;

    expect(typeof generateSandboxPilotAuthLink).toBe("function");
    if (!generateSandboxPilotAuthLink) return;

    const target = adminClient();
    const nextPath = "/recovery/handoff/abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMN0123456789_-";
    const link = await generateSandboxPilotAuthLink(
      target.client,
      "ca79d264-e2f1-4467-b655-eb7a66a289fa",
      "https://credit-quest-app.vercel.app",
      nextPath,
    );

    expect(target.getUserById).toHaveBeenCalledWith("ca79d264-e2f1-4467-b655-eb7a66a289fa");
    expect(target.generateLink).toHaveBeenCalledWith({
      type: "magiclink",
      email: "cq-internal-pilot-3dbb2ff3@example.com",
    });

    const url = new URL(link);
    expect(url.origin).toBe("https://credit-quest-app.vercel.app");
    expect(url.pathname).toBe("/auth/confirm");
    expect(url.searchParams.get("token_hash")).toBe("pilot-token-hash");
    expect(url.searchParams.get("type")).toBe("magiclink");
    expect(url.searchParams.get("next")).toBe(nextPath);
  });
});
