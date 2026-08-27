import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = resolve(
  process.cwd(),
  "supabase/migrations/006_v2_0b_closeout.sql",
);

describe("V2.0b close-out migration", () => {
  it("ships the close-out migration", () => {
    expect(existsSync(migrationPath)).toBe(true);
  });

  it("removes the redundant mission id index and closes residual advisor findings", () => {
    if (!existsSync(migrationPath)) return;
    const sql = readFileSync(migrationPath, "utf8");

    expect(sql).toContain(
      "drop index if exists public.user_missions_id_unique;",
    );
    expect(sql).toContain(
      "create index if not exists events_user_id_idx on public.events(user_id);",
    );

    for (const policy of [
      "profiles_select_own",
      "profiles_insert_own",
      "profiles_update_own",
      "missions_select_own",
      "missions_insert_own",
      "missions_update_own",
      "events_insert_own",
    ]) {
      expect(sql).toContain(`drop policy if exists \"${policy}\"`);
    }

    expect(sql).not.toMatch(/\busing \(auth\.uid\(\) = user_id\)/);
    expect(sql).not.toMatch(/\bwith check \(auth\.uid\(\) = user_id\)/);
    expect(sql.match(/\(select auth\.uid\(\)\) = user_id/g)?.length).toBe(9);
  });
});
