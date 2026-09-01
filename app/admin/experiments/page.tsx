import { ExperimentForm } from "@/components/admin/experiment-form";
import { requireAdminUser } from "@/lib/server/admin-auth";
import { listExperiments } from "@/lib/server/admin-repository";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export default async function AdminExperimentsPage() {
  await requireAdminUser();
  const experiments = await listExperiments(createAdminSupabaseClient());
  return (
    <section className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
      <ExperimentForm />
      <div className="space-y-3">
        <div><h2 className="text-xl font-black">Experiments</h2><p className="mt-1 text-sm text-slate-600">Presentation only. Eligibility and strategy are not experiment surfaces.</p></div>
        {experiments.map((experiment) => (
          <article key={String(experiment.id)} className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="font-black">{String(experiment.experiment_key)}</p>
            <p className="text-sm text-slate-500">{String(experiment.surface_key)} · {String(experiment.status)}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
