import "server-only";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export class AdminAccessError extends Error {
  constructor() {
    super("Admin access required");
    this.name = "AdminAccessError";
  }
}

export interface AdminIdentity {
  id: string;
}

interface AdminMembership {
  userId: string;
  role: "admin";
}

interface AdminAuthorizerDeps {
  getAuthenticatedUser(): Promise<AdminIdentity | null>;
  getAdminMembership(userId: string): Promise<AdminMembership | null>;
}

export function createAdminAuthorizer(deps: AdminAuthorizerDeps) {
  return async function authorizeAdmin(): Promise<AdminIdentity> {
    let user: AdminIdentity | null = null;
    try {
      user = await deps.getAuthenticatedUser();
    } catch {
      throw new AdminAccessError();
    }

    if (!user?.id) throw new AdminAccessError();

    try {
      const membership = await deps.getAdminMembership(user.id);
      if (!membership || membership.userId !== user.id || membership.role !== "admin") {
        throw new AdminAccessError();
      }
      return user;
    } catch (error) {
      if (error instanceof AdminAccessError) throw error;
      throw new AdminAccessError();
    }
  };
}

async function getAuthenticatedUser(): Promise<AdminIdentity | null> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return { id: data.user.id };
}

async function getAdminMembership(userId: string): Promise<AdminMembership | null> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("admin_members")
    .select("user_id,role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { userId: String(data.user_id), role: "admin" };
}

export const requireAdminUser = createAdminAuthorizer({
  getAuthenticatedUser,
  getAdminMembership,
});
