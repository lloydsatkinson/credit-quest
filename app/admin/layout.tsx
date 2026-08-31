import { redirect } from "next/navigation";
import { AdminNav } from "@/components/admin/admin-nav";
import { requireAdminUser } from "@/lib/server/admin-auth";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  try {
    await requireAdminUser();
  } catch {
    redirect("/dashboard");
  }

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-5 py-8 sm:py-12">
      <div className="mb-6">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-700">Credit Quest Admin</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">Control plane</h1>
      </div>
      <div role="status" className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-900">
        Live credit referrals are locked pending regulatory clearance.
      </div>
      <AdminNav />
      <div className="mt-8">{children}</div>
    </main>
  );
}
