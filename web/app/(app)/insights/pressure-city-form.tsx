"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { savePressureCity } from "./actions";

// Один компонент на оба случая: первый онбординг (initialCity нет — форма
// развёрнута сразу) и смена города (initialCity есть — тихая ссылка
// "изменить", форма по клику).
export function PressureCityForm({ initialCity }: { initialCity?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(!initialCity);
  const [city, setCity] = useState(initialCity ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, startT] = useTransition();

  function doSave() {
    if (!city.trim() || saving) return;
    setError(null);
    startT(async () => {
      const r = await savePressureCity(city);
      if (r.ok) {
        setOpen(false);
        router.refresh();
      } else {
        setError(r.error ?? "Не получилось сохранить");
      }
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="font-mono text-[10px] text-ink-4 underline underline-offset-2"
      >
        изменить
      </button>
    );
  }

  return (
    <div className={initialCity ? "mt-2" : ""}>
      {!initialCity && (
        <p className="mb-3 font-sans text-[12.5px] leading-[1.55] text-ink-2">
          Чтобы сопоставить приступы с погодой, нужен город — по нему подтянем
          историю атмосферного давления.
        </p>
      )}
      <p className="mb-1.5 font-mono text-[10px] tracking-[0.12em] uppercase text-ink-3">Город</p>
      <div className="flex gap-2">
        <input
          type="text"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") doSave(); }}
          placeholder="Москва"
          autoFocus={!initialCity}
          className="min-w-0 flex-1 rounded-[3px] border border-line bg-surface px-3.5 py-2.5 font-mono text-[14px] text-ink placeholder:text-ink-3 outline-none focus:border-phase"
        />
        <button
          type="button"
          onClick={doSave}
          disabled={saving || !city.trim()}
          className="shrink-0 rounded-[3px] bg-phase px-4 font-mono text-[12px] font-semibold uppercase tracking-[0.06em] text-on-phase transition active:scale-[0.98] disabled:opacity-50"
        >
          {saving ? "…" : "Подтвердить"}
        </button>
      </div>
      {error && <p className="mt-1.5 font-mono text-[10px] text-warn">{error}</p>}
      {!initialCity && (
        <p className="mt-2 font-mono text-[9px] text-ink-4">можно изменить позже</p>
      )}
      {initialCity && (
        <button
          type="button"
          onClick={() => { setOpen(false); setCity(initialCity); setError(null); }}
          className="mt-1.5 font-mono text-[10px] text-ink-3"
        >
          отмена
        </button>
      )}
    </div>
  );
}
