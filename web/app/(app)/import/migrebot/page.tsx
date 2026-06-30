import Link from "next/link";
import { MigreBotImportForm } from "./import-form";

export const dynamic = "force-dynamic";

export default function MigrebotImportPage() {
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
        <p className="font-mono text-[10px] tracking-[0.1em] uppercase text-ink-3">Как это работает</p>
        <ul className="mt-2 space-y-1.5 font-sans text-[13px] text-ink-2 leading-snug">
          <li>• Открой Migrebot → Настройки → Экспорт данных</li>
          <li>• Выбери формат CSV и скачай файл</li>
          <li>• Загрузи файл ниже — ВЕРТА распарсит и сохранит историю</li>
          <li>• Не затронет вес, привычки и другие данные</li>
        </ul>
      </div>

      <MigreBotImportForm />
    </>
  );
}
