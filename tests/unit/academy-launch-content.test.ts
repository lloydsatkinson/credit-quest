import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { DEMO_ACADEMY_ARTICLES } from "@/lib/academy/demo-content";

const sql = readFileSync(resolve(process.cwd(), "supabase/migrations/008_academy_launch_content.sql"), "utf8");

describe("Academy launch curriculum", () => {
  it("ships at least 25 reviewed published articles and all protective fallbacks", () => {
    const contentKeys = [...sql.matchAll(/'([a-z0-9-]+)'\s*,\s*'[^']+'\s*,\s*1\s*,\s*'published'/g)].map((m) => m[1]);
    expect(new Set(contentKeys).size).toBeGreaterThanOrEqual(25);
    expect(sql).toContain("'credit-file-basics'");
    expect(sql).toContain("'credit-basics-under-18'");
    expect(sql).toContain("'protect-payments-first'");
    expect(sql).toContain("'under18_safe'");
    expect(sql).toContain("'safe_mode_safe'");
    expect(DEMO_ACADEMY_ARTICLES.some((a) => a.contentKey === "credit-basics-under-18")).toBe(true);
    expect(DEMO_ACADEMY_ARTICLES.some((a) => a.contentKey === "protect-payments-first")).toBe(true);
  });
});
