import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { PartnerAuthError, resolvePartnerSecret } from "@/lib/server/partner-auth";

const VAULT_REFERENCE = /^vault:([A-Za-z0-9][A-Za-z0-9._:-]{2,159})$/;

function assertUsableSecret(secret: unknown): string {
  if (typeof secret !== "string" || secret.length < 32) {
    throw new PartnerAuthError();
  }
  return secret;
}

export async function resolvePartnerSecretReference(
  admin: SupabaseClient,
  secretReference: string,
): Promise<string> {
  if (!secretReference.startsWith("vault:")) {
    return resolvePartnerSecret(secretReference);
  }

  const match = VAULT_REFERENCE.exec(secretReference);
  if (!match) throw new PartnerAuthError();

  const { data, error } = await admin.rpc("get_partner_secret_from_vault", {
    p_secret_name: match[1],
  });
  if (error) throw new PartnerAuthError();

  return assertUsableSecret(data);
}
