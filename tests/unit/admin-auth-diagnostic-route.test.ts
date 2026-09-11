import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("admin auth diagnostic route", () => {
  it("lives under a routable App Router segment", () => {
    const root = process.cwd();
    expect(existsSync(join(root, "app/api/diagnostics/admin-auth/route.ts"))).toBe(true);
    expect(existsSync(join(root, "app/api/_diagnostics/admin-auth/route.ts"))).toBe(false);
  });
});
