import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8").toLowerCase();

describe("experiment and commercial boundaries", () => {
  it("keeps economics out of commercial gates and ordering", () => {
    const text = `${read("lib/commercial/gates.ts")}\n${read("lib/commercial/ordering.ts")}`;
    for (const forbidden of ["commission", "epc", "payout", "revenue", "campaign"]) {
      expect(text).not.toContain(forbidden);
    }
  });

  it("keeps experiments from deciding safety/readiness/mission eligibility", () => {
    const text = `${read("lib/experiments/assignment.ts")}\n${read("lib/server/experiment-repository.ts")}`;
    for (const forbidden of [
      "domain/safety",
      "domain/readiness",
      "mission-engine",
      "academy/selector",
      "createcommercialreferral",
    ]) {
      expect(text).not.toContain(forbidden);
    }
  });
});
