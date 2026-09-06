import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  listLenderRecoveryPartners,
  readPartnerCohortSources,
  readPartnerPipelineSources,
  readPartnerPilotStatus,
  readPartnerRecoveryAnalyticsInput,
} from "@/lib/server/lender-recovery-repository";

type QueryCall = {
  table: string;
  method: string;
  args: unknown[];
};

type Row = Record<string, unknown>;

function fakeAdmin(
  responses: Record<string, Row[]> = {},
  errors: Record<string, Error> = {},
): { admin: SupabaseClient; calls: QueryCall[] } {
  const calls: QueryCall[] = [];

  function queryFor(table: string) {
    const result = () => ({ data: responses[table] ?? [], error: errors[table] ?? null });
    const query: Record<string, unknown> = {};

    for (const method of ["select", "eq", "in", "gte", "order", "is"] as const) {
      query[method] = (...args: unknown[]) => {
        calls.push({ table, method, args });
        return query;
      };
    }

    query.maybeSingle = (...args: unknown[]) => {
      calls.push({ table, method: "maybeSingle", args });
      const current = result();
      return Promise.resolve({
        data: current.error ? null : current.data[0] ?? null,
        error: current.error,
      });
    };

    query.then = (resolveValue: (value: unknown) => unknown, rejectValue: (reason: unknown) => unknown) =>
      Promise.resolve(result()).then(resolveValue, rejectValue);

    return query;
  }

  const admin = {
    from: (table: string) => {
      calls.push({ table, method: "from", args: [] });
      return queryFor(table);
    },
  } as unknown as SupabaseClient;

  return { admin, calls };
}

function callsFor(calls: QueryCall[], table: string, method: string): QueryCall[] {
  return calls.filter((call) => call.table === table && call.method === method);
}

function selectFor(calls: QueryCall[], table: string): string {
  return String(callsFor(calls, table, "select")[0]?.args[0] ?? "");
}

