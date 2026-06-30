"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Item = { href: string; label: string; icon: React.ReactNode; ready: boolean };

const items: Item[] = [
  {
    href: "/dashboard",
    label: "Дашборд",
    ready: true,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-[22px] w-[22px]">
        <path d="M3 11l9-8 9 8M5 10v10h14V10" />
      </svg>
    ),
  },
  {
    href: "/checkin",
    label: "Чек-ин",
    ready: true,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-[22px] w-[22px]">
        <path d="M9 11l3 3L22 4" />
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
      </svg>
    ),
  },
  {
    href: "/training",
    label: "Тренировки",
    ready: true,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-[22px] w-[22px]">
        <path d="M6.5 6.5h11M6.5 17.5h11M4 9v6M20 9v6M9 12h6" />
      </svg>
    ),
  },
  {
    href: "/habits",
    label: "Привычки",
    ready: true,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-[22px] w-[22px]">
        <path d="M9 11l3 3 8-8" />
        <path d="M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9" />
      </svg>
    ),
  },
  {
    href: "/medical",
    label: "Медкнижка",
    ready: true,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-[22px] w-[22px]">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <line x1="12" y1="8" x2="12" y2="16" />
        <line x1="8" y1="12" x2="16" y2="12" />
      </svg>
    ),
  },
];

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="sticky bottom-0 z-10 flex border-t border-line bg-surface px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2">
      {items.map((it) => {
        const activeTab = pathname === it.href;
        const className =
          "flex flex-1 flex-col items-center gap-1 py-1.5 text-[11px] font-medium transition";
        const content = (
          <>
            {it.icon}
            {it.label}
          </>
        );
        if (!it.ready) {
          return (
            <span key={it.href} className={`${className} text-ink-3/50`} aria-disabled>
              {content}
            </span>
          );
        }
        return (
          <Link
            key={it.href}
            href={it.href}
            className={`${className} ${activeTab ? "text-phase" : "text-ink-3"}`}
          >
            {content}
          </Link>
        );
      })}
    </nav>
  );
}
