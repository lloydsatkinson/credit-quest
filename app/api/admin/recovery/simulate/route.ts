import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminUser } from "@/lib/server/admin-auth";
import { simulateRecoveryScenario } from "@/lib/server/recovery-simulator-service";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

const productCategorySchema = z.enum(["credit_card", "loan", "overdraft", "mortgage", "other"]);
const factValueSchema = z.union([z.string(), z.number().finite(), z.boolean(), z.null()]);

export const recoverySimulationSchema = z.object({
  partnerId: z.string().uuid(),
  productCategory: productCategorySchema,
  declineCodes: z.array(z.string().trim().min(1).max(120)).min(1).max(8),
  facts: z.record(z.string(), factValueSchema).default({}),
  now: z.string().datetime({ offset: true }),
}).strict();

export async function POST(request: Request) {
  await requireAdminUser();
  const parsed = recoverySimulationSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid recovery simulation" }, { status: 400 });
  try {
    const result = await simulateRecoveryScenario(createAdminSupabaseClient(), parsed.data);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error && /ambiguous_/.test(error.message)) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    throw error;
  }
}
