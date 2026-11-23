import Link from "next/link";
import {
  getPeriodStarts,
  getMigraineEventsSince,
  getAllMigraineEvents,
  getCycleHistory,
  getWorkoutHistory,
  getSportActivityDays,
  getSportTypes,
  getMigreDiaryMonth,
  getMigraineMedStatsByMonth,
  getMeds,
  type MigraineMedStats,
} from "@/lib/data";
import { getCurrentUser, isPregnant } from "@/lib/auth";
import { allMonthlyBars, cycleCorrelation, buildCycleCalendar, type CycleCorrelation } from "@/lib/insights";
import { isoDaysFromTodayMoscow, todayISOMoscow, isoLocal } from "@/lib/format";
import { getCurrentCycle } from "@/lib/cycle";
import { MIGRAINE } from "@/lib/seed-data";
import { MigraineChart } from "./migraine-chart";
import { MigreDiary, type CycleOverlay } from "./migre-diary";
import { CycleHistoryChart } from "./cycle-history";
import { TrainingChart } from "../training/training-chart";
import { PressureBlock } from "./pressure-block";

export const dynamic = "force-dynamic";

// ── Adaptive cycle-correlation block ────────────────────────────────────────

type CorrConfig = {
  pctColor: string;
  verdict: React.ReactNode;
  body: React.ReactNode;
};

function corrConfig(c: CycleCorrelation): CorrConfig {
  const pct = c.pct;
  const peri = c.peri;
  const total = c.total;

  switch (c.state) {
    case "no_cycle":
      return {
        pctColor: "text-ink-3",
        verdict: <span className="font-sans text-[15px] font-semibold text-ink">Нет данных о цикле</span>,
        body: (
          <p className="mt-2 font-sans text-[12.5px] leading-[1.55] text-ink-2">
            Добавь даты месячных в разделе{" "}
            <Link href="/cycle" className="text-phase underline underline-offset-2">Цикл →</Link>{" "}
            — тогда можно будет рассчитать связь мигрени с циклом.
          </p>
        ),
      };

    case "no_migraine":
      return {
        pctColor: "text-ink-3",
        verdict: <span className="font-sans text-[15px] font-semibold text-ink">Нет записей о мигрени</span>,
        body: (
          <p className="mt-2 font-sans text-[12.5px] leading-[1.55] text-ink-2">
            Когда добавишь приступы через{" "}
            <Link href="/dashboard" className="text-phase underline underline-offset-2">«Сегодня» →</Link>{" "}
            или импорт, здесь появится анализ связи с циклом.
          </p>
        ),
      };

    case "insufficient":
      return {
        pctColor: "text-ink-2",
        verdict: (
          <div className="flex items-baseline gap-2.5">
            <span className="font-mono text-[46px] font-semibold leading-[0.9] text-ink-2">{pct}%</span>
            <span className="font-sans text-[12.5px] text-ink-3">
              атак в окне<br />−2…+3 от месячных
            </span>
          </div>
        ),
        body: (
          <p className="mt-3 font-sans text-[12.5px] leading-[1.55] text-ink-2">
            Пока{" "}
            {c.cycleCount < 3 && total < 5
              ? "мало данных о цикле и приступах"
              : c.cycleCount < 3
              ? `мало данных о цикле (${c.cycleCount} цикл${c.cycleCount === 1 ? "" : "а"})`
              : `мало приступов (${total})`}
            {" "}— вывод ненадёжен. Продолжай логировать:{" "}
            нужно минимум 5 приступов и 3 полных цикла.
          </p>
        ),
      };

    case "low":
      return {
        pctColor: "text-ink-2",
        verdict: (
          <div className="flex items-baseline gap-2.5">
            <span className="font-mono text-[46px] font-semibold leading-[0.9] text-ink-2">{pct}%</span>
            <span className="font-sans text-[12.5px] text-ink-3">
              атак в окне<br />−2…+3 от месячных
            </span>
          </div>
        ),
        body: (
          <p className="mt-3 font-sans text-[12.5px] leading-[1.55] text-ink-2">
            <b className="font-semibold text-ink">Слабая связь с циклом.</b>{" "}
            За 12 мес: {peri} из {total} приступов попали в перименструальное окно —
            уровень случайного совпадения. Тригеры стоит искать в другом.
          </p>
        ),
      };

    case "moderate":
      return {
        pctColor: "text-warn",
        verdict: (
          <div className="flex items-baseline gap-2.5">
            <span className="font-mono text-[46px] font-semibold leading-[0.9] text-warn">{pct}%</span>
            <span className="font-sans text-[12.5px] text-ink-2">
              атак в окне<br />−2…+3 от месячных
            </span>
          </div>
        ),
        body: (
          <p className="mt-3 font-sans text-[12.5px] leading-[1.55] text-ink-2">
            <b className="font-semibold text-ink">Умеренная связь с циклом.</b>{" "}
            За 12 мес: {peri} из {total} приступов пришлись на перименструальное окно.
            Это выше случайного, но ещё не дотягивает до менструально-ассоциированной мигрени.
            Продолжай вести дневник.
          </p>
        ),
      };

    case "high":
      return {
        pctColor: "text-phase",
        verdict: (
          <div className="flex items-baseline gap-2.5">
            <span className="font-mono text-[46px] font-semibold leading-[0.9] text-phase">{pct}%</span>
            <span className="font-sans text-[12.5px] text-ink-2">
              атак в окне<br />−2…+3 от месячных
            </span>
          </div>
        ),
        body: (
          <p className="mt-3 font-sans text-[12.5px] leading-[1.55] text-ink-2">
            Похоже на{" "}
            <b className="font-semibold text-ink">менструально-ассоциированную</b> мигрень.
            За 12 мес: {peri} из {total} приступов жмутся к месячным.
          </p>
        ),
      };

    case "very_high":
      return {
        pctColor: "text-phase",
        verdict: (
          <div className="flex items-baseline gap-2.5">
            <span className="font-mono text-[46px] font-semibold leading-[0.9] text-phase">{pct}%</span>
            <span className="font-sans text-[12.5px] text-ink-2">
              атак в окне<br />−2…+3 от месячных
            </span>
          </div>
        ),
        body: (
          <p className="mt-3 font-sans text-[12.5px] leading-[1.55] text-ink-2">
            <b className="font-semibold text-ink">Очень высокая связь с циклом.</b>{" "}
            За 12 мес: {peri} из {total} приступов приходятся на перименструальное окно.
            Возможна{" "}
            <b className="font-semibold text-ink">чистая менструальная мигрень</b> —
            обсуди с неврологом: есть специфические схемы профилактики.
          </p>
        ),
      };
  }
}

