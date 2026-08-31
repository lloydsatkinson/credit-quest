import Link from "next/link";

const links = [
  ["Overview", "/admin"],
  ["Partners", "/admin/partners"],
  ["Routes", "/admin/routes"],
  ["Disclosures", "/admin/disclosures"],
  ["Flags", "/admin/flags"],
  ["Experiments", "/admin/experiments"],
  ["Audit", "/admin/audit"],
] as const;

export function AdminNav() {
  return (
    <nav className="flex flex-wrap gap-2" aria-label="Credit Quest admin">
      {links.map(([label, href]) => (
        <Link key={href} href={href} className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">
          {label}
        </Link>
      ))}
    </nav>
  );
}
