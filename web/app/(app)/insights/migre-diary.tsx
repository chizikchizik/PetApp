"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import type { MigreDiaryMonth } from "@/lib/data";

const RU_MONTHS_FULL = [
  "Январь","Февраль","Март","Апрель","Май","Июнь",
  "Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь",
];
const RU_MONTHS_IN = [
  "январе","феврале","марте","апреле","мае","июне",
  "июле","августе","сентябре","октябре","ноябре","декабре",
];
const DOW = ["Пн","Вт","Ср","Чт","Пт","Сб","Вс"];

function pluralDays(n: number): string {
  const a = Math.abs(n) % 100, b = a % 10;
  if (a > 10 && a < 20) return "дней";
  if (b === 1) return "день";
  if (b >= 2 && b <= 4) return "дня";
  return "дней";
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
function addDaysISO(iso: string, n: number): string {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
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

const lbl = "font-mono text-[11px] tracking-[0.08em] uppercase text-ink-3";

export type CycleOverlay = {
  periodStarts: string[];       // ISO даты начала месячных
  menstrualDays: number;
  forecastStart: string | null; // ожидаемое начало следующих месячных
};

// Дневник месяца в духе MigreBot: сводка, счётчик МИГБ, календарь с
// приступами и месячными, препараты месяца.
export function MigreDiary({
  initial,
  todayYM,
  todayISO,
  thresholds,
  cycle,
}: {
  initial: MigreDiaryMonth;
  todayYM: string;
  todayISO: string;
  thresholds: { highRisk: number; nsaid: number };
  cycle: CycleOverlay | null;
}) {
  const [ym, setYm] = useState(initial.ym);
  const [data, setData] = useState<MigreDiaryMonth>(initial);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const reqId = useRef(0);

  // Свежие серверные данные (после записи приступа) — сразу в текущий месяц.
  const [prevInitial, setPrevInitial] = useState(initial);
  if (initial !== prevInitial) {
    setPrevInitial(initial);
    if (ym === initial.ym) setData(initial);
  }

  // Месяц грузим по нажатию стрелки; ответ на устаревший запрос отбрасываем.
  function go(next: string) {
    setYm(next);
    setFailed(false);
    const id = ++reqId.current;
    if (next === initial.ym) { setData(initial); setLoading(false); return; }
    setLoading(true);
    fetch(`/api/migre-diary?ym=${next}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (id !== reqId.current) return; if (d) setData(d); else setFailed(true); })
      .catch(() => { if (id === reqId.current) setFailed(true); })
      .finally(() => { if (id === reqId.current) setLoading(false); });
  }

  const [y, m] = ym.split("-").map(Number);
  const migCount = data.migraineDates.length;
  const medCount = data.medDays.length;
  const streaks = longStreaks(data.migraineDates);
  const st0: Partial<MigreDiaryMonth["stats"]> = data.stats ?? {};
  const stats = { highRisk: st0.highRisk ?? 0, nsaid: st0.nsaid ?? 0, total: st0.total ?? 0, unclassified: st0.unclassified ?? 0 };
  // С 7 из 10 и 11 из 15 — янтарный «обрати внимание», без красного (ревью Елены).
  const hrHigh = stats.highRisk >= Math.ceil(thresholds.highRisk * 0.7);
  const nsHigh = stats.nsaid >= Math.ceil(thresholds.nsaid * 0.7);
  // Смешанный приём (ICHD-3 8.2.6): дни с любыми обезболивающими из обеих групп
  // тоже с ориентиром 10. Строку показываем, когда смешение реально добавляет дни.
  const mixedNear = stats.highRisk > 0 && stats.nsaid > 0 && stats.total >= Math.ceil(thresholds.highRisk * 0.7);

  // Разбивка по препаратам: дней приёма каждого купирующего в месяце.
  const perMed = new Map<string, number>();
  for (const d of data.medDays) for (const name of d.meds) perMed.set(name, (perMed.get(name) ?? 0) + 1);
  const perMedRows = [...perMed.entries()].sort((a, b) => b[1] - a[1]);

  // Месячные и прогноз — полосы под числом дня.
  const periodSet = new Set<string>();
  const forecastSet = new Set<string>();
  if (cycle) {
    for (const s of cycle.periodStarts) for (let i = 0; i < cycle.menstrualDays; i++) periodSet.add(addDaysISO(s, i));
    if (cycle.forecastStart) {
      for (let i = 0; i < cycle.menstrualDays; i++) {
        const d = addDaysISO(cycle.forecastStart, i);
        if (d > todayISO && !periodSet.has(d)) forecastSet.add(d);
      }
    }
  }

  // Сетка месяца (Пн…Вс)
  const daysInMonth = new Date(y, m, 0).getDate();
  const firstDow = (new Date(y, m - 1, 1).getDay() + 6) % 7; // Пн=0
  const cells: (number | null)[] = [...Array(firstDow).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);
  const migSet = new Set(data.migraineDates);
  const medSet = new Set(data.medDays.map((d) => d.date));
  const logSet = new Set(data.loggedDates);
  const iso = (day: number) => `${ym}-${String(day).padStart(2, "0")}`;
  const monthHasPeriod = [...periodSet].some((d) => d.startsWith(ym));
  const monthHasForecast = [...forecastSet].some((d) => d.startsWith(ym));

  const canNext = ym < todayYM;
  const navBtn = "grid h-11 w-11 place-items-center rounded-[3px] border border-line font-mono text-[16px] text-ink-2 transition active:bg-surface-3";

  return (
    <div>
      {/* Навигация по месяцам */}
      <div className="flex items-center justify-between gap-2">
        <button type="button" onClick={() => go(prevYM(ym))} aria-label="Предыдущий месяц" className={navBtn}>‹</button>
        <h2 className="whitespace-nowrap font-serif text-[clamp(14px,4.6vw,18px)] font-bold uppercase leading-none text-ink">{RU_MONTHS_FULL[m - 1]} {y}</h2>
        <button
          type="button"
          onClick={() => canNext && go(nextYM(ym))}
          aria-label="Следующий месяц"
          disabled={!canNext}
          className={`${navBtn} disabled:opacity-30`}
        >›</button>
      </div>

      <div className={`transition-opacity ${loading ? "opacity-50" : ""}`}>
        {failed && (
          <p className="mt-2 font-sans text-[12px] text-warn">Не удалось загрузить месяц. Проверь интернет и попробуй ещё раз.</p>
        )}

        {/* Сводка и счётчик МИГБ */}
        <div className="mt-3 grid grid-cols-3 divide-x divide-line overflow-hidden rounded-[3px] border border-line bg-surface-2">
          <div className="flex min-w-0 flex-col justify-between gap-1 px-2.5 py-2.5">
            <div className={lbl}>приступы</div>
            <div className="font-mono text-[21px] font-semibold leading-none text-ink">{migCount}</div>
          </div>
          <div className="flex min-w-0 flex-col justify-between gap-1 px-2.5 py-2.5">
            <div className={lbl}>триптаны и др.</div>
            <div className={`whitespace-nowrap font-mono text-[21px] font-semibold leading-none ${hrHigh ? "text-caution" : "text-ink"}`}>
              {stats.highRisk}<span className="text-[11px] font-normal text-ink-2"> из {thresholds.highRisk}</span>
            </div>
          </div>
          <div className="flex min-w-0 flex-col justify-between gap-1 px-2.5 py-2.5">
            <div className={lbl}>НПВС</div>
            <div className={`whitespace-nowrap font-mono text-[21px] font-semibold leading-none ${nsHigh ? "text-caution" : "text-ink"}`}>
              {stats.nsaid}<span className="text-[11px] font-normal text-ink-2"> из {thresholds.nsaid}</span>
            </div>
          </div>
        </div>
        {mixedNear && (
          <p className="mt-1.5 rounded-[3px] bg-caution-soft px-2.5 py-1.5 font-sans text-[12.5px] leading-snug text-ink">
            Всего дней с обезболивающими — <b className="font-semibold text-caution">{stats.total}</b>.
            При смешанном приёме ориентир тоже {thresholds.highRisk} дней.
          </p>
        )}
        <p className="mt-1.5 font-sans text-[12px] leading-snug text-ink-2">
          Считаем дни приёма, а не дни боли. Профилактика и витамины не считаются.
        </p>
        <details className="group mt-0.5">
          <summary className="flex min-h-[36px] cursor-pointer list-none items-center font-mono text-[11px] text-ink-2 underline underline-offset-2">
            <span className="group-open:hidden">подробнее о счётчике</span>
            <span className="hidden group-open:inline">свернуть</span>
          </summary>
          <p className="font-sans text-[12px] leading-snug text-ink-2">
            В «триптаны и др.» входят ещё комбинированные обезболивающие (с кофеином
            или кодеином), эрготамин и опиоиды. В «НПВС» — ибупрофен, парацетамол
            и похожие. Если {thresholds.highRisk}+ дней в месяц (для НПВС {thresholds.nsaid}+)
            держится 3 месяца и дольше, растёт риск головной боли от избытка лекарств.
          </p>
        </details>
        {stats.unclassified > 0 && (
          <Link href="/checkin/meds" className="mt-1 flex min-h-[36px] items-center font-sans text-[12px] text-ink-2 underline underline-offset-2">
            {stats.unclassified} {pluralDays(stats.unclassified)} с препаратами без типа не попали в счёт — цифры могут быть ниже реальных. Указать тип →
          </Link>
        )}

        {/* Календарь месяца */}
        <div className="mt-3">
          <div className="mb-1 grid grid-cols-7 gap-1">
            {DOW.map((d) => (
              <div key={d} className="text-center font-mono text-[11px] text-ink-3">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((day, i) => {
              if (day == null) return <div key={`e-${i}`} />;
              const d = iso(day);
              const mig = migSet.has(d);
              const med = medSet.has(d);
              const log = logSet.has(d);
              const future = d > todayISO;
              const period = periodSet.has(d);
              const forecast = forecastSet.has(d);
              return (
                <div
                  key={d}
                  className="relative flex aspect-square flex-col items-center justify-center rounded-[3px] border"
                  style={{
                    borderColor: mig ? "var(--warn)" : "var(--line)",
                    background: mig ? "var(--warn-soft)" : future ? "transparent" : "var(--surface-2)",
                    outline: d === todayISO ? "1.5px solid var(--ink-2)" : undefined,
                    outlineOffset: d === todayISO ? "-1.5px" : undefined,
                  }}
                  title={[d, mig ? "приступ" : log ? "день отмечен" : null, med ? "препарат" : null, period ? "месячные" : forecast ? "прогноз месячных" : null].filter(Boolean).join(" · ")}
                >
                  <span className={`font-mono text-[12px] leading-none ${mig ? "font-semibold text-warn" : future ? "text-ink-4" : log ? "text-ink" : "text-ink-3"}`}>{day}</span>
                  <span className="mt-0.5 h-[10px] font-mono text-[11px] leading-none">
                    {mig ? <span style={{ color: "var(--warn)" }}>▲</span> : log ? <span className="text-ink-3">✓</span> : ""}
                  </span>
                  {period && <span aria-hidden className="absolute inset-x-[3px] bottom-[2px] h-[3px] rounded-[1px] bg-phase" />}
                  {forecast && <span aria-hidden className="absolute inset-x-[3px] bottom-[2px] border-t-2 border-dashed border-phase" />}
                </div>
              );
            })}
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-ink-2">
            <span className="flex items-center gap-1.5"><span style={{ color: "var(--warn)" }}>▲</span> приступ</span>
            <span className="flex items-center gap-1.5"><span className="text-ink-3">✓</span> день отмечен</span>
            {monthHasPeriod && <span className="flex items-center gap-1.5"><span className="inline-block h-[3px] w-3 rounded-[1px] bg-phase" /> месячные</span>}
            {monthHasForecast && <span className="flex items-center gap-1.5"><span className="inline-block w-3 border-t-2 border-dashed border-phase" /> прогноз</span>}
          </div>
        </div>

        {/* Препараты месяца */}
        <div className="mt-3 border-t border-line pt-3">
          <div className="flex items-center justify-between">
            <p className={lbl}>препараты в {RU_MONTHS_IN[m - 1]}</p>
            <Link href="/checkin/meds" className="flex min-h-[36px] items-center font-mono text-[11px] text-ink-2 underline underline-offset-2">
              график приёма
            </Link>
          </div>
          {perMedRows.length > 0 ? (
            <div className="space-y-1">
              {perMedRows.map(([name, n]) => (
                <div key={name} className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 font-sans text-[13px] text-ink">{name}</span>
                  <span className="shrink-0 font-mono text-[12px] text-ink-2">{n} {pluralDays(n)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="font-sans text-[13px] text-ink-2">Препараты для купирования не отмечены.</p>
          )}
          <div className="mt-2 space-y-1 border-t border-line pt-2">
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-sans text-[13px] text-ink-2">Дней с препаратами для купирования</span>
              <span className="font-mono text-[13px] font-semibold text-ink">{medCount}</span>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-sans text-[13px] text-ink-2">Болела больше 2 дней подряд</span>
              <span className="font-mono text-[13px] font-semibold text-ink">{streaks}</span>
            </div>
          </div>
        </div>

        {(migCount === 0 && medCount === 0 && data.loggedDates.length === 0) && (
          <p className="mt-2 font-sans text-[12px] text-ink-2">За этот месяц записей нет.</p>
        )}
      </div>
    </div>
  );
}