// Компактный индикатор надёжности — видно сразу, не читая абзац текста.
// "insufficient" уже явно означает "мало данных", high/very_high — сильную выборку.
function ConfidenceBadge({ corr }: { corr: CycleCorrelation }) {
  if (corr.state === "no_cycle" || corr.state === "no_migraine") return null;
  const strong = corr.state === "high" || corr.state === "very_high";
  const weak = corr.state === "insufficient";
  const color = weak ? "text-warn" : strong ? "text-phase" : "text-ink-3";
  const bg = weak ? "bg-warn/10" : strong ? "bg-phase-soft" : "bg-surface-2";
  return (
    <span className={`inline-flex items-center gap-1 rounded-[3px] px-2 py-1 font-mono text-[10px] tracking-[0.02em] ${color} ${bg}`}>
      {weak ? "мало данных" : "основано на"} · {corr.total} приступ{corr.total === 1 ? "" : corr.total < 5 ? "а" : "ов"} · {corr.cycleCount} цикл{corr.cycleCount === 1 ? "" : corr.cycleCount < 5 ? "а" : "ов"}
    </span>
  );
}

function CycleCorrelationBlock({ corr }: { corr: CycleCorrelation }) {
  const cfg = corrConfig(corr);
  return (
    <section className="mt-2 rounded-card border border-line bg-surface p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="font-mono text-[10px] tracking-[0.14em] uppercase text-ink-3">
          связь с циклом
        </p>
        <ConfidenceBadge corr={corr} />
      </div>
      <div className="mt-2">{cfg.verdict}</div>
      {cfg.body}
    </section>
  );
}

