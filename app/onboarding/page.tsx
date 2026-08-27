import Link from "next/link";
import { OnboardingForm } from "@/components/onboarding/onboarding-form";

export default function OnboardingPage() {
  return (
    <main
      data-testid="onboarding-shell"
      className="onboarding-shell mx-auto min-h-screen max-w-3xl px-5 py-6 sm:px-8 sm:py-10"
    >
      <header className="flex items-center justify-between gap-4">
        <Link href="/" className="text-lg font-black tracking-tight text-violet-700">
          Credit Quest
        </Link>
        <span className="rounded-full border border-violet-200 bg-white/80 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.18em] text-violet-700 shadow-sm backdrop-blur">
          Private by design
        </span>
      </header>

      <section className="mt-8 overflow-hidden rounded-[2rem] bg-slate-950 px-6 py-7 text-white shadow-2xl shadow-violet-200/50 sm:px-8 sm:py-9">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-violet-500/20 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-violet-200">
            Build your plan
          </span>
          <span className="text-xs font-bold text-slate-400">About 2 minutes</span>
        </div>
        <h1 className="mt-5 text-4xl font-black tracking-[-0.04em] sm:text-5xl">8 quick questions</h1>
        <p className="mt-3 max-w-xl text-lg font-semibold leading-7 text-slate-200">
          We only ask what changes your plan.
        </p>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
          No score theatre, no hidden assumptions. If you do not know an answer, say so — Credit Quest would rather work with an unknown than invent certainty.
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {[
            ["01", "Answer what you know"],
            ["02", "We explain why it matters"],
            ["03", "Get one next best move"],
          ].map(([number, label]) => (
            <div key={number} className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs font-black text-violet-300">{number}</p>
              <p className="mt-2 text-sm font-bold text-white">{label}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="mt-5 sm:mt-6">
        <OnboardingForm />
      </div>

      <p className="mx-auto mt-5 max-w-xl text-center text-xs leading-5 text-slate-500">
        Your answers are used to generate explainable Credit Quest guidance. Product referrals remain separate from the logic that chooses your next action.
      </p>
    </main>
  );
}
