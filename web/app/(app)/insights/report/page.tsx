import type { Metadata } from "next";
import Link from "next/link";
import { getPeriodStarts, getMigraineEventsSince } from "@/lib/data";
import { monthlyTriptan, perimenstrualStats, buildCycleCalendar } from "@/lib/insights";
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
  }
`;

function triptanStatus(n: number): { label: string; color: string } {
  if (n >= 10) return { label: "Превышен", color: "#b91c1c" };
  if (n >= 7) return { label: "Близко к порогу", color: "#c2500a" };
  return { label: "Норма", color: "#166534" };
}

const MONTHS_RU: Record<string, string> = {
  янв: "Январь", фев: "Февраль", мар: "Март", апр: "Апрель",
  май: "Май", июн: "Июнь", июл: "Июль", авг: "Август",
  сен: "Сентябрь", окт: "Октябрь", ноя: "Ноябрь", дек: "Декабрь",
};

export default async function MigraineReport() {
  const today = new Date();
  const since = `${today.getFullYear() - 1}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const [starts, events] = await Promise.all([
    getPeriodStarts(),
    getMigraineEventsSince(since),
  ]);

  const peri = perimenstrualStats(events, starts);
  const bars = monthlyTriptan(events, today, 12);
  const cycles = buildCycleCalendar(starts, events, today, 6);

  const generatedDate = today.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const sinceDate = new Date(since).toLocaleDateString("ru-RU", {
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
            Период: {sinceDate} — {today.toLocaleDateString("ru-RU", { day: "2-digit", month: "long", year: "numeric" })}
          </p>
          <p style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "11px", color: "#8A877D", margin: "2px 0 0" }}>
            Сформировано: {generatedDate}
          </p>
        </header>

        {/* 2. Связь с циклом */}
        <section style={{ marginBottom: "28px" }}>
          <h2 style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "10px", letterSpacing: "0.14em", textTransform: "uppercase", color: "#8A877D", marginBottom: "10px" }}>
            Связь приступов с менструальным циклом
          </h2>
          <p style={{ fontSize: "28px", fontFamily: "JetBrains Mono, monospace", fontWeight: 600, margin: "0 0 6px" }}>
            {peri.pct}%
          </p>
          <p style={{ fontSize: "13px", lineHeight: 1.6, margin: 0 }}>
            {peri.pct}% атак приходится на окно −2…+3 дней от начала менструации
            ({peri.peri} из {peri.total} приступов за 12 месяцев).
            {peri.pct >= 60
              ? " Картина соответствует менструально-ассоциированной мигрени."
              : " Устойчивой связи с циклом не выявлено."}
          </p>
        </section>

        {/* 3. Таблица триптана по месяцам */}
        <section style={{ marginBottom: "28px" }}>
          <h2 style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "10px", letterSpacing: "0.14em", textTransform: "uppercase", color: "#8A877D", marginBottom: "10px" }}>
            Применение триптана — последние 12 месяцев
          </h2>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #16150F" }}>
                <th style={{ textAlign: "left", padding: "6px 8px 6px 0", fontFamily: "JetBrains Mono, monospace", fontWeight: 600, fontSize: "11px" }}>Месяц</th>
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
          <p style={{ marginTop: "8px", fontSize: "11px", color: "#54524A", fontFamily: "JetBrains Mono, monospace" }}>
            Порог медикаментозно-абузусной головной боли: 10 дней/мес.
          </p>
        </section>

        {/* 4. Цикловой календарь */}
        <section style={{ marginBottom: "28px" }}>
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
              <div key={i} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ width: "32px", flexShrink: 0, textAlign: "right", fontFamily: "JetBrains Mono, monospace", fontSize: "9px", color: "#8A877D" }}>
                  {cy.label}
                </span>
                <div style={{ flex: 1, display: "grid", gridTemplateColumns: "repeat(35, 1fr)", gap: "2px" }}>
                  {cy.days.map((d) => (
                    <span
                      key={d.day}
                      title={`день ${d.day}`}
                      style={{
                        display: "block",
                        height: "10px",
                        borderRadius: "1px",
                        background: d.migraine ? "#16150F" : d.menstrual ? "rgba(177,74,99,0.4)" : "#E6E3DC",
                        outline: d.isToday ? "2px solid #16150F" : "none",
                        outlineOffset: "-2px",
                      }}
                    />
                  ))}
                  {Array.from({ length: 35 - cy.days.length }, (_, j) => (
                    <span key={`pad-${j}`} style={{ display: "block", height: "10px" }} />
                  ))}
                </div>
                <span style={{ width: "24px", flexShrink: 0, fontFamily: "JetBrains Mono, monospace", fontSize: "9px", color: "#8A877D" }}>
                  {cy.length}д
                </span>
              </div>
            ))}
          </div>
          <p style={{ marginTop: "8px", fontSize: "11px", color: "#54524A", fontFamily: "JetBrains Mono, monospace" }}>
            Цифра справа — длина цикла в днях. Чёрные ячейки — дни приступа.
          </p>
        </section>

        {/* 5. Футер */}
        <footer style={{ borderTop: "1px solid #D6D2C9", paddingTop: "12px", marginTop: "16px" }}>
          <p style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "10px", color: "#8A877D", margin: 0, lineHeight: 1.6 }}>
            Сгенерировано приложением ВЕРТА · Данные из персонального дневника.<br />
            Не является медицинским документом.
          </p>
        </footer>
      </div>
    </>
  );
}
