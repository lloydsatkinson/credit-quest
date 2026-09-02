import { notFound, redirect } from "next/navigation";
import { ActionScreen } from "@/components/actions/action-screen";
import { CustomerShell } from "@/components/customer/customer-shell";
import { resolveOwnedMissionAction } from "@/lib/server/action-service";
import { getSupabasePublicEnv } from "@/lib/supabase/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function accountLabel(account: {
  providerName?: string | null;
  nickname: string | null;
  lastFour: string | null;
} | null): string | null {
  if (!account) return null;
  const parts = [account.providerName, account.nickname, account.lastFour ? `ending ${account.lastFour}` : null].filter(Boolean);
  return parts.length ? parts.join(" · ") : "Your credit account";
}

export default async function ActionPage({
  params,
}: {
  params: Promise<{ missionInstanceId: string }>;
}) {
  if (!getSupabasePublicEnv()) redirect("/dashboard");

  const { missionInstanceId } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/actions/${missionInstanceId}`)}`);

  const result = await resolveOwnedMissionAction(supabase, user.id, missionInstanceId).catch(() => null);
  if (!result || !result.ok) notFound();

  return (
    <CustomerShell active="quest">
      <ActionScreen
        missionTitle={result.context.mission.title}
        rationale={result.context.mission.rationale}
        resolvedAction={result.context.resolvedAction}
        missionInstanceId={result.context.instance.id}
        targetLabel={accountLabel(result.context.account)}
      />
    </CustomerShell>
  );
}
