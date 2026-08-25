import { describe, expect, it } from "vitest";
import { getAgeMode } from "@/lib/domain/age-gate";

describe("getAgeMode", () => {
  const now = new Date("2026-08-25T12:00:00Z");

  it("returns education for a 17 year old", () => {
    expect(getAgeMode("2009-08-26", now)).toBe("education");
  });

  it("returns adult on the user's 18th birthday", () => {
    expect(getAgeMode("2008-08-25", now)).toBe("adult");
  });
});
