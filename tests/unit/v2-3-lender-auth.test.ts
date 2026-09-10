import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  LenderAccessError,
  createLenderAuthorizer,
} from "@/lib/server/lender-auth";

const migrationPath = resolve(process.cwd(), "supabase/migrations/019_v2_3_lender_pilot_reporting.sql");

function migrationSql(): string {
  expect(existsSync(migrationPath)).toBe(true);
  return existsSync(migrationPath) ? readFileSync(migrationPath, "utf8") : "";
}

describe("V2.3 lender authorizer", () => {
  it("returns one exact partner scope and its enabled pilot memberships", async () => {
    const authorize = createLenderAuthorizer({
      getAuthenticatedUser: vi.fn().mockResolvedValue({ id: "user-1" }),
      getLenderMemberships: vi.fn().mockResolvedValue([
        { userId: "user-1", partnerId: "partner-a", pilotId: "pilot-2", enabled: true },
        { userId: "user-1", partnerId: "partner-a", pilotId: "pilot-1", enabled: true },
      ]),
    });

    await expect(authorize()).resolves.toEqual({
      userId: "user-1",
      partnerId: "partner-a",
      pilotIds: ["pilot-1", "pilot-2"],
    });
  });

  it.each([
    ["missing auth", null, []],
    ["no membership", { id: "user-1" }, []],
    ["disabled membership", { id: "user-1" }, [{ userId: "user-1", partnerId: "partner-a", pilotId: "pilot-1", enabled: false }]],
    ["wrong user", { id: "user-1" }, [{ userId: "user-2", partnerId: "partner-a", pilotId: "pilot-1", enabled: true }]],
    ["cross-partner scope", { id: "user-1" }, [
      { userId: "user-1", partnerId: "partner-a", pilotId: "pilot-1", enabled: true },
      { userId: "user-1", partnerId: "partner-b", pilotId: "pilot-2", enabled: true },
    ]],
  ])("fails closed for %s", async (_label, user, memberships) => {
    const authorize = createLenderAuthorizer({
      getAuthenticatedUser: vi.fn().mockResolvedValue(user),
      getLenderMemberships: vi.fn().mockResolvedValue(memberships),
    });
    await expect(authorize()).rejects.toBeInstanceOf(LenderAccessError);
  });

  it("fails closed when either auth or membership lookup errors", async () => {
    const authFailure = createLenderAuthorizer({
      getAuthenticatedUser: vi.fn().mockRejectedValue(new Error("auth unavailable")),
      getLenderMemberships: vi.fn(),
    });
    await expect(authFailure()).rejects.toBeInstanceOf(LenderAccessError);

    const membershipFailure = createLenderAuthorizer({
      getAuthenticatedUser: vi.fn().mockResolvedValue({ id: "user-1" }),
      getLenderMemberships: vi.fn().mockRejectedValue(new Error("db unavailable")),
    });
    await expect(membershipFailure()).rejects.toBeInstanceOf(LenderAccessError);
  });
});

describe("V2.3 lender reporting migration boundary", () => {
  it("creates only service-role-readable pilot and membership tables", () => {
    const sql = migrationSql();
    for (const table of ["recovery_pilots", "recovery_pilot_assignments", "lender_portal_members"]) {
      expect(sql).toContain(`create table public.${table}`);
      expect(sql).toContain(`alter table public.${table} enable row level security`);
      expect(sql).toContain(`revoke all on public.${table} from anon, authenticated`);
      expect(sql).toContain(`grant all on public.${table} to service_role`);
    }
    expect(sql).toMatch(/lender_portal_members[\s\S]*user_id uuid not null/i);
    expect(sql).toMatch(/lender_portal_members[\s\S]*partner_id uuid not null/i);
    expect(sql).toMatch(/lender_portal_members[\s\S]*pilot_id uuid not null/i);
  });

  it("adds immutable historical ready truth and explicit return route type", () => {
    const sql = migrationSql();
    expect(sql).toMatch(/first_ready_to_check_at timestamptz/i);
    expect(sql).toMatch(/route_type text[\s\S]*original[\s\S]*alternative/i);
    expect(sql).toMatch(/capture_first_ready_to_check/i);
  });
});
