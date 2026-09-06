export function RecoveryFallback() {
  return (
    <section
      aria-label="Your recovery plan"
      className="cq-panel mb-4 rounded-[1.75rem] p-5 text-white"
    >
      <p className="cq-kicker">Your recovery plan</p>
      <h2 className="mt-3 text-2xl font-black tracking-tight text-white">
        We can’t load the detailed recovery view right now.
      </h2>
      <p className="mt-3 text-sm leading-6 text-slate-300">
        Your core Credit Quest information is still available. No lender return will be attempted from this state.
      </p>
    </section>
  );
}
