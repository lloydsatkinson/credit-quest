import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function read(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("admin and lender auth return paths", () => {
  it("routes admin and lender requests through the session proxy", () => {
    const source = read("proxy.ts");
    expect(source).toContain('"/admin/:path*"');
    expect(source).toContain('"/lender/:path*"');
  });

  it("treats admin and lender routes as protected and preserves the requested path", () => {
    const source = read("lib/supabase/middleware.ts");
    expect(source).toMatch(/PROTECTED_PREFIXES\s*=\s*\[[\s\S]*"\/admin"/);
    expect(source).toMatch(/PROTECTED_PREFIXES\s*=\s*\[[\s\S]*"\/lender"/);
    expect(source).toContain('url.searchParams.set("next", request.nextUrl.pathname)');
  });
});
