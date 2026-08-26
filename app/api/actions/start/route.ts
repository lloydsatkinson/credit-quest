import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createActionAttempt,
  findPendingAttemptForMission,
  listPendingActionAttempts,
} from "@/lib/server/action-repository";
import { resolveOwnedMissionAction } from "@/lib/server/action-service";
import { recordServerEvent } from "@/lib/server/event-repository";
import { updateMissionInstanceState } from "@/lib/server/mission-repository";
import { getSupabasePublicEnv } from "@/lib/supabase/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const actionStartSchema = z.object({
  missionInstanceId: z.string().uuid(),
}).strict();

export async function POST(request: Request) {
  const parsed = actionStartSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid action request" }, { status: 400 });
  if (!getSupabasePublicEnv()) return NextResponse.json({ error: "Action Layer requires a signed-in account" }, { status: 409 });

  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  try {
    const result = await resolveOwnedMissionAction(supabase, user.id, parsed.data.missionInstanceId);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

    const { context } = result;
    const now = new Date();

    if (context.instance.state !== "started") {
      const updated = await updateMissionInstanceState(supabase, user.id, context.instance.id, {
        state: "started",
        startedAt: context.instance.startedAt ?? now.toISOString(),
      });
      if (!updated) return NextResponse.json({ error: "Could not start this mission" }, { status: 409 });
    }

    let pending = await listPendingActionAttempts(supabase, user.id);
    let existing = findPendingAttemptForMission(pending, context.instance.id);
    let attempt = existing;

    if (!attempt) {
      try {
        attempt = await createActionAttempt(supabase, {
          userId: user.id,
          missionInstanceId: context.instance.id,
          actionRegistryId: context.actionDefinition.id,
          accountId: context.account?.id ?? null,
          metadata: {
            missionSlug: context.mission.slug,
            fallbackUsed: context.resolvedAction.fallbackUsed,
          },
        });
      } catch (error) {
        // A concurrent request may have won the unique-index race. Re-read the
        // pending attempts and resume the winner; rethrow genuine insert errors.
        pending = await listPendingActionAttempts(supabase, user.id);
        existing = findPendingAttemptForMission(pending, context.instance.id);
        if (!existing) throw error;
        attempt = existing;
      }
    }

    await recordServerEvent(supabase, user.id, "action_started", {
      missionSlug: context.mission.slug,
      missionInstanceId: context.instance.id,
      actionId: context.actionDefinition.id,
      accountType: context.account?.accountType ?? null,
      fallbackUsed: context.resolvedAction.fallbackUsed,
      resumedExistingAttempt: Boolean(existing),
    });

    return NextResponse.json({
      attemptId: attempt.id,
      mode: context.resolvedAction.mode,
      destinationUrl: context.resolvedAction.destinationUrl,
    });
  } catch {
    return NextResponse.json({ error: "Could not start this action" }, { status: 500 });
  }
}
