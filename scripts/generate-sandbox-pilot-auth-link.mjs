import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { pathToFileURL } from "node:url";

const PILOT_USER_ID = "ca79d264-e2f1-4467-b655-eb7a66a289fa";
const PILOT_EMAIL = "cq-internal-pilot-3dbb2ff3@example.com";
const SITE_ORIGIN = "https://credit-quest-app.vercel.app";
const SUPABASE_URL = "https://kcgghgziyfcamrxkudwe.supabase.co";
const HANDOFF_TOKEN = /^[A-Za-z0-9_-]{43}$/;

export async function generatePilotAuthLink({
  createClient = createSupabaseClient,
  env = process.env,
  handoffToken,
}) {
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase service environment is required");
  }
  if (supabaseUrl !== SUPABASE_URL) {
    throw new Error("Credit Quest Supabase project is required");
  }
  if (!HANDOFF_TOKEN.test(handoffToken ?? "")) {
    throw new Error("Valid sandbox handoff token is required");
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const { data: userData, error: userError } =
    await admin.auth.admin.getUserById(PILOT_USER_ID);
  if (userError) throw userError;

  const user = userData.user;
  if (user?.id !== PILOT_USER_ID) {
    throw new Error("Sandbox pilot identity mismatch");
  }
  if (user.email !== PILOT_EMAIL) {
    throw new Error("Synthetic pilot email mismatch");
  }
  if (user.app_metadata?.credit_quest_sandbox_pilot !== true) {
    throw new Error("Sandbox pilot identity is not enabled");
  }
  if (user.app_metadata?.credit_quest_internal_test !== true) {
    throw new Error("Internal test identity is required");
  }

  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: PILOT_EMAIL,
  });
  if (error) throw error;

  const tokenHash = data.properties?.hashed_token;
  if (!tokenHash) throw new Error("Pilot auth token was not generated");

  const url = new URL("/auth/confirm", SITE_ORIGIN);
  url.searchParams.set("token_hash", tokenHash);
  url.searchParams.set("type", "magiclink");
  url.searchParams.set("next", `/recovery/handoff/${handoffToken}`);
  return url.toString();
}

async function main() {
  const handoffToken = process.argv[2];
  const link = await generatePilotAuthLink({ handoffToken });
  console.log(link);
}

const entryUrl = process.argv[1]
  ? pathToFileURL(process.argv[1]).href
  : null;

if (entryUrl === import.meta.url) {
  main().catch((error) => {
    console.error(
      error instanceof Error
        ? error.message
        : "Pilot auth link generation failed",
    );
    process.exitCode = 1;
  });
}
