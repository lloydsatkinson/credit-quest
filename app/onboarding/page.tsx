import { CustomerShell } from "@/components/customer/customer-shell";
import { OnboardingForm } from "@/components/onboarding/onboarding-form";

export default function OnboardingPage() {
  return (
    <CustomerShell showNav={false}>
      <main
        data-testid="onboarding-shell"
        className="onboarding-shell mx-auto min-h-screen max-w-3xl px-5 pb-10 pt-7 sm:px-8 sm:py-10"
      >
        <div className="mb-5 flex items-center justify-between gap-4">
          <div>
            <p className="cq-kicker">Build your plan</p>
            <p className="mt-1 text-xs font-bold text-slate-500">Only answer what you know.</p>
          </div>
          <span className="rounded-full border border-cyan-300/15 bg-cyan-300/[0.055] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-cyan-200">
            Private by design
          </span>
        </div>

        <section className="cq-panel relative overflow-hidden rounded-[2rem] px-6 py-7 sm:px-8 sm:py-9">
          <div className="absolute -right-24 -top-24 size-64 rounded-full bg-cyan-300/[0.07] blur-3xl" aria-hidden="true" />
          <div className="absolute -bottom-28 -left-20 size-60 rounded-full bg-fuchsia-400/[0.055] blur-3xl" aria-hidden="true" />
          <div className="relative">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-lime-300/20 bg-lime-300/10 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-lime-300">
                Your starting point
              </span>
              <span className="text-xs font-bold text-slate-500">About 2 minutes</span>
            </div>
            <p className="mt-5 text-sm font-black uppercase tracking-[0.18em] text-cyan-200">8 quick questions</p>
            <h1 className="mt-2 text-4xl font-black tracking-[-0.045em] text-white sm:text-5xl">One clear next move.</h1>
            <p className="mt-3 max-w-xl text-lg font-semibold leading-7 text-slate-200">
              We only ask what changes your plan.
            </p>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
              No score theatre, no hidden assumptions. If you do not know an answer, say so — Credit Quest would rather work with an unknown than invent certainty.
            </p>

            <div className="mt-7 grid gap-3 sm:grid-cols-3">
              {[
                ["01", "Answer what you know", "Unknown stays unknown"],
                ["02", "We explain the signal", "No lender folklore"],
                ["03", "Get one next move", "Then we reassess"],
              ].map(([number, label, copy]) => (
                <div key={number} className="rounded-2xl border border-white/8 bg-white/[0.035] p-4">
                  <p className="text-xs font-black text-cyan-300">{number}</p>
                  <p className="mt-2 text-sm font-black text-white">{label}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">{copy}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <div className="mt-5 sm:mt-6">
          <OnboardingForm />
        </div>

        <p className="mx-auto mt-5 max-w-xl text-center text-xs leading-5 text-slate-500">
          Your answers generate explainable Credit Quest guidance. Product referrals remain separate from the logic that chooses your next action.
        </p>
      </main>
    </CustomerShell>
  );
}
