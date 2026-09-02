import Link from "next/link";
import type { ReactNode } from "react";

export type CustomerNavKey = "quest" | "passport" | "readiness" | "learn" | "profile";

const navItems: Array<{
  key: CustomerNavKey;
  href: string;
  label: string;
  icon: ReactNode;
}> = [
  {
    key: "quest",
    href: "/dashboard",
    label: "Quest",
    icon: <path d="M4 12 12 4l8 8-8 8-8-8Zm8-3.5v7M8.5 12H15.5" />,
  },
  {
    key: "passport",
    href: "/passport",
    label: "Passport",
    icon: <path d="M6 3.5h9.5A2.5 2.5 0 0 1 18 6v14.5H8.5A2.5 2.5 0 0 1 6 18V3.5Zm0 13.5h9M10 8h4M10 11h4" />,
  },
  {
    key: "readiness",
    href: "/readiness",
    label: "Ready",
    icon: <path d="M12 3.5 14.7 9l5.8.8-4.2 4.1 1 5.8L12 17l-5.3 2.7 1-5.8-4.2-4.1L9.3 9 12 3.5Z" />,
  },
  {
    key: "learn",
    href: "/learn",
    label: "Learn",
    icon: <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H11v15H6.5A2.5 2.5 0 0 0 4 20.5v-15Zm16 0A2.5 2.5 0 0 0 17.5 3H13v15h4.5a2.5 2.5 0 0 1 2.5 2.5v-15Z" />,
  },
  {
    key: "profile",
    href: "/accounts",
    label: "Profile",
    icon: <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0" />,
  },
];

function BrandMark() {
  return (
    <span className="relative grid size-10 shrink-0 place-items-center overflow-hidden rounded-[0.9rem] border border-cyan-300/30 bg-[#0b1320] text-[11px] font-black tracking-[-0.08em] text-white shadow-[0_0_24px_rgba(31,228,255,0.12)]">
      <span className="absolute inset-x-1 top-1 h-px bg-gradient-to-r from-transparent via-cyan-300 to-transparent" aria-hidden="true" />
      CQ
    </span>
  );
}

export function CustomerShell({
  children,
  active,
  showNav = true,
  showHeader = true,
}: {
  children: ReactNode;
  active?: CustomerNavKey;
  showNav?: boolean;
  showHeader?: boolean;
}) {
  return (
    <div data-testid="customer-shell" className={`cq-customer-shell ${showNav ? "pb-24" : "pb-0"}`}>
      <div className="cq-ambient" aria-hidden="true" />

      {showHeader ? (
        <header className="cq-topbar">
          <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
            <Link href="/dashboard" className="group flex min-w-0 items-center gap-3" aria-label="Credit Quest home">
              <BrandMark />
              <span className="min-w-0">
                <span className="block truncate text-sm font-black uppercase tracking-[0.16em] text-white">Credit Quest</span>
                <span className="mt-0.5 block truncate text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500 group-hover:text-cyan-200">Help first. Fun throughout.</span>
              </span>
            </Link>
            <span className="hidden rounded-full border border-white/10 bg-white/[0.035] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400 sm:inline-flex">
              Your plan · not a lender score
            </span>
          </div>
        </header>
      ) : null}

      <div className="relative z-10">{children}</div>

      {showNav ? (
        <nav className="cq-bottom-nav" aria-label="Credit Quest app navigation">
          <div className="mx-auto grid w-full max-w-md grid-cols-5 gap-1 px-2 py-2">
            {navItems.map((item) => {
              const selected = active === item.key;
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  aria-current={selected ? "page" : undefined}
                  className={`group flex min-w-0 flex-col items-center justify-center gap-1 rounded-2xl px-1 py-2 text-[10px] font-black transition ${selected ? "bg-lime-300/10 text-lime-300" : "text-slate-500 hover:bg-white/5 hover:text-white"}`}
                >
                  <span className={`grid size-7 place-items-center rounded-xl border transition ${selected ? "border-lime-300/30 bg-lime-300/10 shadow-[0_0_18px_rgba(200,255,56,0.12)]" : "border-transparent group-hover:border-white/10"}`}>
                    <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      {item.icon}
                    </svg>
                  </span>
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      ) : null}
    </div>
  );
}
