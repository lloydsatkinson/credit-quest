import { describe, expect, it, vi } from "vitest";
import { runAdminAuthDiagnostic } from "@/lib/server/admin-auth-diagnostic";

describe("admin auth diagnostic", () => {
  it("reports stage status without exposing identity or secret material", async () => {
    const result = await runAdminAuthDiagnostic({
      expectedProjectHost: "kcgghgziyfcamrxkudwe.supabase.co",
      publicEnvUrl: "https://kcgghgziyfcamrxkudwe.supabase.co",
      serviceCredentialPresent: true,
      probeServiceAdminTable: vi.fn().mockResolvedValue(true),
      getAuthenticatedUser: vi.fn().mockResolvedValue({ id: "private-user-id" }),
      getAdminMembership: vi.fn().mockResolvedValue(true),
    });

    expect(result).toEqual({
      publicSupabaseEnvPresent: true,
      expectedSupabaseProject: true,
      serviceCredentialPresent: true,
      serviceAdminTableProbe: "ok",
      serverSession: "present",
      adminMembershipLookup: "admin",
    });
    expect(JSON.stringify(result)).not.toContain("private-user-id");
  });

  it("fails closed into sanitized statuses when service or session checks error", async () => {
    const result = await runAdminAuthDiagnostic({
      expectedProjectHost: "kcgghgziyfcamrxkudwe.supabase.co",
      publicEnvUrl: "https://kcgghgziyfcamrxkudwe.supabase.co",
      serviceCredentialPresent: true,
      probeServiceAdminTable: vi.fn().mockRejectedValue(new Error("secret raw database error")),
      getAuthenticatedUser: vi.fn().mockRejectedValue(new Error("private auth error")),
      getAdminMembership: vi.fn(),
    });

    expect(result).toEqual({
      publicSupabaseEnvPresent: true,
      expectedSupabaseProject: true,
      serviceCredentialPresent: true,
      serviceAdminTableProbe: "error",
      serverSession: "error",
      adminMembershipLookup: "not_run",
    });
    expect(JSON.stringify(result)).not.toContain("secret raw database error");
    expect(JSON.stringify(result)).not.toContain("private auth error");
  });

  it("does not attempt an admin membership lookup without a server session", async () => {
    const getAdminMembership = vi.fn();
    const result = await runAdminAuthDiagnostic({
      expectedProjectHost: "kcgghgziyfcamrxkudwe.supabase.co",
      publicEnvUrl: null,
      serviceCredentialPresent: false,
      probeServiceAdminTable: vi.fn(),
      getAuthenticatedUser: vi.fn().mockResolvedValue(null),
      getAdminMembership,
    });

    expect(result).toEqual({
      publicSupabaseEnvPresent: false,
      expectedSupabaseProject: false,
      serviceCredentialPresent: false,
      serviceAdminTableProbe: "not_run",
      serverSession: "missing",
      adminMembershipLookup: "not_run",
    });
    expect(getAdminMembership).not.toHaveBeenCalled();
  });
});
