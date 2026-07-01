import type { Metadata } from "next";
import Link from "next/link";
import { getPeriodStarts, getMigraineEventsSince, getMeds, getWorkoutHistory } from "@/lib/data";
import { monthlyTriptan, cycleCorrelation, buildCycleCalendar, type CorrelationState } from "@/lib/insights";
import { computeTrainingPatterns, type TrainingPattern } from "@/lib/training-patterns";
import { isoDaysFromTodayMoscow, todayISOMoscow } from "@/lib/format";
import { PrintButton } from "./print-button";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Дневник мигрени — ВЕРТА",
};

const PRINT_STYLES = `
  @media print {
    nav, .no-print { display: none !important; }
    body { background: white !important; color: black !important; }
    @page { margin: 20mm; }
    .report-root { color: black !important; background: white !important; }
    /* Without this, Chrome's "Save as PDF" drops all background-color unless
       the print dialog's "Background graphics" is manually checked (often
       off by default) — this silently erased the training bar chart and the
       cycle calendar cells, since both encode data purely via background
       color with no border/text. */
    .report-root, .report-root * {
      print-color-adjust: exact !important;
      -webkit-print-color-adjust: exact !important;
    }
    .report-section { break-inside: avoid; }
    .report-footer { break-inside: avoid; break-before: avoid; }
  }
`;

// "Обсудить с врачом" вместо "Превышен" — это порог по ОДНОМУ препарату,
// не диагноз МИГБ (для которого также нужны ≥15 дней ГБ/мес по ICHD-3 8.2).
function triptanStatus(n: number): { label: string; color: string } {
  if (n >= 10) return { label: "Обсудить с врачом", color: "#b91c1c" };
  if (n >= 7) return { label: "Близко к порогу", color: "#c2500a" };
  return { label: "Норма", color: "#166534" };
}

// Неголовокружительные, не-диагностические формулировки — окончательная оценка
// связи с циклом делается врачом с учётом полной клинической картины, а не
// одним процентом за год. См. рецензию Елены: бинарный порог ≥60% без учёта
// размера выборки — overreach.
const CORR_TEXT: Record<CorrelationState, (c: { peri: number; total: number; cycleCount: number; pct: number }) => string> = {
  no_cycle: () => "Нет данных о цикле — оценка связи с циклом невозможна.",
  no_migraine: () => "Нет записей о приступах за период.",
  insufficient: (c) =>
    `Недостаточно данных для оценки связи с циклом (${c.total} приступ${c.total === 1 ? "" : "а"}, ${c.cycleCount} цикл${c.cycleCount === 1 ? "" : "а"} с записями — нужно ≥5 приступов и ≥3 цикла).`,
  low: (c) =>
    `${c.peri} из ${c.total} приступов (${c.pct}%) — доля в окне цикла не превышает уровень случайного совпадения.`,
  moderate: (c) =>
    `${c.peri} из ${c.total} приступов (${c.pct}%) зафиксированы в окне −2…+3 дня от начала менструации — возможна частичная связь, обсудите с врачом.`,
  high: (c) =>
    `${c.peri} из ${c.total} приступов (${c.pct}%) зафиксированы в окне −2…+3 дня от начала менструации. Такой паттерн обсуждается в диагностике менструально-ассоциированной мигрени (ICHD-3, критерии A1.1/A1.2) — окончательную оценку делает врач.`,
  very_high: (c) =>
    `${c.peri} из ${c.total} приступов (${c.pct}%) зафиксированы в окне −2…+3 дня от начала менструации. Такой паттерн обсуждается в диагностике менструальной / менструально-ассоциированной мигрени (ICHD-3, критерии A1.1/A1.2) — окончательную оценку делает врач.`,
};

const DOW_LABELS_SHORT = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

function isoDowLocal(dateISO: string): number {
  const d = new Date(dateISO + "T12:00:00");
  return (d.getDay() + 6) % 7; // 0=Пн … 6=Вс
}

