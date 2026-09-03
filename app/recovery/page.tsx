import { CustomerShell } from "@/components/customer/customer-shell";
import { DirectDeclineForm } from "@/components/recovery/direct-decline-form";

export default function RecoveryPage() {
  return (
    <CustomerShell active="quest">
      <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
        <section className="mb-6">
          <div className="mb-3 inline-flex rounded-full border border-fuchsia-300/20 bg-fuchsia-300/[0.05] px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-fuchsia-200">
            Decline recovery
          </div>
          <h1 className="max-w-2xl text-3xl font-black tracking-[-0.04em] text-white sm:text-4xl">
            I’ve just been declined
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-slate-400">
            Credit Quest can help you understand what to work on next. Tell us only what you actually know — we won’t invent a lender reason or treat a decline as a diagnosis.
          </p>
        </section>

        <DirectDeclineForm />
      </main>
    </CustomerShell>
  );
}
