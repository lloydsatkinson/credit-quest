import { afterEach, describe, expect, it, vi } from "vitest";
import { getSupabaseServiceEnv } from "@/lib/supabase/env";

describe("Supabase server environment compatibility", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses the current Supabase secret key when the legacy service-role variable is absent", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-test-key");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    vi.stubEnv("SUPABASE_SECRET_KEY", "sb_secret_test_key");

    expect(getSupabaseServiceEnv()).toEqual({
      url: "https://example.supabase.co",
      anonKey: "anon-test-key",
      serviceRoleKey: "sb_secret_test_key",
    });
  });

  it("keeps the legacy service-role variable as a fallback", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-test-key");
    vi.stubEnv("SUPABASE_SECRET_KEY", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "legacy-service-role-key");

    expect(getSupabaseServiceEnv()).toEqual({
      url: "https://example.supabase.co",
      anonKey: "anon-test-key",
      serviceRoleKey: "legacy-service-role-key",
    });
  });
});
