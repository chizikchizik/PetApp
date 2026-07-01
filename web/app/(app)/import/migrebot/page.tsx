import Link from "next/link";
import { MigreBotImportForm } from "./import-form";
import { getImportLog } from "./actions";

export const dynamic = "force-dynamic";

const MONTHS = ["янв","фев","мар","апр","май","июн","июл","авг","сен","окт","ноя","дек"];

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso + (iso.length === 10 ? "T12:00:00" : ""));
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function fmtDateTime(iso: string) {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}, ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
}

export default async function MigrebotImportPage() {
  const log = await getImportLog();

  return (
    <>
      <Link
        href="/medical"
        className="font-mono text-[10px] tracking-[0.14em] uppercase text-ink-3"
      >
        ← медкнижка
      </Link>
      <h1 className="mt-3 font-serif font-bold text-[23px] uppercase leading-[1.05]">
        Импорт<br />из Migrebot
      </h1>
      <p className="mt-2 font-mono text-[11px] text-ink-2">
        Перенос истории мигреней в ВЕРТУ
      </p>

      <div className="mt-4 rounded-card border border-line bg-surface p-4">
        <p className="font-mono text-[10px] tracking-[0.1em] uppercase text-ink-3">Как экспортировать</p>
        <ul className="mt-2 space-y-1.5 font-sans text-[13px] text-ink-2 leading-snug">
          <li>• В Migrebot напиши <span className="font-mono text-ink">/help</span></li>
          <li>• Нажми кнопку <span className="font-mono text-ink">файл.xlsx</span></li>
          <li>• Выбери <span className="font-mono text-ink">Скачать CSV</span></li>
          <li>• Загрузи файл ниже — ВЕРТА распарсит и сохранит историю</li>
          <li>• Не затронет вес, привычки и другие данные</li>
        </ul>
      </div>

      <MigreBotImportForm />

      {/* Import history */}
      {log.length > 0 && (
        <div className="mt-6">
          <p className="font-mono text-[10px] tracking-[0.14em] uppercase text-ink-3 mb-2">
            История импортов
          </p>
          <div className="space-y-2">
            {log.map((entry) => (
              <div key={entry.id} className="rounded-card border border-line bg-surface p-3.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-sans text-[13px] font-semibold text-ink">
                      {entry.total_rows} дней
                      {entry.migraine_rows != null && (
                        <span className="ml-1.5 font-normal text-phase">
                          · {entry.migraine_rows} с мигренью
                        </span>
                      )}
                    </p>
                    {entry.date_from && entry.date_to && (
                      <p className="mt-0.5 font-mono text-[10px] text-ink-3">
                        {fmtDate(entry.date_from)} — {fmtDate(entry.date_to)}
                      </p>
                    )}
                    {entry.file_name && (
                      <p className="mt-0.5 font-mono text-[9px] text-ink-4 truncate max-w-[220px]">
                        {entry.file_name}
                      </p>
                    )}
                  </div>
                  <span className="shrink-0 font-mono text-[9px] text-ink-4 text-right">
                    {fmtDateTime(entry.imported_at)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
