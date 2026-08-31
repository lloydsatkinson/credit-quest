import { describe, expect, it, vi } from "vitest";
import { createAdminAuthorizer } from "@/lib/server/admin-auth";

describe("admin authorization", () => {
  it("requires both authenticated user and explicit admin membership", async () => {
    const authorize = createAdminAuthorizer({
      getAuthenticatedUser: vi.fn().mockResolvedValue({ id: "u1" }),
      getAdminMembership: vi.fn().mockResolvedValue({ userId: "u1", role: "admin" }),
    });
    await expect(authorize()).resolves.toEqual({ id: "u1" });
  });

  it("fails closed on missing membership", async () => {
    const authorize = createAdminAuthorizer({
      getAuthenticatedUser: vi.fn().mockResolvedValue({ id: "u1" }),
      getAdminMembership: vi.fn().mockResolvedValue(null),
    });
    await expect(authorize()).rejects.toThrow("Admin access required");
  });

  it("fails closed on an unauthenticated user or membership read error", async () => {
    const unauthenticated = createAdminAuthorizer({
      getAuthenticatedUser: vi.fn().mockResolvedValue(null),
      getAdminMembership: vi.fn(),
    });
    await expect(unauthenticated()).rejects.toThrow("Admin access required");

    const readFailure = createAdminAuthorizer({
      getAuthenticatedUser: vi.fn().mockResolvedValue({ id: "u1" }),
      getAdminMembership: vi.fn().mockRejectedValue(new Error("down")),
    });
    await expect(readFailure()).rejects.toThrow("Admin access required");
  });
});