// Вывод под графиком «приступы по месяцам» — по данным, а не общей фразой,
// и по той же метрике, что плитки дневника: дни приёма за месяц. Формулировки
// по ревью Елены: один месяц выше ориентира — ещё не паттерн (ICHD-3 требует
// регулярного приёма >3 мес.), смешанный приём учитывается (8.2.6), без
// «лимитов», «злоупотребления» и призывов сократить приём самостоятельно.
function monthlyVerdict(
  months: MigraineMedStats[],
  t: { highRisk: number; nsaid: number },
  hasProphylaxis: boolean,
): React.ReactNode {
  if (months.length === 0) return null;
  const period = months.length >= 12 ? "12 мес." : `${months.length} мес.`;
  const over = (m: MigraineMedStats) => m.highRisk >= t.highRisk || m.nsaid >= t.nsaid || m.total >= t.highRisk;
  const near = (m: MigraineMedStats) =>
    m.highRisk >= Math.ceil(t.highRisk * 0.7) || m.nsaid >= Math.ceil(t.nsaid * 0.7) || m.total >= Math.ceil(t.highRisk * 0.7);
  let run = 0, maxRun = 0;
  for (const m of months) { run = over(m) ? run + 1 : 0; maxRun = Math.max(maxRun, run); }
  const overCount = months.filter(over).length;
  const nearCount = months.filter((m) => near(m) && !over(m)).length;

  if (maxRun >= 3) {
    return (
      <>
        <b className="font-semibold text-ink">{maxRun} мес. подряд</b> — {t.highRisk} и больше дней с обезболивающими
        (для НПВС — {t.nsaid} и больше). При таком приёме растёт риск головной боли от избытка лекарств.
        Обсуди с неврологом и не меняй схему сама.
      </>
    );
  }
  if (overCount > 0) {
    return (
      <>
        В <b className="font-semibold text-ink">{overCount} мес. из {months.length}</b> было {t.highRisk} и больше дней
        с обезболивающими (для НПВС — {t.nsaid} и больше). Покажи это неврологу — это повод вместе пересмотреть лечение.
      </>
    );
  }
  if (nearCount > 0) {
    return (
      <>
        Ниже ориентира в {t.highRisk} дней, но в <b className="font-semibold text-ink">{nearCount} мес.</b> было 7–9 дней
        с триптанами и др. или с обезболивающими в целом. Частый приём — повод обсудить с неврологом{" "}
        {hasProphylaxis ? "хватает ли текущей профилактики" : "профилактику"}.
      </>
    );
  }
  const max = Math.max(...months.map((m) => m.total));
  if (max === 0) return null;
  return <>По записям за {period} — не больше {max} {max === 1 ? "дня" : "дней"} с обезболивающими в месяц, ниже ориентиров.</>;
}

const MIG = "#d85a30";
const MENS = "rgba(177,74,99,0.22)";

