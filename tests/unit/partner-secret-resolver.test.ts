import { afterEach, describe, expect, it, vi } from "vitest";
import { resolvePartnerSecretReference } from "@/lib/server/partner-secret-resolver";

const ENV_SECRET = "env-partner-secret-that-is-long-enough-123";
const VAULT_SECRET = "vault-partner-secret-that-is-long-enough-456";

function adminWithRpc(data: unknown, error: unknown = null) {
  return {
    rpc: vi.fn().mockResolvedValue({ data, error }),
  };
}

describe("partner secret resolver", () => {
  afterEach(() => {
    delete process.env.CQ_TEST_PARTNER_SECRET;
  });

  it("preserves legacy environment secret references", async () => {
    process.env.CQ_TEST_PARTNER_SECRET = ENV_SECRET;
    const admin = adminWithRpc(null);

    await expect(
      resolvePartnerSecretReference(admin as never, "CQ_TEST_PARTNER_SECRET"),
    ).resolves.toBe(ENV_SECRET);
    expect(admin.rpc).not.toHaveBeenCalled();
  });

  it("resolves explicit vault references through the service-role RPC", async () => {
    const admin = adminWithRpc(VAULT_SECRET);

    await expect(
      resolvePartnerSecretReference(admin as never, "vault:cq-internal-pilot-partner"),
    ).resolves.toBe(VAULT_SECRET);
    expect(admin.rpc).toHaveBeenCalledWith("get_partner_secret_from_vault", {
      p_secret_name: "cq-internal-pilot-partner",
    });
  });

  it("fails closed for invalid vault names, missing secrets, and short secrets", async () => {
    const invalidName = adminWithRpc(VAULT_SECRET);
    await expect(
      resolvePartnerSecretReference(invalidName as never, "vault:../../unsafe"),
    ).rejects.toThrow("Partner request authentication failed");
    expect(invalidName.rpc).not.toHaveBeenCalled();

    await expect(
      resolvePartnerSecretReference(adminWithRpc(null) as never, "vault:missing-secret"),
    ).rejects.toThrow("Partner request authentication failed");

    await expect(
      resolvePartnerSecretReference(adminWithRpc("too-short") as never, "vault:short-secret"),
    ).rejects.toThrow("Partner request authentication failed");
  });
});
