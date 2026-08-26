import { NextResponse } from "next/server";
import { z } from "zod";
import { resolveOwnedMissionAction } from "@/lib/server/action-service";
import { recordServerEvent } from "@/lib/server/event-repository";
import { getSupabasePublicEnv } from "@/lib/supabase/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const actionResolveSchema = z.object({
  missionInstanceId: z.string().uuid(),
}).strict();

export async function POST(request: Request) {
  const parsed = actionResolveSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid action request" }, { status: 400 });
  if (!getSupabasePublicEnv()) return NextResponse.json({ error: "Action Layer requires a signed-in account" }, { status: 409 });

  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  try {
    const result = await resolveOwnedMissionAction(supabase, user.id, parsed.data.missionInstanceId);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

    const { context } = result;
    await recordServerEvent(supabase, user.id, "action_resolved", {
      missionSlug: context.mission.slug,
      missionInstanceId: context.instance.id,
      actionId: context.actionDefinition.id,
      accountType: context.account?.accountType ?? null,
      fallbackUsed: context.resolvedAction.fallbackUsed,
    });

    return NextResponse.json({
      missionInstanceId: context.instance.id,
      missionSlug: context.mission.slug,
      missionTitle: context.mission.title,
      rationale: context.mission.rationale,
      account: context.account ? {
        id: context.account.id,
        providerName: context.account.providerName,
        nickname: context.account.nickname,
        lastFour: context.account.lastFour,
        accountType: context.account.accountType,
      } : null,
      resolvedAction: context.resolvedAction,
    });
  } catch {
    return NextResponse.json({ error: "Could not resolve this action" }, { status: 500 });
  }
}
