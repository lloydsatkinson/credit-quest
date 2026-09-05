import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export const SANDBOX_PILOT_METADATA_KEY = "credit_quest_sandbox_pilot";

export async function isSandboxPilot(admin: SupabaseClient, userId: string): Promise<boolean> {
  try {
    const { data, error } = await admin.auth.admin.getUserById(userId);
    if (error || !data.user) return false;
    return data.user.app_metadata?.[SANDBOX_PILOT_METADATA_KEY] === true;
  } catch {
    return false;
  }
}

export async function setSandboxPilot(
  admin: SupabaseClient,
  adminUserId: string,
  targetUserId: string,
  enabled: boolean,
): Promise<void> {
  const { data, error } = await admin.auth.admin.getUserById(targetUserId);
  if (error) throw error;
  if (!data.user) throw new Error("Pilot user not found");

  const existingMetadata = data.user.app_metadata ?? {};
  const { error: updateError } = await admin.auth.admin.updateUserById(targetUserId, {
    app_metadata: {
      ...existingMetadata,
      [SANDBOX_PILOT_METADATA_KEY]: enabled,
    },
  });
  if (updateError) throw updateError;

  const { error: auditError } = await admin.from("admin_audit_log").insert({
    admin_user_id: adminUserId,
    action: "set_sandbox_pilot",
    entity_type: "auth_user",
    entity_id: targetUserId,
    metadata: { enabled },
  });

  if (auditError) {
    const { error: rollbackError } = await admin.auth.admin.updateUserById(targetUserId, {
      app_metadata: existingMetadata,
    });
    if (rollbackError) {
      throw new Error("Sandbox pilot audit failed and metadata rollback also failed");
    }
    throw auditError;
  }
}

export async function generateSandboxPilotAuthLink(
  admin: SupabaseClient,
  targetUserId: string,
  siteOrigin: string,
  nextPath: string,
): Promise<string> {
  const { data: userData, error: userError } = await admin.auth.admin.getUserById(targetUserId);
  if (userError) throw userError;
  if (!userData.user?.email) throw new Error("Pilot user email not found");

  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: userData.user.email,
  });
  if (error) throw error;

  const tokenHash = data.properties?.hashed_token;
  if (!tokenHash) throw new Error("Pilot auth token was not generated");

  const url = new URL("/auth/confirm", siteOrigin);
  url.searchParams.set("token_hash", tokenHash);
  url.searchParams.set("type", "magiclink");
  url.searchParams.set("next", nextPath);
  return url.toString();
}
