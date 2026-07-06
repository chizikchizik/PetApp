import { getPressureSettings, getDailyPressure, analyzePressure, type PressureDay } from "@/lib/pressure";
import { PressureCityForm } from "./pressure-city-form";
import { isoDaysFromTodayMoscow, todayISOMoscow } from "@/lib/format";

const RU_MON = ["янв","фев","мар","апр","май","июн","июл","авг","сен","окт","ноя","дек"];
const WINDOW_DAYS = 91; // окно графика; автопоиск считается по 12 мес

function addDaysISO(iso: string, n: number): string {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function daysBetweenISO(a: string, b: string): number {
  return Math.round((new Date(b + "T12:00:00").getTime() - new Date(a + "T12:00:00").getTime()) / 86400000);
}

// ── График: линия давления + отметки дней мигрени ───────────────────────────
function PressureChart({
  pressure,
  attackDates,
  matchedDates,
  fromISO,
  toISO,
}: {
  pressure: PressureDay[];
  attackDates: string[];
  matchedDates: Set<string>;
  fromISO: string;
  toISO: string;
}) {
  const ML = 30, MR = 6, W = 348, Y0 = 18, Y1 = 98;
  const span = Math.max(1, daysBetweenISO(fromISO, toISO));
  const step = (W - ML - MR) / span;
  const X = (iso: string) => ML + daysBetweenISO(fromISO, iso) * step;

  const inWindow = pressure.filter((p) => p.date >= fromISO && p.date <= toISO);
  const vals = inWindow.map((p) => p.hpa);
  const minV = Math.floor(Math.min(...vals)) - 2;
  const maxV = Math.ceil(Math.max(...vals)) + 2;
  const Y = (hpa: number) => Y0 + ((maxV - hpa) / Math.max(1, maxV - minV)) * (Y1 - Y0);
  const gridTicks = [maxV - 2, Math.round((maxV + minV) / 2), minV + 2];

  const pts = inWindow.map((p) => `${X(p.date).toFixed(1)},${Y(p.hpa).toFixed(1)}`).join(" ");

  const attacks = [...new Set(attackDates)].filter((d) => d >= fromISO && d <= toISO);

  const months: { x: number; label: string }[] = [];
  let cur = fromISO;
  while (cur <= toISO) {
    if (cur.slice(8) === "01" || cur === fromISO) {
      const m = parseInt(cur.slice(5, 7)) - 1;
      months.push({ x: X(cur), label: RU_MON[m] });
    }
    cur = addDaysISO(cur, 1);
  }

  return (
    <svg viewBox="0 0 348 132" className="block w-full" style={{ color: "var(--ink-3)" }}
      role="img" aria-label="Линия атмосферного давления с отметками дней мигрени">
      {gridTicks.map((t) => (
        <g key={t}>
          <line x1={ML} y1={Y(t)} x2={W - MR} y2={Y(t)} stroke="var(--line)" />
          <text x={ML - 4} y={Y(t)} textAnchor="end" dominantBaseline="middle"
            fontSize="8" fill="currentColor" opacity="0.7">{t}</text>
        </g>
      ))}

      {attacks.map((d) => matchedDates.has(d) && (
        <rect key={`hl-${d}`} x={X(addDaysISO(d, -2))} y={Y0}
          width={Math.max(3, step * 2)} height={Y1 - Y0} fill="var(--warn)" opacity="0.12" />
      ))}

      {attacks.map((d) => (
        <line key={`v-${d}`} x1={X(d)} y1={Y0} x2={X(d)} y2={Y1}
          stroke="var(--warn)" strokeDasharray="2 3" opacity="0.3" />
      ))}

      {inWindow.length > 1 && (
        <polyline points={pts} fill="none" stroke="var(--ink-2)"
          strokeWidth="1.6" strokeLinejoin="round" />
      )}

      {attacks.map((d) => (
        <line key={`t-${d}`} x1={X(d)} y1={Y1 + 5} x2={X(d)} y2={Y1 + 13}
          stroke="var(--warn)" strokeWidth="2.5" />
      ))}

      {months.map(({ x, label }, i) => (
        <text key={`${label}-${i}`} x={x} y={129} fontSize="8"
          fill="currentColor" opacity="0.6">{label}</text>
      ))}
    </svg>
  );
}

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
        <p className="font-mono text-[10px] tracking-[0.14em] uppercase text-ink-3">
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
        <p className="font-mono text-[10px] tracking-[0.14em] uppercase text-ink-3">
          давление и мигрень
        </p>
        <span className="font-mono text-[10px] text-ink-4">
          {fromM} — {toM}{windowAttacks.length > 0 ? ` · ${windowAttacks.length} прист.` : ""}
        </span>
      </div>

      {hasChart ? (
        <>
          <div className="mt-3">
            <PressureChart
              pressure={pressure}
              attackDates={attackDates}
              matchedDates={matchedDates}
              fromISO={windowFrom}
              toISO={todayISO}
            />
          </div>
          <div className="mt-1.5 flex flex-wrap gap-x-3.5 gap-y-1">
            <span className="inline-flex items-center gap-1.5 font-mono text-[10px] text-ink-3">
              <span className="inline-block h-0 w-3.5 border-t-2" style={{ borderColor: "var(--ink-2)" }} /> давление, гПа
            </span>
            <span className="inline-flex items-center gap-1.5 font-mono text-[10px] text-ink-3">
              <span className="inline-block h-2.5 w-[2px]" style={{ background: "var(--warn)" }} /> день с мигренью
            </span>
            {matchedDates.size > 0 && (
              <span className="inline-flex items-center gap-1.5 font-mono text-[10px] text-ink-3">
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
          <p className="font-mono text-[10px] tracking-[0.1em] uppercase" style={{ color: "var(--warn)" }}>
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
        <p className="mt-3 font-mono text-[10px] text-ink-4">
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

      <div className="mt-2.5 font-mono text-[10px] text-ink-4">
        <span>{settings.city} · точность ниже для старых записей, если переезжала</span>{" "}
        <PressureCityForm initialCity={settings.city} />
      </div>
    </section>
  );
}
