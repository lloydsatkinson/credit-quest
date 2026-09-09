import Link from "next/link";
import { redirect } from "next/navigation";
import { getLenderPilotContext } from "@/lib/server/lender-analytics-repository";
import { requireLenderUser } from "@/lib/server/lender-auth";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const nav = [
  ["Overview", "/lender"],
  ["Decline Intelligence", "/lender/declines"],
  ["Cohorts", "/lender/cohorts"],
  ["Return Outcomes", "/lender/returns"],
] as const;

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(date)
    : "Unknown date";
}

export default async function LenderLayout({ children }: { children: React.ReactNode }) {
  let identity;
  let pilots;
  try {
    identity = await requireLenderUser();
    pilots = await getLenderPilotContext(createAdminSupabaseClient(), identity);
  } catch {
    redirect("/dashboard");
  }

  const primaryPilot = pilots[0] ?? null;
  const pilotBadge = primaryPilot?.pilotType === "synthetic"
    ? "Synthetic"
    : primaryPilot?.pilotType === "live"
      ? "Live"
      : "Sandbox";

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-5 py-8 sm:py-12">
      <header className="mb-7">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-700">Credit Quest lender pilot</p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-slate-950">Recovery intelligence</h1>
            <p className="mt-1 text-sm font-medium text-slate-600">Read-only aggregate reporting for your authorised Credit Quest pilot.</p>
          </div>
          <span className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-black uppercase tracking-wide text-violet-800">
            {pilotBadge}
          </span>
        </div>
        {primaryPilot ? (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">
            <span className="font-black text-slate-950">{primaryPilot.displayName}</span>
            <span className="mx-2">·</span>
            <span>{formatDate(primaryPilot.startsAt)} – {primaryPilot.endsAt ? formatDate(primaryPilot.endsAt) : "Ongoing"}</span>
            {pilots.length > 1 ? <span className="ml-2 text-slate-500">+ {pilots.length - 1} authorised cohort{pilots.length === 2 ? "" : "s"}</span> : null}
          </div>
        ) : (
          <div role="status" className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900">
            Pilot context is currently unavailable.
          </div>
        )}
      </header>

      <nav aria-label="Lender pilot" className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
        {nav.map(([label, href]) => (
          <Link key={href} href={href} className="rounded-xl px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-100 hover:text-slate-950">
            {label}
          </Link>
        ))}
      </nav>

      <div className="mt-8">{children}</div>
    </main>
  );
}
