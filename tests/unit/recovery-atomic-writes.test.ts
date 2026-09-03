import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { replaceSupportNeeds } from "@/lib/server/support-needs-repository";

const atomicMigrationPath = resolve(
  process.cwd(),
  "supabase/migrations/014_recovery_atomic_writes.sql",
);

const USER_ID = "11111111-1111-4111-8111-111111111111";
const NOW = new Date("2026-09-03T10:30:00.000Z");

describe("V2.0d atomic recovery writes", () => {
  it("moves Support Needs replacement behind one service-role-only transactional RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: ["more_time", "human_support"], error: null });
    const admin = { rpc } as unknown as SupabaseClient;

    await expect(
      replaceSupportNeeds(admin, USER_ID, ["more_time", "human_support"], NOW),
    ).resolves.toEqual(["more_time", "human_support"]);

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("replace_support_needs_atomic", {
      p_user_id: USER_ID,
      p_need_codes: ["more_time", "human_support"],
      p_effective_at: NOW.toISOString(),
    });
  });

  it("defines transactional Support Needs and handoff-redemption RPCs with service-role-only execution", () => {
    expect(existsSync(atomicMigrationPath)).toBe(true);
    if (!existsSync(atomicMigrationPath)) return;

    const sql = readFileSync(atomicMigrationPath, "utf8").toLowerCase();
    expect(sql).toContain("create or replace function public.replace_support_needs_atomic");
    expect(sql).toContain("create or replace function public.redeem_partner_handoff_atomic");
    expect(sql).toContain("for update");
    expect(sql).toContain("partner_decline_intake_enabled");
    expect(sql).toContain("environment = 'sandbox'");
    expect(sql).toContain("sandbox_enabled = true");
    expect(sql).toContain("consumed_at = p_now");
    expect(sql).toContain("bound_user_id = p_user_id");
    expect(sql).toContain("insert into public.decline_recovery_journeys");
    expect(sql).toContain("revoke all on function public.replace_support_needs_atomic");
    expect(sql).toContain("revoke all on function public.redeem_partner_handoff_atomic");
    expect(sql).toContain("grant execute on function public.replace_support_needs_atomic");
    expect(sql).toContain("grant execute on function public.redeem_partner_handoff_atomic");
    expect(sql).toContain("to service_role");
  });
});
