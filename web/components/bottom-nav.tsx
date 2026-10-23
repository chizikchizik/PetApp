"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Item = { href: string; label: string; icon: React.ReactNode; match: (path: string) => boolean };

const iconProps = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  className: "h-[22px] w-[22px]",
  "aria-hidden": true,
};

// Четыре вкладки = три фокусных раздела + «Сегодня». Редкие разделы
// (цикл, кольцо, импорт, давление) открываются из профиля. /checkin/meds —
// график приёма препаратов, по смыслу это часть «Мигрени».
const items: Item[] = [
  {
    href: "/dashboard",
    label: "Сегодня",
    match: (p) => p === "/dashboard" || (p.startsWith("/checkin") && !p.startsWith("/checkin/meds")),
    icon: (
      <svg {...iconProps}>
        <path d="M3 11l9-8 9 8M5 10v10h14V10" />
      </svg>
    ),
  },
  {
    href: "/insights",
    label: "Мигрень",
    match: (p) => p.startsWith("/insights") || p.startsWith("/checkin/meds"),
    icon: (
      <svg {...iconProps}>
        <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8z" />
      </svg>
    ),
  },
  {
    href: "/training",
    label: "Тренировки",
    match: (p) => p.startsWith("/training"),
    icon: (
      <svg {...iconProps}>
        <path d="M6.5 6.5h11M6.5 17.5h11M4 9v6M20 9v6M9 12h6" />
      </svg>
    ),
  },
  {
    href: "/weight",
    label: "Вес",
    match: (p) => p.startsWith("/weight"),
    icon: (
      <svg {...iconProps}>
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M8 9a5 5 0 0 1 8 0M12 9l1.5-2" />
      </svg>
    ),
  },
];

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="sticky bottom-0 z-10 flex border-t border-line bg-surface px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2">
      {items.map((it) => {
        const active = it.match(pathname);
        return (
          <Link
            key={it.href}
            href={it.href}
            aria-current={active ? "page" : undefined}
            className={`flex min-h-[44px] flex-1 flex-col items-center gap-1 py-1.5 text-[11px] font-medium transition ${active ? "text-phase" : "text-ink-3"}`}
          >
            {it.icon}
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}
