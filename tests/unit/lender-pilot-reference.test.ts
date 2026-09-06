import { describe, expect, it } from "vitest";
import {
  createLenderPilotCaseReference,
  getLenderPilotReferenceSecret,
} from "@/lib/server/lender-pilot-reference";

describe("lender pilot case references", () => {
  it("fails closed when the dedicated server secret is absent or too short", () => {
    expect(getLenderPilotReferenceSecret({} as NodeJS.ProcessEnv)).toBeNull();
    expect(getLenderPilotReferenceSecret({
      LENDER_PILOT_REFERENCE_SECRET: "short",
    } as NodeJS.ProcessEnv)).toBeNull();
  });

  it("accepts a dedicated 32+ character server secret", () => {
    const secret = "0123456789abcdef0123456789abcdef";
    expect(getLenderPilotReferenceSecret({
      LENDER_PILOT_REFERENCE_SECRET: `  ${secret}  `,
    } as NodeJS.ProcessEnv)).toBe(secret);
  });

  it("creates stable non-reversible CQ references from recovery journey ids", () => {
    const secret = "0123456789abcdef0123456789abcdef";
    const journeyId = "11111111-1111-1111-1111-111111111111";

    const first = createLenderPilotCaseReference(secret, journeyId);
    const again = createLenderPilotCaseReference(secret, journeyId);

    expect(first).toBe(again);
    expect(first).toMatch(/^CQ-[A-F0-9]{10}$/);
    expect(first).not.toContain("11111111");
    expect(first).not.toContain(journeyId);
  });

  it("does not produce the same reference for a different journey id", () => {
    const secret = "0123456789abcdef0123456789abcdef";
    expect(createLenderPilotCaseReference(
      secret,
      "11111111-1111-1111-1111-111111111111",
    )).not.toBe(createLenderPilotCaseReference(
      secret,
      "22222222-2222-2222-2222-222222222222",
    ));
  });
});
