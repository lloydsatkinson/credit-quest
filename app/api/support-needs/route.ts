import { NextResponse } from "next/server";
import { z } from "zod";
import { deriveSupportAdaptations } from "@/lib/recovery/support";
import type { SupportNeedCode } from "@/lib/recovery/types";
import {
  listSupportNeeds,
  replaceSupportNeeds,
} from "@/lib/server/support-needs-repository";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getSupabasePublicEnv } from "@/lib/supabase/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const supportNeedCodeSchema = z.enum([
  "simpler_explanations",
  "larger_text",
  "fewer_steps",
  "more_time",
  "reduced_motion",
  "reminder_support",
  "human_support",
  "digital_support",
]);

export const supportNeedsSchema = z.object({
  needs: z.array(supportNeedCodeSchema).max(8),
}).strict().superRefine((value, ctx) => {
  if (new Set(value.needs).size !== value.needs.length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["needs"],
      message: "Support needs must be unique",
    });
  }
});

function responseFor(needs: readonly SupportNeedCode[], persisted: boolean, mode?: "demo") {
  return {
    ...(mode ? { mode } : {}),
    persisted,
    needs,
    adaptations: deriveSupportAdaptations(needs),
  };
}

export async function GET() {
  if (!getSupabasePublicEnv()) {
    return NextResponse.json(responseFor([], false, "demo"));
  }

  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const needs = await listSupportNeeds(supabase, user.id);
  return NextResponse.json(responseFor(needs, true));
}

export async function PATCH(request: Request) {
  const parsed = supportNeedsSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid support preferences" }, { status: 400 });
  }

  const needs = parsed.data.needs as SupportNeedCode[];
  if (!getSupabasePublicEnv()) {
    return NextResponse.json(responseFor(needs, false, "demo"));
  }

  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const admin = createAdminSupabaseClient();
  const saved = await replaceSupportNeeds(admin, user.id, needs, new Date());
  return NextResponse.json(responseFor(saved, true));
}
