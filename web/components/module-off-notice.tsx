import Link from "next/link";

// Раздел выключен в профиле («Что отслеживаю»), но открыт по прямой ссылке.
export function ModuleOffNotice({ title }: { title: string }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3 rounded-card border border-line bg-surface-2 px-4 py-3">
      <p className="font-sans text-[13px] text-ink-2">Раздел «{title}» выключен — его нет в меню и на «Сегодня».</p>
      <Link href="/profile" className="flex min-h-[44px] shrink-0 items-center font-mono text-[12px] text-ink-2 underline underline-offset-2">
        включить
      </Link>
    </div>
  );
}