// Print-safe day-of-week bars: fixed pixel widths/heights, not CSS grid/flex:1 —
// same rendering fragility as the cycle calendar (see comment there), plus this
// is a simpler chart than training/training-chart.tsx's SVG version, which is
// built for an interactive/scrollable screen, not a fixed print page.
function TrainingDowChart({ workouts, migraines }: { workouts: { date: string }[]; migraines: { date: string }[] }) {
  const workoutByDow = new Array(7).fill(0);
  const migByDow = new Array(7).fill(0);
  for (const w of workouts) workoutByDow[isoDowLocal(w.date)]++;
  for (const m of migraines) migByDow[isoDowLocal(m.date)]++;
  const maxW = Math.max(...workoutByDow, 1);
  const maxM = Math.max(...migByDow, 1);
  const BAR_H = 60;

  return (
    <div style={{ display: "flex", gap: "10px", alignItems: "flex-end" }}>
      {DOW_LABELS_SHORT.map((label, i) => (
        <div key={label} style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "28px" }}>
          <div style={{ display: "flex", alignItems: "flex-end", gap: "2px", height: `${BAR_H}px` }}>
            <div
              title={`тренировок: ${workoutByDow[i]}`}
              style={{
                width: "11px",
                height: `${Math.max(2, (workoutByDow[i] / maxW) * BAR_H)}px`,
                background: "#8A877D",
                border: "1px solid #8A877D",
                borderRadius: "1px 1px 0 0",
              }}
            />
            <div
              title={`мигреней: ${migByDow[i]}`}
              style={{
                width: "11px",
                height: `${Math.max(2, (migByDow[i] / maxM) * BAR_H)}px`,
                background: "#16150F",
                border: "1px solid #16150F",
                borderRadius: "1px 1px 0 0",
              }}
            />
          </div>
          <span style={{ marginTop: "4px", fontFamily: "JetBrains Mono, monospace", fontSize: "9px", color: "#8A877D" }}>
            {label}
          </span>
        </div>
      ))}
      <div style={{ marginLeft: "8px", display: "flex", flexDirection: "column", gap: "4px", fontFamily: "JetBrains Mono, monospace", fontSize: "10px", color: "#54524A" }}>
        <span><span style={{ display: "inline-block", width: "9px", height: "9px", background: "#8A877D", border: "1px solid #8A877D", borderRadius: "1px", marginRight: "5px" }} />тренировки</span>
        <span><span style={{ display: "inline-block", width: "9px", height: "9px", background: "#16150F", border: "1px solid #16150F", borderRadius: "1px", marginRight: "5px" }} />мигрени</span>
      </div>
    </div>
  );
}

// Тот же принцип, что и CORR_TEXT: наблюдение + размер выборки, без вердиктов —
// "постэкзертационный" паттерн (тренировка → мигрень на следующий день) не диагноз,
// его отмечает пользователь сама через приложение, а не медицинский алгоритм.
function trainingText(p: TrainingPattern): string {
  switch (p.state) {
    case "no_workouts":
      return "Нет записей о тренировках за период.";
    case "too_few":
      return `Недостаточно записей о тренировках для анализа (${p.count}, нужно ≥10).`;
    case "no_migraines":
      return `${p.count} тренировок за период, приступов не зафиксировано.`;
    case "no_pattern":
      return `${p.count} тренировок, ${p.migCount} приступов за период — устойчивой связи между тренировками и приступами не выявлено.`;
    case "postexertional":
      return `${p.peakWorkouts} тренировок в ${p.peakDowLabel.toLowerCase()} за период, из них ${p.peakPostEx} (${p.peakRate}%) предшествовали приступу в течение 1–2 дней. В целом по всем дням недели приступ следовал за тренировкой в ${p.overallRate}% случаев (${p.count} тренировок, ${p.migCount} приступов). Возможная связь с интенсивностью/восстановлением — обсудите с врачом.`;
  }
}

const MONTHS_RU: Record<string, string> = {
  янв: "Январь", фев: "Февраль", мар: "Март", апр: "Апрель",
  май: "Май", июн: "Июнь", июл: "Июль", авг: "Август",
  сен: "Сентябрь", окт: "Октябрь", ноя: "Ноябрь", дек: "Декабрь",
};

