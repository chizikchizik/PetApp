"use client";
import { useEffect, useState } from "react";
import type { MigreDiaryMonth } from "@/lib/data";

const RU_MONTHS_FULL = [
  "Январь","Февраль","Март","Апрель","Май","Июнь",
  "Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь",
];
const DOW = ["Пн","Вт","Ср","Чт","Пт","Сб","Вс"];

function pluralDays(n: number): string {
  const a = Math.abs(n) % 100, b = a % 10;
  if (a > 10 && a < 20) return "приступов";
  if (b === 1) return "приступ";
  if (b >= 2 && b <= 4) return "приступа";
  return "приступов";
}

function prevYM(ym: string): string {
  let [y, m] = ym.split("-").map(Number);
  m--; if (m < 1) { m = 12; y--; }
  return `${y}-${String(m).padStart(2, "0")}`;
}
function nextYM(ym: string): string {
  let [y, m] = ym.split("-").map(Number);
  m++; if (m > 12) { m = 1; y++; }
  return `${y}-${String(m).padStart(2, "0")}`;
}

// Число эпизодов «болела больше 2 дней подряд» — серии из ≥3 подряд идущих
// дней с приступом (в пределах месяца, как в MigreBot).
function longStreaks(migraineDates: string[]): number {
  const days = [...migraineDates].sort();
  let episodes = 0, run = 1;
  for (let i = 1; i <= days.length; i++) {
    const prev = new Date(days[i - 1] + "T12:00:00");
    const cur = i < days.length ? new Date(days[i] + "T12:00:00") : null;
    const consecutive = cur && Math.round((cur.getTime() - prev.getTime()) / 86400000) === 1;
    if (consecutive) { run++; } else { if (run >= 3) episodes++; run = 1; }
  }
  return episodes;
}

export function MigreDiary({ initial, todayYM }: { initial: MigreDiaryMonth; todayYM: string }) {
  const [ym, setYm] = useState(initial.ym);
  const [data, setData] = useState<MigreDiaryMonth>(initial);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (ym === initial.ym) { setData(initial); return; }
    let cancelled = false;
    setLoading(true);
    fetch(`/api/migre-diary?ym=${ym}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d && !cancelled) setData(d); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [ym, initial]);

  const [y, m] = ym.split("-").map(Number);
  const migCount = data.migraineDates.length;
  const medCount = data.medDays.length;
  const streaks = longStreaks(data.migraineDates);

  // Разбивка по препаратам: дней приёма каждого купирующего в месяце.
  const perMed = new Map<string, number>();
  for (const d of data.medDays) for (const name of d.meds) perMed.set(name, (perMed.get(name) ?? 0) + 1);
  const perMedRows = [...perMed.entries()].sort((a, b) => b[1] - a[1]);

  // Сетка месяца (Пн…Вс)
  const daysInMonth = new Date(y, m, 0).getDate();
  const firstDow = (new Date(y, m - 1, 1).getDay() + 6) % 7; // Пн=0
  const cells: (number | null)[] = [...Array(firstDow).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);
  const migSet = new Set(data.migraineDates);
  const medSet = new Set(data.medDays.map((d) => d.date));
  const logSet = new Set(data.loggedDates);
  const iso = (day: number) => `${ym}-${String(day).padStart(2, "0")}`;

  const canNext = ym < todayYM;

  return (
    <div className="mt-3">
      {/* Навигация по месяцам */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setYm(prevYM(ym))}
          className="flex h-7 w-7 items-center justify-center rounded-[3px] border border-line font-mono text-[13px] text-ink-2 transition active:bg-surface-3"
        >←</button>
        <span className="font-sans text-[14px] font-semibold text-ink">{RU_MONTHS_FULL[m - 1]} {y}</span>
        <button
          type="button"
          onClick={() => canNext && setYm(nextYM(ym))}
          className={`flex h-7 w-7 items-center justify-center rounded-[3px] border border-line font-mono text-[13px] text-ink-2 transition active:bg-surface-3 ${canNext ? "" : "pointer-events-none opacity-30"}`}
        >→</button>
      </div>

      {/* Сводка */}
      <div className={`mt-3 space-y-1 ${loading ? "opacity-50" : ""}`}>
        <div className="flex items-baseline justify-between">
          <span className="flex items-center gap-2 font-sans text-[13px] text-ink">
            <span className="inline-block h-2.5 w-2.5 rotate-45 rounded-[1px]" style={{ background: "var(--warn)" }} />
            Приступы мигрени
          </span>
          <span className="font-mono text-[14px] font-semibold text-ink">{migCount}</span>
        </div>
        <div className="flex items-baseline justify-between">
          <span className="flex items-center gap-2 font-sans text-[13px] text-ink-2">
            <span className="inline-block h-0 w-0" style={{ borderLeft: "5px solid transparent", borderRight: "5px solid transparent", borderBottom: "8px solid var(--warn)" }} />
            Приёмы препаратов
          </span>
          <span className="font-mono text-[14px] font-semibold text-ink">{medCount}</span>
        </div>
        <div className="flex items-baseline justify-between">
          <span className="font-sans text-[13px] text-ink-2">Болела больше 2 дней подряд</span>
          <span className="font-mono text-[14px] font-semibold text-ink">{streaks}</span>
        </div>
      </div>

      {/* Разбивка по препаратам */}
      {perMedRows.length > 0 && (
        <div className="mt-2.5 border-t border-line pt-2">
          <p className="mb-1 font-mono text-[9px] tracking-[0.12em] uppercase text-ink-3">в дневнике</p>
          <div className="space-y-0.5">
            {perMedRows.map(([name, n]) => (
              <div key={name} className="flex items-baseline justify-between">
                <span className="font-sans text-[12.5px] text-ink-2">{name}</span>
                <span className="font-mono text-[12px] text-ink">{n} {n === 1 ? "день" : n < 5 ? "дня" : "дней"}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Календарь месяца */}
      <div className="mt-3 border-t border-line pt-3">
        <div className="mb-1 grid grid-cols-7 gap-1">
          {DOW.map((d) => (
            <div key={d} className="text-center font-mono text-[8px] uppercase text-ink-4">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((day, i) => {
            if (day == null) return <div key={`e-${i}`} />;
            const d = iso(day);
            const mig = migSet.has(d);
            const med = medSet.has(d);
            const log = logSet.has(d);
            return (
              <div
                key={d}
                className="flex aspect-square flex-col items-center justify-center rounded-[3px] border"
                style={{
                  borderColor: mig ? "var(--warn)" : "var(--line)",
                  background: mig ? "var(--warn-soft)" : "var(--surface-2)",
                }}
                title={mig ? `${d} — приступ${med ? " + препарат" : ""}` : log ? `${d} — отмечен` : d}
              >
                <span className={`font-mono text-[11px] leading-none ${mig ? "font-semibold text-warn" : log ? "text-ink" : "text-ink-4"}`}>{day}</span>
                <span className="mt-0.5 h-[9px] font-mono text-[8px] leading-none">
                  {mig ? <span style={{ color: "var(--warn)" }}>▲</span> : log ? <span className="text-ink-3">✓</span> : ""}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {(migCount === 0 && medCount === 0 && data.loggedDates.length === 0) && (
        <p className="mt-2 font-mono text-[10px] text-ink-4">За этот месяц записей нет.</p>
      )}
    </div>
  );
}
