import { getPressureSettings, getDailyPressure, analyzePressure } from "@/lib/pressure";
import { PressureCityForm } from "./pressure-city-form";
import { PressureChart } from "./pressure-chart";
import { isoDaysFromTodayMoscow, todayISOMoscow } from "@/lib/format";

const RU_MON = ["янв","фев","мар","апр","май","июн","июл","авг","сен","окт","ноя","дек"];
const WINDOW_DAYS = 91; // окно графика; автопоиск считается по 12 мес

// ── Блок целиком ─────────────────────────────────────────────────────────────
export async function PressureBlock({
  attackDates,
  pregnant = false,
}: {
  attackDates: string[];
  pregnant?: boolean;
}) {
  const settings = await getPressureSettings();

  if (!settings) {
    return (
      <section className="mt-3.5 rounded-card border border-line bg-surface p-5">
        <p className="font-mono text-[11px] tracking-[0.14em] uppercase text-ink-3">
          давление и мигрень
        </p>
        <div className="mt-3">
          <PressureCityForm />
        </div>
      </section>
    );
  }

  const todayISO = todayISOMoscow();
  const since = isoDaysFromTodayMoscow(-365);
  const pressure = await getDailyPressure(since, todayISO);
  const analysis = analyzePressure(attackDates, pressure);
  const matchedDates = new Set(analysis.state === "found" ? analysis.matchedDates : []);

  const windowFrom = isoDaysFromTodayMoscow(-(WINDOW_DAYS - 1));
  const windowAttacks = [...new Set(attackDates)].filter((d) => d >= windowFrom);
  const fromM = RU_MON[parseInt(windowFrom.slice(5, 7)) - 1];
  const toM = RU_MON[parseInt(todayISO.slice(5, 7)) - 1];
  const hasChart = pressure.some((p) => p.date >= windowFrom);

  return (
    <section className="mt-3.5 rounded-card border border-line bg-surface p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="font-mono text-[11px] tracking-[0.14em] uppercase text-ink-3">
          давление и мигрень
        </p>
        <span className="font-mono text-[11px] text-ink-3">
          {fromM} — {toM}{windowAttacks.length > 0 ? ` · ${windowAttacks.length} прист.` : ""}
        </span>
      </div>

      {hasChart ? (
        <>
          <div className="mt-3">
            <PressureChart
              pressure={pressure.filter((p) => p.date >= windowFrom).map((p) => ({ date: p.date, hpa: p.hpa }))}
              attackDates={windowAttacks}
              matchedDates={[...matchedDates]}
              fromISO={windowFrom}
              toISO={todayISO}
            />
          </div>
          <div className="mt-1.5 flex flex-wrap gap-x-3.5 gap-y-1">
            <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-ink-3">
              <span className="inline-block h-0 w-3.5 border-t-2" style={{ borderColor: "var(--ink-2)" }} /> давление, гПа
            </span>
            <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-ink-3">
              <span className="inline-block h-2.5 w-[2px]" style={{ background: "var(--warn)" }} /> день с мигренью
            </span>
            {matchedDates.size > 0 && (
              <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-ink-3">
                <span className="inline-block h-2.5 w-2.5 rounded-[1px]" style={{ background: "var(--warn)", opacity: 0.25 }} /> падение накануне
              </span>
            )}
          </div>
        </>
      ) : (
        <p className="mt-3 font-mono text-[11px] text-ink-3">
          Данные о давлении ещё не подтянулись — архив погоды отдаёт историю с задержкой в несколько дней. Загляни позже.
        </p>
      )}

      {analysis.state === "found" ? (
        <div className="mt-3 border border-line p-3" style={{ borderLeft: "2px solid var(--warn)" }}>
          <p className="font-mono text-[11px] tracking-[0.1em] uppercase" style={{ color: "var(--warn)" }}>
            замечена закономерность
          </p>
          <p className="mt-1.5 font-sans text-[12.5px] leading-[1.55] text-ink-2">
            В {analysis.withDrop} из {analysis.attacksWithData} приступов за 12 месяцев давление
            заметно падало за 1–2 дня до начала (типично {analysis.typicalDropHpa} гПа) — чаще,
            чем в случайные дни ({analysis.attackPct}% против {analysis.baselinePct}%). Это
            наблюдение по твоим данным, не диагноз: сон, стресс, сезонность и цикл могли влиять
            одновременно. Обсуди с врачом.
          </p>
        </div>
      ) : (
        <p className="mt-3 font-mono text-[11px] text-ink-3">
          {analysis.state === "insufficient"
            ? `автопоиск закономерностей: мало данных — ${analysis.attacksWithData} из 8 нужных приступов`
            : `автопоиск закономерностей: пока ничего заметного · ${analysis.attacksWithData} приступов за 12 мес`}
        </p>
      )}

      {pregnant && (
        <div className="mt-3 rounded-[3px] border border-line bg-surface-2 p-3" style={{ borderLeft: "2px solid var(--warn)" }}>
          <p className="font-sans text-[12px] leading-[1.55] text-ink-2">
            При беременности сильная или необычная головная боль — особенно с давлением
            140/90 и выше, нарушениями зрения или отёками — повод срочно связаться с врачом.
          </p>
        </div>
      )}

      <p className="mt-2.5 font-sans text-[11.5px] leading-relaxed text-ink-3">
        Связь мигрени с погодой — спорная тема в науке и не признанный медициной триггер,
        в отличие от цикла. Здесь просто твои данные рядом.
      </p>

      <div className="mt-2.5 font-mono text-[11px] text-ink-3">
        <span>{settings.city} · точность ниже для старых записей, если переезжала</span>{" "}
        <PressureCityForm initialCity={settings.city} />
      </div>
    </section>
  );
}