export default async function MigraineReport() {
  const todayISO = todayISOMoscow();
  const today = new Date(todayISO + "T12:00:00");
  const since = isoDaysFromTodayMoscow(-365);
  const [starts, events, meds, workouts] = await Promise.all([
    getPeriodStarts(),
    getMigraineEventsSince(since),
    getMeds(),
    getWorkoutHistory(since),
  ]);

  const corr = cycleCorrelation(events, starts);
  const bars = monthlyTriptan(events, today, 12);
  const cycles = buildCycleCalendar(starts, events, today, 6);
  const trainingPattern = computeTrainingPatterns(workouts, events);

  const auraTotal = events.length;
  const auraCount = events.filter((e) => e.aura).length;
  const auraPct = auraTotal ? Math.round((auraCount / auraTotal) * 100) : 0;

  const prophylactic = meds.filter((m) => !m.isAsNeeded);
  const asNeeded = meds.filter((m) => m.isAsNeeded);

  const generatedDate = today.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const sinceDate = new Date(since + "T12:00:00").toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: PRINT_STYLES }} />

      {/* ── Навигация (только на экране) ── */}
      <div className="no-print mb-6 flex items-center justify-between">
        <Link
          href="/insights"
          className="font-mono text-[10px] tracking-[0.14em] uppercase text-ink-3"
        >
          ← назад
        </Link>
        <PrintButton />
      </div>

      {/* ── Отчёт ── */}
      <div
        className="report-root"
        style={{ fontFamily: "Manrope, sans-serif", color: "#16150F", background: "white" }}
      >
        {/* 1. Шапка */}
        <header style={{ borderBottom: "2px solid #16150F", paddingBottom: "12px", marginBottom: "24px" }}>
          <p style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "10px", letterSpacing: "0.14em", textTransform: "uppercase", color: "#54524A", margin: 0 }}>
            Дневник мигрени — ВЕРТА
          </p>
          <h1 style={{ fontFamily: "Unbounded, serif", fontSize: "22px", fontWeight: 700, textTransform: "uppercase", margin: "6px 0 4px" }}>
            Марина
          </h1>
          <p style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "11px", color: "#54524A", margin: 0 }}>
            Период: {sinceDate} — {generatedDate}
          </p>
          <p style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "11px", color: "#8A877D", margin: "2px 0 0" }}>
            Сформировано: {generatedDate}
          </p>
        </header>

        {/* 2. Связь с циклом */}
        <section className="report-section" style={{ marginBottom: "28px" }}>
          <h2 style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "10px", letterSpacing: "0.14em", textTransform: "uppercase", color: "#8A877D", marginBottom: "10px" }}>
            Связь приступов с менструальным циклом
          </h2>
          {corr.state !== "no_cycle" && corr.state !== "no_migraine" && (
            <p style={{ fontSize: "28px", fontFamily: "JetBrains Mono, monospace", fontWeight: 600, margin: "0 0 6px" }}>
              {corr.pct}%
            </p>
          )}
          <p style={{ fontSize: "13px", lineHeight: 1.6, margin: 0 }}>
            {CORR_TEXT[corr.state](corr)}
          </p>
        </section>

        {/* 3. Аура */}
        <section className="report-section" style={{ marginBottom: "28px" }}>
          <h2 style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "10px", letterSpacing: "0.14em", textTransform: "uppercase", color: "#8A877D", marginBottom: "10px" }}>
            Приступы с аурой
          </h2>
          <p style={{ fontSize: "28px", fontFamily: "JetBrains Mono, monospace", fontWeight: 600, margin: "0 0 6px" }}>
            {auraTotal ? `${auraPct}%` : "—"}
          </p>
          <p style={{ fontSize: "13px", lineHeight: 1.6, margin: 0 }}>
            {auraTotal
              ? `${auraCount} из ${auraTotal} приступов за 12 месяцев сопровождались аурой.`
              : "Нет записей о приступах за период."}
          </p>
        </section>

        {/* 4. Связь с тренировками */}
        <section className="report-section" style={{ marginBottom: "28px" }}>
          <h2 style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "10px", letterSpacing: "0.14em", textTransform: "uppercase", color: "#8A877D", marginBottom: "10px" }}>
            Связь приступов с физической нагрузкой
          </h2>
          {workouts.length > 0 && (
            <div style={{ marginBottom: "10px" }}>
              <TrainingDowChart workouts={workouts} migraines={events} />
            </div>
          )}
          <p style={{ fontSize: "13px", lineHeight: 1.6, margin: 0 }}>
            {trainingText(trainingPattern)}
          </p>
        </section>

        {/* 5. Профилактическая терапия */}
        <section className="report-section" style={{ marginBottom: "28px" }}>
          <h2 style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "10px", letterSpacing: "0.14em", textTransform: "uppercase", color: "#8A877D", marginBottom: "10px" }}>
            Текущая терапия
          </h2>
          <p style={{ fontSize: "11px", fontFamily: "JetBrains Mono, monospace", color: "#54524A", margin: "0 0 4px" }}>
            Профилактика
          </p>
          {prophylactic.length ? (
            <ul style={{ margin: "0 0 12px", paddingLeft: "18px", fontSize: "13px", lineHeight: 1.6 }}>
              {prophylactic.map((m) => (
                <li key={m.id}>
                  {m.name}
                  {m.note ? ` — ${m.note}` : ""}
                  {m.when ? ` · ${m.when}` : ""}
                </li>
              ))}
            </ul>
          ) : (
            <p style={{ fontSize: "13px", color: "#8A877D", margin: "0 0 12px" }}>Не отмечена в приложении.</p>
          )}
          <p style={{ fontSize: "11px", fontFamily: "JetBrains Mono, monospace", color: "#54524A", margin: "0 0 4px" }}>
            Купирование приступа
          </p>
          {asNeeded.length ? (
            <ul style={{ margin: 0, paddingLeft: "18px", fontSize: "13px", lineHeight: 1.6 }}>
              {asNeeded.map((m) => (
                <li key={m.id}>
                  {m.name}
                  {m.note ? ` — ${m.note}` : ""}
                </li>
              ))}
            </ul>
          ) : (
            <p style={{ fontSize: "13px", color: "#8A877D", margin: 0 }}>Не отмечено в приложении.</p>
          )}
        </section>

        {/* 6. Таблица триптана по месяцам */}
        <section className="report-section" style={{ marginBottom: "28px" }}>
          <h2 style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "10px", letterSpacing: "0.14em", textTransform: "uppercase", color: "#8A877D", marginBottom: "10px" }}>
            Приступы и приём триптана — последние 12 месяцев
          </h2>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #16150F" }}>
                <th style={{ textAlign: "left", padding: "6px 8px 6px 0", fontFamily: "JetBrains Mono, monospace", fontWeight: 600, fontSize: "11px" }}>Месяц</th>
                <th style={{ textAlign: "center", padding: "6px 8px", fontFamily: "JetBrains Mono, monospace", fontWeight: 600, fontSize: "11px" }}>Дней с мигренью</th>
                <th style={{ textAlign: "center", padding: "6px 8px", fontFamily: "JetBrains Mono, monospace", fontWeight: 600, fontSize: "11px" }}>Дней триптана</th>
                <th style={{ textAlign: "center", padding: "6px 0 6px 8px", fontFamily: "JetBrains Mono, monospace", fontWeight: 600, fontSize: "11px" }}>Статус</th>
              </tr>
            </thead>
            <tbody>
              {bars.map((b) => {
                const status = triptanStatus(b.triptan);
                return (
                  <tr key={b.ym} style={{ borderBottom: "1px solid #D6D2C9" }}>
                    <td style={{ padding: "5px 8px 5px 0", fontSize: "12px" }}>
                      {MONTHS_RU[b.label] ?? b.label} {b.ym.slice(0, 4)}
                    </td>
                    <td style={{ textAlign: "center", padding: "5px 8px", fontFamily: "JetBrains Mono, monospace", fontSize: "13px", fontWeight: 500 }}>
                      {b.total}
                    </td>
                    <td style={{ textAlign: "center", padding: "5px 8px", fontFamily: "JetBrains Mono, monospace", fontSize: "13px", fontWeight: 500 }}>
                      {b.triptan}
                    </td>
                    <td style={{ textAlign: "center", padding: "5px 0 5px 8px", color: status.color, fontSize: "11px", fontFamily: "JetBrains Mono, monospace" }}>
                      {status.label}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p style={{ marginTop: "8px", fontSize: "11px", color: "#54524A", fontFamily: "JetBrains Mono, monospace", lineHeight: 1.5 }}>
            Дни приёма суматриптана в месяц (риск-фактор МИГБ при систематическом приёме
            ≥10 дней/мес в течение ≥3 месяцев, ICHD-3, код 8.2). Указаны дни приёма только
            этого препарата — если для купирования используются также другие обезболивающие,
            их частоту нужно обсудить с врачом отдельно. Это не диагноз — окончательную
            оценку даёт невролог с учётом общего числа дней головной боли в месяц.
          </p>
        </section>

        {/* 7. Цикловой календарь */}
        <section className="report-section" style={{ marginBottom: "28px" }}>
          <h2 style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "10px", letterSpacing: "0.14em", textTransform: "uppercase", color: "#8A877D", marginBottom: "10px" }}>
            Мигрень × цикл — последние 6 циклов
          </h2>
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", fontSize: "11px", marginBottom: "8px", fontFamily: "JetBrains Mono, monospace", color: "#54524A" }}>
            <span>■ Мигрень</span>
            <span style={{ color: "#B14A63" }}>■ Менструация</span>
            <span style={{ color: "#D6D2C9" }}>■ Обычный день</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            {cycles.map((cy, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center" }}>
                <span style={{ width: "32px", flexShrink: 0, textAlign: "right", fontFamily: "JetBrains Mono, monospace", fontSize: "9px", color: "#8A877D" }}>
                  {cy.label}
                </span>
                {/* Fixed pixel widths, not CSS grid `fr` tracks or flex:1 — Chrome's
                    print engine can collapse fr-sized grid tracks to 0 width when
                    the grid is nested inside a flex item without a resolved width. */}
                <div style={{ marginLeft: "8px", whiteSpace: "nowrap", lineHeight: 0 }}>
                  {cy.days.map((d) => {
                    const cellColor = d.migraine ? "#16150F" : d.menstrual ? "rgba(177,74,99,0.4)" : "#E6E3DC";
                    return (
                      <span
                        key={d.day}
                        title={`день ${d.day}`}
                        style={{
                          display: "inline-block",
                          width: "6px",
                          height: "10px",
                          marginRight: "1px",
                          borderRadius: "1px",
                          background: cellColor,
                          border: `1px solid ${cellColor}`,
                          outline: d.isToday ? "1px solid #16150F" : "none",
                          outlineOffset: "-1px",
                        }}
                      />
                    );
                  })}
                </div>
                <span style={{ marginLeft: "8px", width: "24px", flexShrink: 0, fontFamily: "JetBrains Mono, monospace", fontSize: "9px", color: "#8A877D" }}>
                  {cy.length}д
                </span>
              </div>
            ))}
          </div>
          <p style={{ marginTop: "8px", fontSize: "11px", color: "#54524A", fontFamily: "JetBrains Mono, monospace" }}>
            Цифра справа — длина цикла в днях. Чёрные ячейки — дни приступа.
          </p>
        </section>

        {/* 8. Футер */}
        <footer className="report-footer" style={{ borderTop: "1px solid #D6D2C9", paddingTop: "12px", marginTop: "16px" }}>
          <p style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "10px", color: "#8A877D", margin: 0, lineHeight: 1.6 }}>
            Сгенерировано приложением ВЕРТА · Данные из персонального дневника.<br />
            Не является медицинским документом. Все выводы — предварительные наблюдения по
            логам пользователя, окончательную оценку и диагноз даёт лечащий врач.
          </p>
        </footer>
      </div>
    </>
  );
}
