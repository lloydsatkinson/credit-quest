import { NextResponse } from "next/server";
import { z } from "zod";
import { buildDeclineContext } from "@/lib/recovery/decline-context";
import { createDirectRecoveryJourney } from "@/lib/server/recovery-repository";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getSupabasePublicEnv } from "@/lib/supabase/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const productCategorySchema = z.enum([
  "credit_card",
  "loan",
  "overdraft",
  "mortgage",
  "other",
]);

const recentApplicationContextSchema = z.enum([
  "none",
  "one",
  "multiple",
  "unknown",
]);

export const directDeclineSchema = z.object({
  productCategory: productCategorySchema,
  declinedAt: z.string().datetime(),
  providerName: z.string().trim().min(1).max(120).nullable(),
  declineReasonProvided: z.boolean(),
  declineReasonCode: z.string().trim().min(1).max(160).nullable(),
  recentApplicationContext: recentApplicationContextSchema,
}).strict().superRefine((value, ctx) => {
  if (value.declineReasonProvided && !value.declineReasonCode) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["declineReasonCode"],
      message: "A reason is required when you say one was provided",
    });
  }
});

export async function POST(request: Request) {
  const parsed = directDeclineSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid decline details" }, { status: 400 });
  }

  const context = buildDeclineContext({
    origin: "direct",
    productCategory: parsed.data.productCategory,
    declinedAt: parsed.data.declinedAt,
    providerName: parsed.data.providerName,
    declineReasonProvided: parsed.data.declineReasonProvided,
    declineReasonCode: parsed.data.declineReasonCode,
    declineReasonSource: "customer",
  });

  if (!getSupabasePublicEnv()) {
    return NextResponse.json({
      mode: "demo",
      persisted: false,
      decline: context,
    });
  }

  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const admin = createAdminSupabaseClient();
  const recovery = await createDirectRecoveryJourney(
    admin,
    user.id,
    context,
    parsed.data.recentApplicationContext,
    new Date(),
  );

  return NextResponse.json({ persisted: true, recovery }, { status: 201 });
}
