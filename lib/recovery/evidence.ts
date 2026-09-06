import { deriveAccountProfileSignals } from "@/lib/domain/account-missions";
import type {
  ActionAttempt,
  CreditPassport,
  CreditProfile,
  MissionInstance,
  UserAccount,
} from "@/lib/domain/types";
import type { RecoveryEvidenceItem } from "@/lib/recovery/experience";

interface BuildRecoveryEvidenceInput {
  profile: CreditProfile;
  accounts: UserAccount[];
  missionInstances: MissionInstance[];
  actionAttempts: ActionAttempt[];
  passport: CreditPassport;
}

function hasPendingElectoralRollAction(input: BuildRecoveryEvidenceInput): boolean {
  const electoralMissionIds = new Set(
    input.missionInstances
      .filter((mission) => mission.missionSlug === "register-electoral-roll")
      .map((mission) => mission.id),
  );

  return input.actionAttempts.some((attempt) =>
    electoralMissionIds.has(attempt.missionInstanceId)
    && ["started", "returned", "submitted", "self_confirmed"].includes(attempt.status)
    && attempt.verifiedAt === null,
  );
}

function electoralRollEvidence(input: BuildRecoveryEvidenceInput): RecoveryEvidenceItem {
  if (hasPendingElectoralRollAction(input)) {
    return {
      key: "electoral_roll",
      label: "Electoral roll",
      confidence: "pending",
      source: "government_action",
      statusText: "Electoral-roll action submitted; waiting for review or the update to become visible.",
    };
  }

  if (input.profile.electoralRoll === null) {
    return {
      key: "electoral_roll",
      label: "Electoral roll",
      confidence: "unknown",
      source: "unknown",
      statusText: "Electoral-roll status is not yet known.",
    };
  }

  return {
    key: "electoral_roll",
    label: "Electoral roll",
    confidence: "confirmed",
    source: "customer",
    statusText: input.profile.electoralRoll
      ? "You told Credit Quest you are on the electoral roll at your current address."
      : "You told Credit Quest you are not on the electoral roll at your current address.",
  };
}

function utilisationEvidence(input: BuildRecoveryEvidenceInput): RecoveryEvidenceItem {
  const activeCreditCards = input.accounts.filter((account) =>
    account.active && account.accountType === "credit_card",
  );

  if (activeCreditCards.length > 0) {
    const utilisation = deriveAccountProfileSignals(input.accounts).utilisationPct;

    if (utilisation === null || utilisation === undefined) {
      return {
        key: "utilisation",
        label: "Credit utilisation",
        confidence: "unknown",
        source: "account",
        statusText: "Tracked credit-card information is incomplete, so aggregate utilisation cannot be calculated yet.",
      };
    }

    return {
      key: "utilisation",
      label: "Credit utilisation",
      confidence: "confirmed",
      source: "account",
      statusText: `Aggregate tracked credit-card utilisation is ${utilisation}% based on the account information currently held in Credit Quest.`,
    };
  }

  if (input.profile.utilisationPct === null) {
    return {
      key: "utilisation",
      label: "Credit utilisation",
      confidence: "unknown",
      source: "unknown",
      statusText: "Credit utilisation is not yet known.",
    };
  }

  return {
    key: "utilisation",
    label: "Credit utilisation",
    confidence: "confirmed",
    source: "customer",
    statusText: `You told Credit Quest your current utilisation is ${input.profile.utilisationPct}%.`,
  };
}

function applicationEvidence(input: BuildRecoveryEvidenceInput): RecoveryEvidenceItem {
  if (input.profile.hardApplicationsLast6m === null) {
    return {
      key: "application_evidence",
      label: "Recent applications",
      confidence: "unknown",
      source: "unknown",
      statusText: "Recent application activity is not yet known.",
    };
  }

  return {
    key: "application_evidence",
    label: "Recent applications",
    confidence: "confirmed",
    source: "customer",
    statusText: `You told Credit Quest about ${input.profile.hardApplicationsLast6m} hard application${input.profile.hardApplicationsLast6m === 1 ? "" : "s"} in the last six months.`,
  };
}

export function buildRecoveryEvidence(input: BuildRecoveryEvidenceInput): RecoveryEvidenceItem[] {
  void input.passport;

  return [
    electoralRollEvidence(input),
    utilisationEvidence(input),
    applicationEvidence(input),
  ];
}
