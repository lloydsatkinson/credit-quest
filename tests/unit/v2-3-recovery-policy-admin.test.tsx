import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { recoveryPolicyDraftSchema } from "@/app/api/admin/recovery/policies/route";
import { recoveryPolicyPublishSchema } from "@/app/api/admin/recovery/policies/publish/route";
import {
  assertRecoveryPolicyDraftMutable,
  validateRecoveryPolicyDraftForPublish,
} from "@/lib/recovery/decline-policy";

const partnerId = "00000000-0000-0000-0000-000000000001";
const draftId = "00000000-0000-0000-0000-000000000002";

const mappingDraft = {
  kind: "mapping" as const,
  partnerId,
  productCategory: "credit_card" as const,
  externalCode: "LENDER_THIN_FILE",
  canonicalCode: "THIN_FILE",
  parameters: { minimumMonths: 3 },
  lenderWording: "Limited credit history",
  version: 1,
};

const templateDraft = {
  kind: "template" as const,
  templateKey: "thin-file-build",
  canonicalCode: "THIN_FILE",
  treatment: "build" as const,
  solveability: "build_evidence" as const,
  severity: "medium" as const,
  recoveryHorizon: "medium" as const,
  customerHeadline: "Build a little more credit evidence before checking again.",
  customerExplanation: "Credit Quest will keep using your own evidence and readiness to decide when another check is sensible.",
  version: 1,
};

describe("V2.3 recovery Journey Builder admin boundary", () => {
  it("accepts narrow draft payloads and rejects server-owned lifecycle/admin fields", () => {
    expect(recoveryPolicyDraftSchema.safeParse(mappingDraft).success).toBe(true);
    expect(recoveryPolicyDraftSchema.safeParse(templateDraft).success).toBe(true);
    expect(recoveryPolicyDraftSchema.safeParse({ ...mappingDraft, lifecycle: "published" }).success).toBe(false);
    expect(recoveryPolicyDraftSchema.safeParse({ ...mappingDraft, adminUserId: partnerId }).success).toBe(false);
  });

  it("keeps publish input limited to the draft id", () => {
    expect(recoveryPolicyPublishSchema.safeParse({ draftId }).success).toBe(true);
    expect(recoveryPolicyPublishSchema.safeParse({ draftId, partnerId }).success).toBe(false);
    expect(recoveryPolicyPublishSchema.safeParse({ draftId, lifecycle: "published" }).success).toBe(false);
  });

  it("allows edits only while a policy record is still draft", () => {
    expect(() => assertRecoveryPolicyDraftMutable("draft")).not.toThrow();
    expect(() => assertRecoveryPolicyDraftMutable("tested")).toThrow(/draft_only/i);
    expect(() => assertRecoveryPolicyDraftMutable("published")).toThrow(/draft_only/i);
    expect(() => assertRecoveryPolicyDraftMutable("retired")).toThrow(/draft_only/i);
  });

  it("fails publish validation for unknown canonical codes, missing customer copy and unsupported AST", () => {
    expect(() => validateRecoveryPolicyDraftForPublish({
      ...mappingDraft,
      canonicalCode: "NOT_A_CANONICAL_REASON",
    })).toThrow(/unknown_canonical/i);

    expect(() => validateRecoveryPolicyDraftForPublish({
      ...templateDraft,
      customerHeadline: "   ",
    })).toThrow(/customer_copy/i);

    expect(() => validateRecoveryPolicyDraftForPublish({
      kind: "reassessment_rule",
      partnerId,
      productCategory: "credit_card",
      canonicalCode: "THIN_FILE",
      conditionAst: { op: "execute", fact: "monthsSinceDecline", value: 3 },
      version: 1,
    })).toThrow(/invalid_condition/i);
  });

  it("fails publish validation rather than creating a second active mapping for the same lender code", () => {
    expect(() => validateRecoveryPolicyDraftForPublish(mappingDraft, {
      activePublishedMappingCount: 1,
    })).toThrow(/ambiguous_mapping/i);
  });

  it("keeps every admin page and mutation route behind existing admin auth", () => {
    const required = [
      "app/admin/recovery/policies/page.tsx",
      "app/admin/recovery/simulator/page.tsx",
      "app/api/admin/recovery/policies/route.ts",
      "app/api/admin/recovery/policies/publish/route.ts",
      "app/api/admin/recovery/simulate/route.ts",
      "components/admin/recovery-policy-form.tsx",
      "components/admin/recovery-simulator-form.tsx",
    ];
    for (const path of required) expect(existsSync(resolve(process.cwd(), path))).toBe(true);

    for (const path of required.filter((path) => path.startsWith("app/"))) {
      if (!existsSync(resolve(process.cwd(), path))) continue;
      const source = readFileSync(resolve(process.cwd(), path), "utf8");
      expect(source).toContain("requireAdminUser");
    }
  });
});
