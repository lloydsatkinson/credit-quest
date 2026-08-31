import { describe, expect, it } from "vitest";
import { partnerSchema } from "@/app/api/admin/partners/route";
import { routeSchema } from "@/app/api/admin/routes/route";
import { flagSchema } from "@/app/api/admin/flags/route";
import { disclosurePublishSchema } from "@/app/api/admin/disclosures/route";
import { experimentSchema } from "@/app/api/admin/experiments/route";

const uuid = "00000000-0000-0000-0000-000000000001";

describe("admin API schemas", () => {
  it("accepts only the narrow partner contract", () => {
    const valid = {
      partnerKey: "example",
      displayName: "Example",
      enabled: true,
      sandboxEnabled: true,
      liveEnabled: false,
      notes: "Sandbox only",
    };
    expect(partnerSchema.safeParse(valid).success).toBe(true);
    expect(partnerSchema.safeParse({ ...valid, commission: 100 }).success).toBe(false);
    expect(partnerSchema.safeParse({ ...valid, adminUserId: uuid }).success).toBe(false);
  });

  it("keeps route safety and economics out of client input", () => {
    const valid = {
      routeKey: "example-sandbox",
      partnerId: uuid,
      environment: "sandbox",
      destinationUrl: "/sandbox/referral-complete",
      enabled: false,
      disclosureKey: "sandbox-referral-disclosure",
    };
    expect(routeSchema.safeParse(valid).success).toBe(true);
    expect(routeSchema.safeParse({ ...valid, commission: 100 }).success).toBe(false);
    expect(routeSchema.safeParse({ ...valid, minAge: 16 }).success).toBe(false);
    expect(routeSchema.safeParse({ ...valid, requiredReadiness: "amber" }).success).toBe(false);
  });

  it("allows only the two runtime switches", () => {
    expect(flagSchema.safeParse({ flagKey: "commercial_gateway_enabled", enabled: false }).success).toBe(true);
    expect(flagSchema.safeParse({ flagKey: "email_reminders_enabled", enabled: false }).success).toBe(true);
    expect(flagSchema.safeParse({ flagKey: "readiness_threshold", enabled: true }).success).toBe(false);
  });

  it("uses stable disclosure ids and presentation-only experiment fields", () => {
    expect(disclosurePublishSchema.safeParse({ disclosureId: uuid }).success).toBe(true);
    expect(disclosurePublishSchema.safeParse({ disclosureId: uuid, status: "published" }).success).toBe(false);

    const experiment = {
      experimentKey: "route-order-v1",
      status: "draft",
      surfaceKey: "commercial_route_order",
      variants: [{ key: "control", presentationKey: "control" }],
    };
    expect(experimentSchema.safeParse(experiment).success).toBe(true);
    expect(experimentSchema.safeParse({ ...experiment, eligibilityRule: "readiness=green" }).success).toBe(false);
  });
});
