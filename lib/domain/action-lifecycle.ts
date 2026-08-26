import type {
  ActionAttemptStatus,
  CreditProfile,
  MissionState,
  UserAccount,
} from "@/lib/domain/types";

export type ActionResponse =
  | "submitted"
  | "completed"
  | "started"
  | "not_finished"
  | "could_not_do"
  | "do_later"
  | "confirmed_registered";

export interface ActionOutcome {
  attemptStatus: ActionAttemptStatus;
  missionState: MissionState;
  nextReviewAt: string | null;
  profilePatch: Partial<Pick<CreditProfile, "electoralRoll" | "hasDirectDebitForCredit">>;
  accountPatch: Partial<Pick<UserAccount, "directDebitStatus" | "balanceMinor" | "creditLimitMinor">>;
}

function addDays(now: Date, days: number): string {
  return new Date(now.getTime() + days * 86_400_000).toISOString();
}

function baseOutcome(
  attemptStatus: ActionAttemptStatus,
  missionState: MissionState,
  nextReviewAt: string | null = null,
): ActionOutcome {
  return {
    attemptStatus,
    missionState,
    nextReviewAt,
    profilePatch: {},
    accountPatch: {},
  };
}

export function applyActionResponse({
  missionSlug,
  response,
  now = new Date(),
}: {
  missionSlug: string;
  response: ActionResponse;
  now?: Date;
}): ActionOutcome {
  if (response === "not_finished") return baseOutcome("returned", "started");
  if (response === "could_not_do") return baseOutcome("failed", "started");
  if (response === "do_later") return baseOutcome("returned", "deferred", addDays(now, 7));

  if (missionSlug === "register-electoral-roll") {
    if (response === "confirmed_registered") {
      return {
        ...baseOutcome("verified", "completed"),
        profilePatch: { electoralRoll: true },
      };
    }
    if (response === "submitted" || response === "completed") {
      return baseOutcome("submitted", "in_review", addDays(now, 30));
    }
    return baseOutcome("returned", "started");
  }

  if (missionSlug === "set-up-direct-debit") {
    if (response === "completed" || response === "submitted") {
      return {
        ...baseOutcome("self_confirmed", "completed"),
        accountPatch: { directDebitStatus: "yes" },
      };
    }
    return baseOutcome("returned", "started");
  }

  if (missionSlug === "reduce-utilisation") {
    if (response === "completed" || response === "submitted") {
      // The attempt can be self-confirmed, but the mission stays open until
      // updated account evidence proves utilisation is at or below the target.
      return baseOutcome("self_confirmed", "started");
    }
    return baseOutcome("returned", "started");
  }

  if (missionSlug === "application-cooldown") {
    if (response === "started" || response === "completed") {
      return baseOutcome("verified", "cooldown", addDays(now, 30));
    }
    return baseOutcome("returned", "started");
  }

  if (missionSlug === "build-revolving-history") {
    if (response === "completed" || response === "submitted") {
      // A product click/application is lender-owned and cannot prove that a
      // suitable account was opened and responsibly managed.
      return baseOutcome("self_confirmed", "in_review", addDays(now, 30));
    }
    return baseOutcome("returned", "started");
  }

  return baseOutcome("returned", "started");
}
