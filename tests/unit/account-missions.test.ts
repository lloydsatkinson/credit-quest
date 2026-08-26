import { describe, expect, it } from "vitest";
import { MISSION_CATALOGUE } from "@/lib/data/missions";
import {
  amountToReachUtilisation,
  buildMissionInstances,
  calculateAccountUtilisation,
  deriveAccountProfileSignals,
} from "@/lib/domain/account-missions";
import type { CreditProfile, UserAccount } from "@/lib/domain/types";

const profile: CreditProfile = {
  userId: "u1",
  dateOfBirth: "1990-01-01",
  employmentStatus: "employed",
  incomeBand: "30_50k",
  housingStatus: "rent",
  electoralRoll: true,
  utilisationPct: 62,
  missedPaymentsLast12m: 0,
  hardApplicationsLast6m: 0,
  hasRevolvingCredit: true,
  hasDirectDebitForCredit: false,
};

const card = (
  id: string,
  balanceMinor: number,
  limitMinor: number,
  directDebitStatus: "yes" | "no" | "unknown",
): UserAccount => ({
  id,
  userId: "u1",
  providerId: null,
  providerName: null,
  accountType: "credit_card",
  nickname: id,
  lastFour: null,
  balanceMinor,
  creditLimitMinor: limitMinor,
  currency: "GBP",
  directDebitStatus,
  source: "manual",
  active: true,
  lastVerifiedAt: null,
});

describe("account-aware missions", () => {
  it("declares direct debit and utilisation as account-scoped missions", () => {
    const bySlug = Object.fromEntries(MISSION_CATALOGUE.map((mission) => [mission.slug, mission]));

    expect(bySlug["set-up-direct-debit"].scope).toBe("account");
    expect(bySlug["reduce-utilisation"].scope).toBe("account");
    expect(bySlug["register-electoral-roll"].scope).toBe("profile");
    expect(bySlug["application-cooldown"].scope).toBe("profile");
    expect(bySlug["build-revolving-history"].scope).toBe("profile");
  });

  it("calculates utilisation and amount needed to reach 30 percent", () => {
    const account = card("a1", 62000, 100000, "no");

    expect(calculateAccountUtilisation(account)).toBe(62);
    expect(amountToReachUtilisation(account, 30)).toBe(32000);
  });

  it("keeps utilisation unknown when balance or limit is missing", () => {
    expect(calculateAccountUtilisation({ ...card("a1", 0, 100000, "no"), balanceMinor: null })).toBeNull();
    expect(calculateAccountUtilisation({ ...card("a1", 0, 100000, "no"), creditLimitMinor: null })).toBeNull();
  });

  it("creates separate direct-debit mission instances for separate unprotected cards", () => {
    const instances = buildMissionInstances(
      profile,
      [card("a1", 20000, 100000, "no"), card("a2", 10000, 100000, "no")],
      [],
      new Date("2026-08-26T12:00:00Z"),
    );

    const directDebit = instances.filter((instance) => instance.missionSlug === "set-up-direct-debit");
    expect(directDebit).toHaveLength(2);
    expect(directDebit.map((instance) => instance.subject)).toEqual(expect.arrayContaining([
      { kind: "account", accountId: "a1" },
      { kind: "account", accountId: "a2" },
    ]));
  });
});

describe("tracked account profile signals", () => {
  it("derives aggregate utilisation from total balances and total limits", () => {
    expect(deriveAccountProfileSignals([
      card("a1", 30000, 100000, "yes"),
      card("a2", 70000, 100000, "yes"),
    ])).toMatchObject({
      utilisationPct: 50,
      hasRevolvingCredit: true,
      hasDirectDebitForCredit: true,
    });
  });

  it("keeps aggregate utilisation unknown if any tracked card lacks balance or limit", () => {
    expect(deriveAccountProfileSignals([
      card("a1", 30000, 100000, "yes"),
      { ...card("a2", 0, 100000, "yes"), balanceMinor: null },
    ]).utilisationPct).toBeNull();
  });

  it("derives conservative direct-debit status across tracked cards", () => {
    expect(deriveAccountProfileSignals([
      card("a1", 10000, 100000, "yes"),
      card("a2", 10000, 100000, "yes"),
    ]).hasDirectDebitForCredit).toBe(true);

    expect(deriveAccountProfileSignals([
      card("a1", 10000, 100000, "yes"),
      card("a2", 10000, 100000, "no"),
    ]).hasDirectDebitForCredit).toBe(false);

    expect(deriveAccountProfileSignals([
      card("a1", 10000, 100000, "yes"),
      card("a2", 10000, 100000, "unknown"),
    ]).hasDirectDebitForCredit).toBeNull();
  });

  it("treats at least one active tracked credit card as revolving credit", () => {
    expect(deriveAccountProfileSignals([card("a1", 10000, 100000, "yes")]).hasRevolvingCredit).toBe(true);
  });

  it("does not overwrite manually reported profile signals when no active credit cards are tracked", () => {
    expect(deriveAccountProfileSignals([])).toEqual({});
    expect(deriveAccountProfileSignals([{ ...card("a1", 10000, 100000, "yes"), active: false }])).toEqual({});
  });
});
