import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const path = resolve(process.cwd(), "supabase/migrations/007_academy.sql");
const rlsPath = resolve(process.cwd(), "supabase/tests/rls.sql");

describe("Academy migration", () => {
  it("creates versioned public content and private progress safely", () => {
    expect(existsSync(path)).toBe(true);
    if (!existsSync(path)) return;
    const sql = readFileSync(path, "utf8");
    expect(sql).toContain("create table public.academy_articles");
    expect(sql).toContain("create table public.academy_progress");
    expect(sql).toContain("where status = 'published'");
    expect(sql).toContain("academy_articles_public_published_select");
    expect(sql).toContain("academy_progress_select_own");
    expect(sql).toContain("create or replace function public.publish_academy_article");
    expect(sql).toContain("grant execute on function public.publish_academy_article(uuid) to service_role");
    expect(sql).not.toMatch(/grant (insert|update|delete).*academy_articles.*authenticated/i);
    expect(sql).not.toMatch(/grant (insert|update|delete).*academy_progress.*authenticated/i);
  });

  it("requires live launch-content and atomic-publication verification", () => {
    expect(existsSync(rlsPath)).toBe(true);
    if (!existsSync(rlsPath)) return;
    const sql = readFileSync(rlsPath, "utf8");
    expect(sql).toContain("Expected 29 published Academy launch rows");
    expect(sql).toContain("Academy publication did not supersede the prior version");
    expect(sql).toContain("Academy publication did not publish the reviewed replacement");
  });
});
