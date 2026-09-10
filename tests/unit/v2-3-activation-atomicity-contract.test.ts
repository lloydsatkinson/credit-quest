import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = resolve(process.cwd(), "supabase/migrations/021_v2_3_atomic_policy_snapshot_binding.sql");
const repositoryPath = resolve(process.cwd(), "lib/server/partner-intake-repository.ts");

describe("V2.3 activation snapshot atomicity contract", () => {
  it("adds a service-role atomic handoff RPC that persists the frozen snapshot in the same transaction", () => {
    expect(existsSync(migrationPath)).toBe(true);
    const sql = readFileSync(migrationPath, "utf8");
    expect(sql).toContain("redeem_partner_handoff_with_policy_snapshot_atomic");
    expect(sql).toContain("insert into public.recovery_policy_snapshots");
    expect(sql).toMatch(/revoke all on function public\.redeem_partner_handoff_with_policy_snapshot_atomic[\s\S]*from public, anon, authenticated/i);
    expect(sql).toMatch(/grant execute on function public\.redeem_partner_handoff_with_policy_snapshot_atomic[\s\S]*to service_role/i);

    const consumeAt = sql.indexOf("update public.decline_intake_sessions");
    const journeyAt = sql.indexOf("insert into public.decline_recovery_journeys");
    const snapshotAt = sql.indexOf("insert into public.recovery_policy_snapshots");
    expect(consumeAt).toBeGreaterThan(-1);
    expect(journeyAt).toBeGreaterThan(consumeAt);
    expect(snapshotAt).toBeGreaterThan(journeyAt);
  });

  it("routes application redemption through the snapshot-binding RPC rather than the legacy consume+journey RPC", () => {
    const source = readFileSync(repositoryPath, "utf8");
    expect(source).toContain('admin.rpc("redeem_partner_handoff_with_policy_snapshot_atomic"');
    expect(source).toContain("p_policy_snapshot: input.policySnapshot");
  });
});
