import { NextResponse } from "next/server";
import { z } from "zod";
import {
  PartnerHandoffError,
  redeemPartnerHandoff,
} from "@/lib/server/partner-intake-service";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const tokenSchema = z.string().min(40).max(120).regex(/^[A-Za-z0-9_-]+$/);
const correctedReasonSchema = z.string().trim().min(1).max(160).nullable();

export const redeemHandoffSchema = z.object({
  token: tokenSchema,
  contextAction: z.enum([
    "confirm",
    "correct_reason",
    "reason_unknown",
    "decline_optional_reason_use",
  ]),
  correctedReasonCode: correctedReasonSchema,
}).strict().superRefine((value, ctx) => {
  if (value.contextAction === "correct_reason" && !value.correctedReasonCode) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["correctedReasonCode"],
      message: "A corrected reason is required",
    });
  }
  if (value.contextAction !== "correct_reason" && value.correctedReasonCode !== null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["correctedReasonCode"],
      message: "A corrected reason is only accepted when correcting the reason",
    });
  }
});

export async function POST(request: Request) {
  const parsed = redeemHandoffSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid handoff review" }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  try {
    const recovery = await redeemPartnerHandoff({
      token: parsed.data.token,
      userId: user.id,
      review: {
        contextAction: parsed.data.contextAction,
        correctedReasonCode: parsed.data.correctedReasonCode,
      },
      now: new Date(),
    });
    return NextResponse.json({ recovery }, { status: 201 });
  } catch (error) {
    if (error instanceof PartnerHandoffError) {
      if (error.status === 400) {
        return NextResponse.json({ error: "Invalid handoff review" }, { status: 400 });
      }
      return NextResponse.json(
        { error: "This handoff link cannot be used" },
        { status: 410 },
      );
    }

    return NextResponse.json(
      { error: "Could not save handoff review" },
      { status: 500 },
    );
  }
}
