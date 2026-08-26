import { NextResponse } from "next/server";
import { z } from "zod";
import { calculateAccountUtilisation } from "@/lib/domain/account-missions";
import { applyActionResponse } from "@/lib/domain/action-lifecycle";
import type { ActionAttemptStatus, MissionState, UserAccount } from "@/lib/domain/types";
import {
  getActionAttempt,
  updateActionAttempt,
} from "@/lib/server/action-repository";
import {
  getUserAccount,
  updateUserAccount,
} from "@/lib/server/account-repository";
import { recordServerEvent, type EventName } from "@/lib/server/event-repository";
import {
  getMissionInstance,
  updateMissionInstanceState,
} from "@/lib/server/mission-repository";
import { updateUserProfile } from "@/lib/server/profile-repository";
import { getSupabasePublicEnv } from "@/lib/supabase/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const actionAttemptResponseSchema = z.object({
  response: z.enum([
    "submitted",
    "completed",
    "started",
    "not_finished",
    "could_not_do",
    "do_later",
    "confirmed_registered",
  ]),
  balanceMinor: z.number().int().min(0).optional(),
  creditLimitMinor: z.number().int().positive().optional(),
}).strict();

function hasKeys(value: object): boolean {
  return Object.keys(value).length > 0;
}

function actionEventFor(status: ActionAttemptStatus): EventName {
  if (status === "verified") return "action_verified";
  if (status === "submitted") return "action_submitted";
  if (status === "self_confirmed") return "action_self_confirmed";
  if (status === "cancelled") return "action_cancelled";
  return "action_returned";
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const parsed = actionAttemptResponseSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid action response" }, { status: 400 });
  if (!getSupabasePublicEnv()) {
    return NextResponse.json({ error: "Action Layer requires a signed-in account" }, { status: 409 });
  }

  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const { id } = await context.params;
  const now = new Date();
  const nowIso = now.toISOString();

  try {
    const attempt = await getActionAttempt(supabase, user.id, id);
    if (!attempt) return NextResponse.json({ error: "Action attempt not found" }, { status: 404 });

    const instance = await getMissionInstance(supabase, user.id, attempt.missionInstanceId);
    if (!instance) return NextResponse.json({ error: "Mission not found" }, { status: 404 });

    const account = instance.subject.kind === "account"
      ? await getUserAccount(supabase, user.id, instance.subject.accountId)
      : null;

    if (instance.subject.kind === "account" && !account) {
      return NextResponse.json({ error: "Target account not found" }, { status: 409 });
    }

    const baseOutcome = applyActionResponse({
      missionSlug: instance.missionSlug,
      response: parsed.data.response,
      now,
    });

    let missionState: MissionState = baseOutcome.missionState;
    let attemptStatus: ActionAttemptStatus = baseOutcome.attemptStatus;
    let nextReviewAt = baseOutcome.nextReviewAt;
    const accountPatch: Partial<Pick<UserAccount, "directDebitStatus" | "balanceMinor" | "creditLimitMinor">> = {
      ...baseOutcome.accountPatch,
    };

    if (parsed.data.balanceMinor !== undefined) accountPatch.balanceMinor = parsed.data.balanceMinor;
    if (parsed.data.creditLimitMinor !== undefined) accountPatch.creditLimitMinor = parsed.data.creditLimitMinor;

    if (instance.missionSlug === "reduce-utilisation" && account) {
      const candidate = { ...account, ...accountPatch };
      const utilisation = calculateAccountUtilisation(candidate);
      const userSaysDone = parsed.data.response === "completed" || parsed.data.response === "submitted";

      if (userSaysDone && utilisation !== null && utilisation <= 30) {
        missionState = "completed";
        attemptStatus = "self_confirmed";
        nextReviewAt = null;
      }
    }

    let updatedAccount = account;
    if (account && hasKeys(accountPatch)) {
      updatedAccount = await updateUserAccount(supabase, user.id, account.id, accountPatch);
      if (!updatedAccount) {
        return NextResponse.json({ error: "Could not update target account" }, { status: 409 });
      }
    }

    if (hasKeys(baseOutcome.profilePatch)) {
      await updateUserProfile(supabase, user.id, baseOutcome.profilePatch, now);
    }

    const missionPatch: Parameters<typeof updateMissionInstanceState>[3] = {
      state: missionState,
      nextReviewAt,
    };
    if (missionState === "completed") missionPatch.completedAt = instance.completedAt ?? nowIso;

    const updatedMission = await updateMissionInstanceState(
      supabase,
      user.id,
      instance.id,
      missionPatch,
    );
    if (!updatedMission) {
      return NextResponse.json({ error: "Could not update mission" }, { status: 409 });
    }

    const updatedAttempt = await updateActionAttempt(supabase, user.id, attempt.id, {
      status: attemptStatus,
      returnedAt: attempt.returnedAt ?? nowIso,
      selfConfirmedAt: ["self_confirmed", "submitted"].includes(attemptStatus)
        ? attempt.selfConfirmedAt ?? nowIso
        : attempt.selfConfirmedAt,
      verifiedAt: attemptStatus === "verified" ? attempt.verifiedAt ?? nowIso : attempt.verifiedAt,
      nextReviewAt,
    });
    if (!updatedAttempt) {
      return NextResponse.json({ error: "Could not update action attempt" }, { status: 409 });
    }

    await recordServerEvent(supabase, user.id, actionEventFor(attemptStatus), {
      missionSlug: instance.missionSlug,
      missionInstanceId: instance.id,
      attemptId: attempt.id,
      accountType: account?.accountType ?? null,
      response: parsed.data.response,
      missionState,
    });

    return NextResponse.json({
      attempt: updatedAttempt,
      mission: updatedMission,
      account: updatedAccount,
      profilePatch: baseOutcome.profilePatch,
    });
  } catch {
    return NextResponse.json({ error: "Could not save this action response" }, { status: 500 });
  }
}