describe("lender recovery repository boundaries", () => {
  it("is a read-only repository and never names prohibited customer fields", () => {
    const source = readFileSync(
      resolve(process.cwd(), "lib/server/lender-recovery-repository.ts"),
      "utf8",
    );

    expect(source).not.toMatch(/\.insert\(|\.update\(|\.upsert\(|\.delete\(|\.rpc\(/);
    expect(source).not.toMatch(/support_needs/);
    expect(source).not.toMatch(/date_of_birth|income_band|balance_minor|credit_limit_minor/);
    expect(source).not.toMatch(/commercial_partners/);
  });

  it("lists lender selectors from decline_partners using only safe configuration fields", async () => {
    const { admin, calls } = fakeAdmin({
      decline_partners: [{
        id: "partner-a",
        partner_key: "alpha",
        display_name: "Alpha Bank",
        enabled: true,
        sandbox_enabled: true,
        live_enabled: false,
      }],
    });

    const result = await listLenderRecoveryPartners(admin);

    expect(result).toEqual([{
      id: "partner-a",
      partnerKey: "alpha",
      displayName: "Alpha Bank",
      enabled: true,
      sandboxEnabled: true,
      liveEnabled: false,
    }]);
    expect(selectFor(calls, "decline_partners")).toBe(
      "id,partner_key,display_name,enabled,sandbox_enabled,live_enabled",
    );
    expect(calls.some((call) => call.table === "commercial_partners")).toBe(false);
  });

  it("scopes pipeline journeys by decline partner before any user-level follow-up read", async () => {
    const { admin, calls } = fakeAdmin({
      decline_recovery_journeys: [{
        id: "journey-1",
        user_id: "user-1",
        started_at: "2026-09-01T09:00:00.000Z",
        completed_at: null,
        updated_at: "2026-09-05T09:00:00.000Z",
        stage: "rebuilding",
        readiness_snapshot: "getting_closer",
        next_reassessment_at: "2026-09-20T09:00:00.000Z",
        last_reassessed_at: null,
        intake_session_id: "intake-1",
        decline_intake_sessions: { partner_id: "partner-a" },
      }],
      journey_state: [{
        user_id: "user-1",
        stage: "waiting",
        active_mission_id: null,
        next_reassessment_at: "2026-09-20T09:00:00.000Z",
        last_reassessed_at: null,
        last_readiness_band: "amber",
      }],
      user_missions: [{
        id: "mission-1",
        user_id: "user-1",
        state: "in_review",
        started_at: "2026-09-02T09:00:00.000Z",
        completed_at: null,
        next_review_at: "2026-09-20T09:00:00.000Z",
      }],
      action_attempts: [{
        user_id: "user-1",
        mission_instance_id: "mission-1",
        status: "submitted",
        started_at: "2026-09-02T09:05:00.000Z",
        next_review_at: "2026-09-20T09:00:00.000Z",
        verified_at: null,
      }],
      return_attempts: [{
        user_id: "user-1",
        recovery_journey_id: "journey-1",
        partner_id: "partner-a",
        customer_choice: "continue",
        outcome: "redirected",
        suppression_reason: null,
        created_at: "2026-09-05T09:00:00.000Z",
      }],
    });

    const result = await readPartnerPipelineSources(admin, "partner-a");

    expect(result.journeys).toHaveLength(1);
    expect(selectFor(calls, "decline_recovery_journeys")).toBe([
      "id",
      "user_id",
      "started_at",
      "completed_at",
      "updated_at",
      "stage",
      "readiness_snapshot",
      "next_reassessment_at",
      "last_reassessed_at",
      "intake_session_id",
      "decline_intake_sessions!inner(partner_id)",
    ].join(","));
    expect(callsFor(calls, "decline_recovery_journeys", "eq").map((call) => call.args)).toEqual(
      expect.arrayContaining([
        ["origin", "partner"],
        ["decline_intake_sessions.partner_id", "partner-a"],
      ]),
    );

    for (const table of ["journey_state", "user_missions", "action_attempts"]) {
      expect(callsFor(calls, table, "in").map((call) => call.args)).toContainEqual([
        "user_id",
        ["user-1"],
      ]);
    }
    expect(callsFor(calls, "return_attempts", "eq").map((call) => call.args)).toContainEqual([
      "partner_id",
      "partner-a",
    ]);
    expect(callsFor(calls, "return_attempts", "in").map((call) => call.args)).toContainEqual([
      "recovery_journey_id",
      ["journey-1"],
    ]);
  });

  it("does not issue broad user-level reads when a selected partner has no journeys", async () => {
    const { admin, calls } = fakeAdmin({ decline_recovery_journeys: [] });

    const result = await readPartnerPipelineSources(admin, "partner-empty");

    expect(result).toEqual({
      journeys: [],
      journeyStates: [],
      missions: [],
      actionAttempts: [],
      returnAttempts: [],
    });
    for (const table of ["journey_state", "user_missions", "action_attempts", "return_attempts"]) {
      expect(calls.some((call) => call.table === table)).toBe(false);
    }
  });

  it("scopes recovery analytics to the selected decline partner and keeps failed action telemetry unavailable", async () => {
    const { admin, calls } = fakeAdmin({
      decline_intake_sessions: [{
        partner_id: "partner-a",
        created_at: "2026-09-01T09:00:00.000Z",
        consumed_at: "2026-09-01T09:05:00.000Z",
        decline_partners: { display_name: "Alpha Bank" },
      }],
      decline_recovery_journeys: [{
        id: "journey-1",
        user_id: "user-1",
        started_at: "2026-09-01T09:05:00.000Z",
        last_reassessed_at: null,
        readiness_snapshot: "getting_closer",
        decline_intake_sessions: { partner_id: "partner-a" },
      }],
      return_attempts: [],
    }, {
      user_missions: new Error("action telemetry unavailable"),
    });

    const result = await readPartnerRecoveryAnalyticsInput(
      admin,
      "partner-a",
      "2026-08-08T00:00:00.000Z",
    );

    expect(result.actionStarts).toBeNull();
    expect(callsFor(calls, "decline_intake_sessions", "eq").map((call) => call.args)).toContainEqual([
      "partner_id",
      "partner-a",
    ]);
    expect(callsFor(calls, "decline_recovery_journeys", "eq").map((call) => call.args)).toContainEqual([
      "decline_intake_sessions.partner_id",
      "partner-a",
    ]);
    expect(callsFor(calls, "return_attempts", "eq").map((call) => call.args)).toContainEqual([
      "partner_id",
      "partner-a",
    ]);
    expect(callsFor(calls, "user_missions", "in").map((call) => call.args)).toContainEqual([
      "user_id",
      ["user-1"],
    ]);
  });

  it("uses the same partner-scoped evidence for cohort inputs", async () => {
    const { admin, calls } = fakeAdmin({
      decline_intake_sessions: [],
      decline_recovery_journeys: [],
      return_attempts: [],
    });

    await readPartnerCohortSources(admin, "partner-a", "2026-08-08T00:00:00.000Z");

    expect(callsFor(calls, "decline_intake_sessions", "eq").map((call) => call.args)).toContainEqual([
      "partner_id",
      "partner-a",
    ]);
    expect(callsFor(calls, "decline_recovery_journeys", "eq").map((call) => call.args)).toContainEqual([
      "decline_intake_sessions.partner_id",
      "partner-a",
    ]);
  });

  it("reads only controlled pilot-status gates and never selects return destinations or callbacks", async () => {
    const { admin, calls } = fakeAdmin({
      decline_partners: [{
        id: "partner-a",
        partner_key: "alpha",
        display_name: "Alpha Bank",
        enabled: true,
        sandbox_enabled: true,
        live_enabled: false,
      }],
      feature_flags: [
        { flag_key: "partner_decline_intake_enabled", enabled: false },
        { flag_key: "return_to_origin_enabled", enabled: false },
      ],
      return_contracts: [{
        id: "contract-1",
        environment: "sandbox",
        product_category: "credit_card",
        disclosure_key: "return-disclosure",
        disclosure_version: 1,
        callback_policy: "none",
        enabled: false,
        expires_at: "2026-12-31T00:00:00.000Z",
      }],
      commercial_disclosures: [{
        disclosure_key: "return-disclosure",
        version: 1,
        status: "published",
        published_at: "2026-09-01T00:00:00.000Z",
      }],
    });

    const result = await readPartnerPilotStatus(admin, "partner-a");

    expect(result.partner?.id).toBe("partner-a");
    expect(callsFor(calls, "feature_flags", "in").map((call) => call.args)).toContainEqual([
      "flag_key",
      [
        "partner_decline_intake_enabled",
        "return_to_origin_enabled",
        "commercial_gateway_enabled",
        "commercial_sandbox_enabled",
        "email_reminders_enabled",
      ],
    ]);
    expect(selectFor(calls, "return_contracts")).toBe(
      "id,environment,product_category,disclosure_key,disclosure_version,callback_policy,enabled,expires_at",
    );
    expect(selectFor(calls, "return_contracts")).not.toMatch(/destination_url|callback_url/);
    expect(callsFor(calls, "return_contracts", "eq").map((call) => call.args)).toContainEqual([
      "partner_id",
      "partner-a",
    ]);
  });
});
