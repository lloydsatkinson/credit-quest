import Link from "next/link";
import { CustomerShell } from "@/components/customer/customer-shell";

export default function SandboxReferralCompletePage() {
  return (
    <CustomerShell>
      <main className="mx-auto min-h-screen max-w-2xl px-5 py-10 sm:py-14">
        <section className="cq-panel relative overflow-hidden rounded-[2rem] p-7 sm:p-9">
          <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-20 size-56 rounded-full bg-cyan-300/10 blur-3xl" />
          <div aria-hidden="true" className="pointer-events-none absolute -bottom-24 -left-20 size-56 rounded-full bg-lime-300/8 blur-3xl" />

          <div className="relative">
            <div className="flex items-center justify-between gap-3">
              <p className="cq-kicker">Credit Quest sandbox</p>
              <span className="rounded-full border border-lime-300/20 bg-lime-300/[0.07] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.15em] text-lime-300">
                Simulation only
              </span>
            </div>

            <div className="mt-8 flex size-16 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.07] text-3xl text-cyan-200 shadow-[0_0_40px_rgba(34,211,238,0.08)]" aria-hidden="true">
              ✓
            </div>

            <h1 className="mt-6 text-4xl font-black tracking-[-0.045em] text-white sm:text-5xl">
              Sandbox journey complete
            </h1>
            <p className="mt-4 max-w-xl text-lg leading-8 text-slate-300">
              No lender or credit application was contacted. This page only proves Credit Quest’s consent,
              attribution and safety plumbing.
            </p>

            <div className="mt-7 grid gap-3 sm:grid-cols-3">
              {[
                ["Consent", "Captured"],
                ["Attribution", "Recorded"],
                ["Credit impact", "None"],
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl border border-white/8 bg-white/[0.035] p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-500">{label}</p>
                  <p className="mt-2 font-black text-white">{value}</p>
                </div>
              ))}
            </div>

            <p className="mt-7 rounded-2xl border border-lime-300/15 bg-lime-300/[0.045] p-4 text-sm font-semibold leading-6 text-lime-100">
              This was a controlled Credit Quest simulation. It did not submit an application, run a credit search or contact a lender.
            </p>

            <Link
              href="/dashboard"
              className="mt-7 inline-flex rounded-2xl bg-cyan-300 px-5 py-3.5 text-sm font-black text-slate-950 shadow-[0_12px_40px_rgba(34,211,238,0.14)] transition hover:bg-cyan-200"
            >
              Back to Quest Feed
            </Link>
          </div>
        </section>
      </main>
    </CustomerShell>
  );
}
