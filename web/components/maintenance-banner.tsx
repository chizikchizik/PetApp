// Разовое уведомление про технические работы 2 июля 2026 — само скрывается
// после дедлайна, ничего вручную убирать не нужно.
// ВАЖНО: сравниваем с реальным epoch (Date.now()), не с nowMoscow() — та
// возвращает Date.now()+3ч для чтения через UTC-геттеры, а не настоящее
// время; сравнение .getTime() с ней сдвинуло бы порог на 3 часа раньше.
const MAINTENANCE_UNTIL = new Date("2026-07-02T18:00:00+03:00");
const TELEGRAM_HANDLE = "@MToldinova";

export function MaintenanceBanner() {
  if (Date.now() >= MAINTENANCE_UNTIL.getTime()) return null;

  return (
    <div className="mb-3 rounded-card border border-warn bg-warn-soft px-3.5 py-2.5 font-sans text-[12px] leading-relaxed text-ink-2">
      <span className="font-semibold text-warn">На сервере технические работы до 18:00.</span>{" "}
      Если что-то не работает — напишите в Telegram: {" "}
      <a
        href={`https://t.me/${TELEGRAM_HANDLE.slice(1)}`}
        className="font-semibold text-warn underline underline-offset-2"
      >
        {TELEGRAM_HANDLE}
      </a>
    </div>
  );
}
