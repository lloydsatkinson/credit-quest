import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

for (const file of ["lib/reminders/rules.ts", "lib/reminders/templates.ts"]) {
  describe(file, () => {
    it("does not depend on commercial economics or offer matching", () => {
      const source = readFileSync(resolve(process.cwd(), file), "utf8").toLowerCase();
      for (const forbidden of ["offer-matcher", "commission", "epc", "payout", "revenue", "campaign"]) {
        expect(source).not.toContain(forbidden);
      }
    });
  });
}
