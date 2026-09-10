import "server-only";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export class LenderAccessError extends Error {
  constructor() {
    super("Lender access required");
    this.name = "LenderAccessError";
  }
}

export interface LenderIdentity {
  userId: string;
  partnerId: string;
  pilotIds: string[];
}

export interface LenderMembership {
  userId: string;
  partnerId: string;
  pilotId: string;
  enabled: boolean;
}

export interface LenderAuthorizerDeps {
  getAuthenticatedUser(): Promise<{ id: string } | null>;
  getLenderMemberships(userId: string): Promise<LenderMembership[]>;
}

export function createLenderAuthorizer(deps: LenderAuthorizerDeps) {
  return async function authorizeLender(): Promise<LenderIdentity> {
    let user: { id: string } | null;
    try {
      user = await deps.getAuthenticatedUser();
    } catch {
      throw new LenderAccessError();
    }
    if (!user?.id) throw new LenderAccessError();

    let memberships: LenderMembership[];
    try {
      memberships = await deps.getLenderMemberships(user.id);
    } catch {
      throw new LenderAccessError();
    }

    if (memberships.some((membership) => membership.userId !== user.id)) {
      throw new LenderAccessError();
    }
    const enabled = memberships.filter((membership) => membership.enabled && membership.pilotId && membership.partnerId);
    if (enabled.length === 0) throw new LenderAccessError();

    const partnerIds = [...new Set(enabled.map((membership) => membership.partnerId))];
    if (partnerIds.length !== 1) throw new LenderAccessError();

    const pilotIds = [...new Set(enabled.map((membership) => membership.pilotId))].sort();
    if (pilotIds.length === 0) throw new LenderAccessError();

    return { userId: user.id, partnerId: partnerIds[0], pilotIds };
  };
}

async function getAuthenticatedUser(): Promise<{ id: string } | null> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return { id: data.user.id };
}

async function getLenderMemberships(userId: string): Promise<LenderMembership[]> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("lender_portal_members")
    .select("user_id,partner_id,pilot_id,enabled")
    .eq("user_id", userId);
  if (error) throw error;

  return (data ?? []).map((row) => ({
    userId: String(row.user_id),
    partnerId: String(row.partner_id),
    pilotId: String(row.pilot_id),
    enabled: row.enabled === true,
  }));
}

export const requireLenderUser = createLenderAuthorizer({
  getAuthenticatedUser,
  getLenderMemberships,
});
