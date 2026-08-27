import { NextResponse } from "next/server";
import { z } from "zod";
import { applyActionResponse, applyUtilisationEvidence } from "@/lib/domain/action-lifecycle";
import type { ActionAttemptStatus, UserAccount } from "@/lib/domain/types";
import {
  getActionAttempt,
  updateActionAttempt,
} from "@/lib/server/action-repository";
import {
  getUserAccount,
  updateUserAccount,
} from "@/lib/server/account-repository";
import { syncTrackedAccountProfileSignals } from "@/lib/server/account-signal-service";
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
    "confirmed_account_opened",
  ]),
  balanceMinor: z.number().int().min(0).optional(),
  creditLimitMinor: z.number().int().positive().optional(),
}).strict();

export type ActionAttemptResponseInput = z.infer<typeof actionAttemptResponseSchema>;

export function actionEvidenceAllowedForMission(
  missionSlug: string,
  input: ActionAttemptResponseInput,
): boolean {
  const hasUtilisationEvidence = input.balanceMinor !== undefined || input.creditLimitMinor !== undefined;
  return !hasUtilisationEvidence || missionSlug === "reduce-utilisation";
}

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
    if (!actionEvidenceAllowedForMission(instance.missionSlug, parsed.data)) {
      return NextResponse.json({ error: "Balance and limit evidence is only valid for utilisation missions" }, { status: 400 });
    }

    const account = instance.subject.kind === "account"
      ? await getUserAccount(supabase, user.id, instance.subject.accountId)
      : null;

    if (instance.subject.kind === "account" && !account) {
      return NextResponse.json({ error: "Target account not found" }, { status: 409 });
    }

    let outcome = applyActionResponse({
      missionSlug: instance.missionSlug,
      response: parsed.data.response,
      now,
    });

    const accountPatch: Partial<Pick<UserAccount, "directDebitStatus" | "balanceMinor" | "creditLimitMinor">> = {
      ...outcome.accountPatch,
    };
    if (parsed.data.balanceMinor !== undefined) accountPatch.balanceMinor = parsed.data.balanceMinor;
    if (parsed.data.creditLimitMinor !== undefined) accountPatch.creditLimitMinor = parsed.data.creditLimitMinor;

    const userSaysDone = parsed.data.response === "completed" || parsed.data.response === "submitted";
    if (instance.missionSlug === "reduce-utilisation" && account && userSaysDone) {
      outcome = applyUtilisationEvidence(outcome, { ...account, ...accountPatch });
    }

    let updatedAccount = account;
    if (account && hasKeys(accountPatch)) {
      updatedAccount = await updateUserAccount(supabase, user.id, account.id, accountPatch);
      if (!updatedAccount) {
        return NextResponse.json({ error: "Could not update target account" }, { status: 409 });
      }
      await syncTrackedAccountProfileSignals(supabase, user.id, now);
    }

    if (hasKeys(outcome.profilePatch)) {
      await updateUserProfile(supabase, user.id, outcome.profilePatch, now);
    }

    const missionPatch: Parameters<typeof updateMissionInstanceState>[3] = {
      state: outcome.missionState,
      nextReviewAt: outcome.nextReviewAt,
    };
    if (outcome.missionState === "completed") missionPatch.completedAt = instance.completedAt ?? nowIso;

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
      status: outcome.attemptStatus,
      returnedAt: attempt.returnedAt ?? nowIso,
      selfConfirmedAt: ["self_confirmed", "submitted"].includes(outcome.attemptStatus)
        ? attempt.selfConfirmedAt ?? nowIso
        : attempt.selfConfirmedAt,
      verifiedAt: outcome.attemptStatus === "verified" ? attempt.verifiedAt ?? nowIso : attempt.verifiedAt,
      nextReviewAt: outcome.nextReviewAt,
    });
    if (!updatedAttempt) {
      return NextResponse.json({ error: "Could not update action attempt" }, { status: 409 });
    }

    await recordServerEvent(supabase, user.id, actionEventFor(outcome.attemptStatus), {
      missionSlug: instance.missionSlug,
      missionInstanceId: instance.id,
      attemptId: attempt.id,
      accountType: account?.accountType ?? null,
      response: parsed.data.response,
      missionState: outcome.missionState,
    });

    return NextResponse.json({
      attempt: updatedAttempt,
      mission: updatedMission,
      account: updatedAccount,
      profilePatch: outcome.profilePatch,
    });
  } catch {
    return NextResponse.json({ error: "Could not save this action response" }, { status: 500 });
  }
}
