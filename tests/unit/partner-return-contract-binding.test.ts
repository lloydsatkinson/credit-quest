import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { findEligibleSandboxReturnContract } from "@/lib/server/partner-intake-repository";

const NOW = new Date("2026-09-03T09:00:00.000Z");

function adminWithRows(rows: Array<{ id: string }>) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.is = vi.fn(() => chain);
  chain.gt = vi.fn(() => chain);
  chain.limit = vi.fn().mockResolvedValue({ data: rows, error: null });

  const admin = {
    from: vi.fn(() => chain),
  } as unknown as SupabaseClient;

  return { admin, chain };
}

describe("eligible sandbox return-contract lookup", () => {
  it("scopes contract selection to the authenticated partner, product and callback-free sandbox constraints", async () => {
    const { admin, chain } = adminWithRows([{ id: "contract-1" }]);

    const result = await findEligibleSandboxReturnContract(
      admin,
      "partner-1",
      "credit_card",
      NOW,
    );

    expect(result).toEqual({ id: "contract-1" });
    expect(admin.from).toHaveBeenCalledWith("return_contracts");
    expect(chain.select).toHaveBeenCalledWith("id");
    expect(chain.eq).toHaveBeenNthCalledWith(1, "partner_id", "partner-1");
    expect(chain.eq).toHaveBeenNthCalledWith(2, "product_category", "credit_card");
    expect(chain.eq).toHaveBeenNthCalledWith(3, "environment", "sandbox");
    expect(chain.eq).toHaveBeenNthCalledWith(4, "enabled", true);
    expect(chain.eq).toHaveBeenNthCalledWith(5, "callback_policy", "none");
    expect(chain.is).toHaveBeenCalledWith("callback_url", null);
    expect(chain.gt).toHaveBeenCalledWith("expires_at", NOW.toISOString());
    expect(chain.limit).toHaveBeenCalledWith(2);
  });

  it("fails closed to no binding when no eligible sandbox contract exists", async () => {
    const { admin } = adminWithRows([]);

    await expect(findEligibleSandboxReturnContract(
      admin,
      "partner-1",
      "credit_card",
      NOW,
    )).resolves.toBeNull();
  });

  it("fails closed to no binding when configuration is ambiguous", async () => {
    const { admin } = adminWithRows([
      { id: "contract-1" },
      { id: "contract-2" },
    ]);

    await expect(findEligibleSandboxReturnContract(
      admin,
      "partner-1",
      "credit_card",
      NOW,
    )).resolves.toBeNull();
  });
});
