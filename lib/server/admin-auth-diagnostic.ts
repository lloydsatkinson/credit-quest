export type AdminAuthDiagnosticResult = {
  publicSupabaseEnvPresent: boolean;
  expectedSupabaseProject: boolean;
  serviceCredentialPresent: boolean;
  serviceAdminTableProbe: "ok" | "error" | "not_run";
  serverSession: "present" | "missing" | "error";
  adminMembershipLookup: "admin" | "not_admin" | "error" | "not_run";
};

type AdminIdentity = { id: string };

type AdminAuthDiagnosticDeps = {
  expectedProjectHost: string;
  publicEnvUrl: string | null;
  serviceCredentialPresent: boolean;
  probeServiceAdminTable(): Promise<boolean>;
  getAuthenticatedUser(): Promise<AdminIdentity | null>;
  getAdminMembership(userId: string): Promise<boolean>;
};

function matchesExpectedProject(url: string | null, expectedProjectHost: string): boolean {
  if (!url) return false;
  try {
    return new URL(url).host === expectedProjectHost;
  } catch {
    return false;
  }
}

export async function runAdminAuthDiagnostic(
  deps: AdminAuthDiagnosticDeps,
): Promise<AdminAuthDiagnosticResult> {
  const result: AdminAuthDiagnosticResult = {
    publicSupabaseEnvPresent: Boolean(deps.publicEnvUrl),
    expectedSupabaseProject: matchesExpectedProject(deps.publicEnvUrl, deps.expectedProjectHost),
    serviceCredentialPresent: deps.serviceCredentialPresent,
    serviceAdminTableProbe: "not_run",
    serverSession: "missing",
    adminMembershipLookup: "not_run",
  };

  if (deps.serviceCredentialPresent) {
    try {
      result.serviceAdminTableProbe = await deps.probeServiceAdminTable() ? "ok" : "error";
    } catch {
      result.serviceAdminTableProbe = "error";
    }
  }

  let user: AdminIdentity | null = null;
  try {
    user = await deps.getAuthenticatedUser();
    result.serverSession = user?.id ? "present" : "missing";
  } catch {
    result.serverSession = "error";
  }

  if (!user?.id) return result;

  try {
    result.adminMembershipLookup = await deps.getAdminMembership(user.id) ? "admin" : "not_admin";
  } catch {
    result.adminMembershipLookup = "error";
  }

  return result;
}
