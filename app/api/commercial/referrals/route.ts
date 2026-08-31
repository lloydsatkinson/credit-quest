import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabasePublicEnv } from "@/lib/supabase/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  CommercialGatewayError,
  createCommercialReferral,
} from "@/lib/server/commercial-gateway";

export const commercialReferralSchema = z.object({
  routeId: z.string().uuid(),
  disclosureId: z.string().uuid(),
  consent: z.literal(true),
  originatingMissionId: z.string().uuid().nullable().optional(),
}).strict();

export async function POST(request: Request) {
  const parsed = commercialReferralSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid referral request" }, { status: 400 });
  }

  if (!getSupabasePublicEnv()) {
    return NextResponse.json(
      { error: "Sandbox referral requires a signed-in account" },
      { status: 409 },
    );
  }

  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  try {
    const result = await createCommercialReferral({
      userId: user.id,
      routeId: parsed.data.routeId,
      disclosureId: parsed.data.disclosureId,
      consent: parsed.data.consent,
      originatingMissionId: parsed.data.originatingMissionId ?? null,
      now: new Date(),
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof CommercialGatewayError) {
      return NextResponse.json(
        { error: "This route is not available right now" },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: "Could not create the sandbox referral" },
      { status: 500 },
    );
  }
}