export default async function Insights() {
  const todayISO = todayISOMoscow();
  const today = new Date(todayISO + "T12:00:00");
  const todayYM = todayISO.slice(0, 7);
  const since = isoDaysFromTodayMoscow(-365);
  const sinceTraining = isoDaysFromTodayMoscow(-26 * 7);
  // 12 последних месяцев для вывода под графиком (включая текущий).
  const [ty, tm] = todayYM.split("-").map(Number);
  const fromYM = tm === 12 ? `${ty}-01` : `${ty - 1}-${String(tm + 1).padStart(2, "0")}`;
  const [starts, recentEvents, allEvents, cycleHistory, workoutHistory, sportDays, sportTypes, user, diaryMonth, statsByMonth, meds] = await Promise.all([
    getPeriodStarts(),
    getMigraineEventsSince(since),
    getAllMigraineEvents(),
    getCycleHistory(),
    getWorkoutHistory(sinceTraining),
    getSportActivityDays(sinceTraining),
    getSportTypes(),
    getCurrentUser(),
    getMigreDiaryMonth(todayYM),
    getMigraineMedStatsByMonth(fromYM, todayYM),
    getMeds(),
  ]);

  const pregnant = isPregnant(user);
  // Окно беременности исключается из корреляции с циклом (и во время, и
  // после — по сохранённым pregnant_since/until), иначе безфазовый период
  // загрязняет статистику "приступ в окне −2…+3 от месячных".
  const corrEvents = recentEvents.filter((e) => {
    if (!user?.pregnantSince) return true;
    const until = user.pregnantUntil ?? "9999-12-31";
    return e.date < user.pregnantSince || e.date > until;
  });
  const corr = cycleCorrelation(corrEvents, starts);
  const chartBars = allMonthlyBars(allEvents);
  const cycles = buildCycleCalendar(starts, recentEvents, today, 6, user?.menstrualDays ?? 5);
  const trainingMigraines = recentEvents.filter((e) => e.date >= sinceTraining);
  // Месяцы до первой записи в счёт «за N мес.» не берём.
  const firstRecordYM = allEvents[0]?.date.slice(0, 7) ?? todayYM;
  const verdictMonths = Object.entries(statsByMonth)
    .filter(([ym]) => ym >= firstRecordYM)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, st]) => st);
  const hasProphylaxis = meds.some((m) => !m.isAsNeeded && !m.isSupplement);
  const verdict = monthlyVerdict(
    verdictMonths,
    { highRisk: MIGRAINE.triptanThreshold, nsaid: MIGRAINE.nsaidThreshold },
    hasProphylaxis,
  );

  // Месячные и прогноз в календаре дневника. При беременности не показываем.
  const menstrualDays = user?.menstrualDays ?? 5;
  const cycleOverlay: CycleOverlay | null = !pregnant && starts.length > 0
    ? {
        periodStarts: starts.map((d) => isoLocal(d)),
        menstrualDays,
        forecastStart: isoLocal(getCurrentCycle(starts, today, user?.avgCycleLength ?? 28, menstrualDays).nextPeriod.likely),
      }
    : null;

  const historyYears = cycleHistory.length
    ? `${cycleHistory[0].start.slice(0, 4)}–${cycleHistory[cycleHistory.length - 1].start.slice(0, 4)}`
    : "";

  return (
    <>
      {/* ── Шапка ── */}
      <h1 className="font-serif font-bold text-[24px] uppercase leading-tight">МИГРЕНЬ</h1>
      <p className="mt-1.5 font-sans text-[12.5px] leading-snug text-ink-2">
        Наблюдения по твоим записям, а не диагноз. Решения — с лечащим неврологом.
      </p>
      <a href="#urgent" className="mt-0.5 inline-flex min-h-[36px] items-center font-mono text-[11px] text-ink-2 underline underline-offset-2">
        Когда срочно к врачу →
      </a>

      {/* ── Дневник месяца ── */}
      <section className="mt-4 rounded-card border border-line bg-surface p-4">
        <MigreDiary
          initial={diaryMonth}
          todayYM={todayYM}
          todayISO={todayISO}
          thresholds={{ highRisk: MIGRAINE.triptanThreshold, nsaid: MIGRAINE.nsaidThreshold }}
          cycle={cycleOverlay}
        />
      </section>

      {/* ── Отчёт для невролога ── */}
      <Link
        href="/insights/report"
        className="mt-3 flex min-h-[52px] items-center justify-between gap-3 rounded-card border border-line-2 bg-surface px-4 py-3 active:scale-[0.99]"
      >
        <span className="min-w-0">
          <span className="block font-sans text-[15px] font-bold text-ink">Отчёт для невролога</span>
          <span className="mt-0.5 block font-sans text-[12px] text-ink-2">приступы, препараты и терапия на одной странице — распечатать или сохранить PDF</span>
        </span>
        <span className="shrink-0 font-mono text-[14px] text-phase">→</span>
      </Link>

      {/* ── Связи ── */}
      <h2 className="mt-7 font-mono text-[11px] tracking-[0.14em] uppercase text-ink-3">связи</h2>

      {pregnant ? (
        <section className="mt-2 rounded-card border border-line bg-surface p-5">
          <p className="font-mono text-[10px] tracking-[0.14em] uppercase text-ink-3">
            связь с циклом
          </p>
          <p className="mt-2 font-sans text-[12.5px] leading-[1.55] text-ink-2">
            На паузе на время беременности — период без цикла исключается из расчёта,
            чтобы не искажать статистику. Корреляция возобновится вместе с циклом.
          </p>
        </section>
      ) : (
        <CycleCorrelationBlock corr={corr} />
      )}

      {/* ── Давление и мигрень ── */}
      <PressureBlock attackDates={recentEvents.map((e) => e.date)} pregnant={pregnant} />

      {/* ── Мигрень × тренировки ── */}
      <section className="mt-3.5 rounded-card border border-line bg-surface p-4">
        <div className="flex items-center justify-between">
          <p className="font-mono text-[10px] tracking-[0.14em] uppercase text-ink-3">
            мигрень × тренировки
          </p>
          <Link href="/training" className="font-mono text-[10px] text-ink-3 underline underline-offset-2">
            анализ паттернов →
          </Link>
        </div>
        <TrainingChart
          workouts={workoutHistory}
          sports={sportDays}
          migraines={trainingMigraines}
          sportTypes={sportTypes}
        />
      </section>

      {/* ── История ── */}
      <h2 className="mt-7 font-mono text-[11px] tracking-[0.14em] uppercase text-ink-3">история</h2>

      {/* ── Приступы по месяцам ── */}
      <section className="mt-2 rounded-card border border-line bg-surface p-4">
        <p className="font-mono text-[10px] tracking-[0.14em] uppercase text-ink-3">
          приступы по месяцам
        </p>
        <div className="mt-4">
          <MigraineChart bars={chartBars} todayYM={todayYM} />
        </div>
        {verdict && (
          <p className="mt-3 font-sans text-[12px] leading-[1.55] text-ink-2">{verdict}</p>
        )}
      </section>

      {/* ── Мигрень × цикл ── (на паузе при беременности: "текущий цикл"
          в календаре был бы бесконечным и вводил бы в заблуждение) */}
      {!pregnant && (
      <section className="mt-3.5 rounded-card border border-line bg-surface p-4">
        <p className="font-mono text-[10px] tracking-[0.14em] uppercase text-ink-3">
          мигрень × цикл
        </p>
        <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10px] text-ink-2">
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-[11px] w-[11px] rounded-[2px]" style={{ background: MENS }} />
            менструация
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-[11px] w-[11px] rounded-[2px]" style={{ background: MIG }} />
            мигрень
          </span>
        </div>
        <div className="mt-3 flex flex-col gap-1">
          {cycles.map((cy, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="w-6 shrink-0 text-right font-mono text-[9px] text-ink-3">
                {cy.label}
              </span>
              <div
                className="flex-1"
                style={{ display: "grid", gridTemplateColumns: "repeat(35, 1fr)", gap: "2px" }}
              >
                {cy.days.map((d) => (
                  <span
                    key={d.day}
                    title={`день ${d.day}`}
                    className="h-[11px] rounded-[1px]"
                    style={{
                      background: d.migraine ? MIG : d.menstrual ? MENS : "var(--surface-3)",
                      outline: d.isToday ? "2px solid var(--phase)" : "none",
                      outlineOffset: "-2px",
                    }}
                  />
                ))}
                {Array.from({ length: 35 - cy.days.length }, (_, j) => (
                  <span key={`pad-${j}`} className="h-[11px] rounded-[1px]" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
      )}

      {/* ── Вся история: цикл × мигрень ── */}
      <section className="mt-3.5 rounded-card border border-line bg-surface p-4">
        <p className="font-mono text-[10px] tracking-[0.14em] uppercase text-ink-3">
          все циклы{historyYears ? ` · ${historyYears}` : ""}
        </p>
        <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10px] text-ink-2">
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-[10px] w-[10px] rounded-[2px]" style={{ background: "rgba(196,80,110,0.18)" }} />
            менструация
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-[10px] w-[10px] rounded-full" style={{ background: "#d04830" }} />
            мигрень
          </span>
        </div>
        <p className="mt-1 font-mono text-[9px] text-ink-4">
          каждая строка — один цикл · X = день цикла · прокрути вниз
        </p>
        <div className="mt-2.5">
          <CycleHistoryChart rows={cycleHistory} />
        </div>
      </section>

      {/* ── Когда к врачу ── */}
      <section id="urgent" className="mt-3.5 scroll-mt-6 rounded-card border border-line bg-surface p-4" style={{ borderLeft: "3px solid var(--warn)" }}>
        <h2 className="font-sans text-[15px] font-bold text-ink">Когда срочно к врачу</h2>
        <ul className="mt-2.5 space-y-1.5 font-sans text-[13px] leading-relaxed text-ink-2">
          <li>Внезапная очень сильная «громоподобная» боль — худшая в жизни.</li>
          <li>Впервые возникшая аура, либо необычно долгая / со слабостью или речью.</li>
          <li>Онемение, слабость в руке или ноге, асимметрия лица.</li>
          <li>Боль после травмы головы; температура с ригидностью шеи.</li>
          <li>Резкое учащение или смена характера приступов.</li>
        </ul>
        <p className="mt-2.5 font-sans text-[12px] text-ink-2">
          Приложение не ставит диагнозов — это сигналы обратиться к врачу или в неотложку.
        </p>
      </section>
    </>
  );
}
