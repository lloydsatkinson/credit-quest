import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createReturnToOrigin,
  ReturnOriginGatewayError,
} from "@/lib/server/return-origin-gateway";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const returnToOriginSchema = z.object({
  recoveryJourneyId: z.string().uuid(),
  customerChoice: z.enum(["continue", "decline"]),
}).strict();

export async function POST(request: Request) {
  const parsed = returnToOriginSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid return request" }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  try {
    const result = await createReturnToOrigin({
      userId: user.id,
      recoveryJourneyId: parsed.data.recoveryJourneyId,
      customerChoice: parsed.data.customerChoice,
      now: new Date(),
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ReturnOriginGatewayError) {
      return NextResponse.json(
        { error: "Return-to-Origin is not available right now", code: error.code },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: "Could not process return request" }, { status: 500 });
  }
}
