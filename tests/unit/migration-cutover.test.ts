import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = (name: string) => readFileSync(`supabase/migrations/${name}`, "utf8");

describe("Action Layer production cutover", () => {
  it("keeps the legacy mission primary key during the additive expansion", () => {
    const sql = migration("003_action_layer.sql");
    expect(sql).not.toContain("drop constraint if exists user_missions_pkey");
    expect(sql).toContain("user_missions_id_unique");
  });

  it("moves the mission primary key to id only in the post-deploy cutover", () => {
    const sql = migration("004_action_layer_mission_key_cutover.sql");
    expect(sql).toContain("drop constraint if exists user_missions_pkey");
    expect(sql).toContain("add constraint user_missions_pkey primary key (id)");
    expect(sql).toContain("user_missions_account_unique");
  });

  it("applies same-owner and one-open-attempt hardening after the key cutover", () => {
    const sql = migration("005_action_layer_owner_integrity.sql");
    expect(sql).toContain("user_missions_subject_owner_fkey");
    expect(sql).toContain("action_attempts_mission_owner_fkey");
    expect(sql).toContain("action_attempts_account_owner_fkey");
    expect(sql).toContain("action_attempts_one_open_per_mission");
  });
});
