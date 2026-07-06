"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveBpReading, deleteBpReading } from "./actions";
import type { BpReading, BpSlot } from "@/lib/data";

const RU_MONTHS = ["янв","фев","мар","апр","май","июн","июл","авг","сен","окт","ноя","дек"];

function fmtDate(iso: string) {
  const d = new Date(iso + "T12:00:00");
  return `${d.getDate()} ${RU_MONTHS[d.getMonth()]}`;
}

// Пороги для беременных — правила Елены (ACOG/ISSHP/NICE): 140/90 и для
// домашних измерений, срабатывание по ИЛИ (изолированная диастолическая
// гипертензия значима). Для не-беременных значения показываются нейтрально,
// без оценки — цветовые шкалы «норма/не норма» запрещены её же вето.
function pregnantFlagLevel(sys: number, dia: number): 0 | 1 | 2 {
  if (sys >= 160 || dia >= 110) return 2;
  if (sys >= 140 || dia >= 90) return 1;
  return 0;
}

const FLAG_TEXTS: Record<1 | 2, string> = {
  1: "Значение 140/90 или выше. Посиди спокойно 5 минут и измерь ещё раз. Если повторно 140/90 или выше — свяжись со своим врачом сегодня же, особенно при головной боли, нарушениях зрения, боли под рёбрами или отёках.",
  2: "Значение 160/110 или выше. Измерь повторно через 15 минут. Если снова столько же или выше — не откладывай: срочно позвони своему врачу или в скорую. При беременности такие цифры требуют осмотра сегодня, даже если самочувствие нормальное.",
};

export function BpTracker({
  readings,
  todayISO,
  pregnant,
}: {
  readings: BpReading[];
  todayISO: string;
  pregnant: boolean;
}) {
  const router = useRouter();
  // Автослот: до 15:00 по умолчанию "утро", после — "вечер".
  const defaultSlot: BpSlot = new Date().getHours() < 15 ? "morning" : "evening";
  const [date, setDate] = useState(todayISO);
  const [slot, setSlot] = useState<BpSlot>(defaultSlot);
  const [sys, setSys] = useState("");
  const [dia, setDia] = useState("");
  const [pulse, setPulse] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [savedFlag, setSavedFlag] = useState<0 | 1 | 2>(0);
  const [saving, startT] = useTransition();

  const byKey = useMemo(() => {
    const m = new Map<string, BpReading>();
    for (const r of readings) m.set(`${r.date}:${r.slot}`, r);
    return m;
  }, [readings]);

  const existing = byKey.get(`${date}:${slot}`);

  const days = useMemo(() => {
    const set = [...new Set(readings.map((r) => r.date))];
    return set.sort((a, b) => b.localeCompare(a));
  }, [readings]);

  function loadCell(r: BpReading) {
    setDate(r.date);
    setSlot(r.slot);
    setSys(String(r.systolic));
    setDia(String(r.diastolic));
    setPulse(r.pulse != null ? String(r.pulse) : "");
    setError(null);
  }

  function doSave() {
    const s = Number(sys), d = Number(dia);
    const p = pulse.trim() ? Number(pulse) : null;
    if (!s || !d) return;
    setError(null);
    startT(async () => {
      const r = await saveBpReading(date, slot, s, d, p);
      if (r.ok) {
        setSavedFlag(pregnant ? pregnantFlagLevel(s, d) : 0);
        setSys(""); setDia(""); setPulse("");
        router.refresh();
      } else {
        setError(r.error ?? "Не получилось сохранить");
      }
    });
  }

  // Мягкое предупреждение об опечатке (Елена): разница сис−диа < 15
  // физиологически почти невозможна — обычно перепутанные цифры.
  const sN = Number(sys), dN = Number(dia);
  const suspicious = sN > 0 && dN > 0 && sN > dN && sN - dN < 15;

  function doDelete() {
    if (!existing) return;
    startT(async () => {
      await deleteBpReading(date, slot);
      setSys(""); setDia(""); setPulse("");
      router.refresh();
    });
  }

  return (
    <>
      {/* ── Ввод ── */}
      <div className="mt-4 rounded-card border border-line bg-surface p-4">
        <div className="flex items-center gap-2">
          <input
            type="date"
            max={todayISO}
            value={date}
            onChange={(e) => { if (e.target.value) { setDate(e.target.value); setError(null); } }}
            className="min-w-0 flex-1 rounded-[3px] border border-line bg-surface px-2.5 py-2 font-mono text-[12px] text-ink-2 outline-none focus:border-phase"
          />
          <div className="flex shrink-0 overflow-hidden rounded-[3px] border border-line">
            {(["morning", "evening"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => { setSlot(s); setError(null); }}
                className={`px-3 py-2 font-mono text-[11px] transition ${
                  slot === s ? "bg-phase font-semibold text-on-phase" : "bg-surface text-ink-3"
                }`}
              >
                {s === "morning" ? "утро" : "вечер"}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-2.5 flex gap-2">
          <input
            type="number" inputMode="numeric" placeholder="верхнее"
            value={sys} onChange={(e) => setSys(e.target.value)}
            className="min-w-0 flex-1 rounded-[3px] border border-line bg-surface px-3 py-3 text-center font-mono text-[17px] font-semibold text-ink placeholder:text-[12px] placeholder:font-normal placeholder:text-ink-3 outline-none focus:border-phase"
          />
          <span className="self-center font-mono text-[17px] text-ink-4">/</span>
          <input
            type="number" inputMode="numeric" placeholder="нижнее"
            value={dia} onChange={(e) => setDia(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") doSave(); }}
            className="min-w-0 flex-1 rounded-[3px] border border-line bg-surface px-3 py-3 text-center font-mono text-[17px] font-semibold text-ink placeholder:text-[12px] placeholder:font-normal placeholder:text-ink-3 outline-none focus:border-phase"
          />
          <input
            type="number" inputMode="numeric" placeholder="пульс"
            value={pulse} onChange={(e) => setPulse(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") doSave(); }}
            className="w-20 shrink-0 rounded-[3px] border border-line bg-surface px-2 py-3 text-center font-mono text-[15px] text-ink placeholder:text-[12px] placeholder:text-ink-3 outline-none focus:border-phase"
          />
        </div>

        <div className="mt-2.5 flex items-center gap-3">
          <button
            type="button"
            onClick={doSave}
            disabled={saving || !sys || !dia}
            className="flex-1 rounded-[3px] bg-phase py-3 text-[14px] font-semibold text-on-phase transition active:scale-[0.98] disabled:opacity-50"
          >
            {saving ? "…" : existing ? "Обновить" : "Записать"}
          </button>
          {existing && (
            <button
              type="button"
              onClick={doDelete}
              disabled={saving}
              className="shrink-0 font-mono text-[11px] text-ink-3 underline underline-offset-2"
            >
              удалить запись
            </button>
          )}
        </div>
        {existing && (
          <p className="mt-1.5 font-mono text-[10px] text-ink-4">
            за {fmtDate(date)} ({slot === "morning" ? "утро" : "вечер"}) уже записано {existing.systolic}/{existing.diastolic} — новая запись заменит
          </p>
        )}
        {error && <p className="mt-1.5 font-mono text-[10px] text-warn">{error}</p>}
        {suspicious && !error && (
          <p className="mt-1.5 font-mono text-[10px] text-ink-3">
            Разница между верхним и нижним меньше 15 — проверь, не перепутаны ли цифры.
          </p>
        )}
        {savedFlag > 0 && (
          <div className="mt-2.5 rounded-[3px] border border-line bg-surface-2 p-3" style={{ borderLeft: "2px solid var(--warn)" }}>
            <p className="font-sans text-[12px] leading-[1.55] text-ink-2">{FLAG_TEXTS[savedFlag as 1 | 2]}</p>
          </div>
        )}
        <p className="mt-2 font-sans text-[10.5px] leading-relaxed text-ink-4">
          Измеряй сидя, после 5 минут покоя: спина с опорой, манжета на уровне сердца,
          ноги не скрещены. Не сразу после кофе, еды или подъёма по лестнице.
        </p>
      </div>

      {/* ── История ── */}
      {days.length > 0 && (
        <div className="mt-3.5 overflow-hidden rounded-card border border-line bg-surface">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-line">
                <th className="py-2.5 pl-3.5 pr-2 text-left font-mono text-[9px] uppercase tracking-[0.1em] text-ink-3">дата</th>
                <th className="px-2 py-2.5 text-left font-mono text-[9px] uppercase tracking-[0.1em] text-ink-3">утро</th>
                <th className="py-2.5 pl-2 pr-3.5 text-left font-mono text-[9px] uppercase tracking-[0.1em] text-ink-3">вечер</th>
              </tr>
            </thead>
            <tbody>
              {days.map((d, i) => {
                const m = byKey.get(`${d}:morning`);
                const e = byKey.get(`${d}:evening`);
                const cell = (r: BpReading | undefined) =>
                  r ? (
                    <button
                      type="button"
                      onClick={() => loadCell(r)}
                      className="text-left"
                    >
                      <span className={`font-mono text-[13px] font-semibold ${pregnant && pregnantFlagLevel(r.systolic, r.diastolic) > 0 ? "text-warn" : "text-ink"}`}>
                        {r.systolic}/{r.diastolic}
                      </span>
                      {r.pulse != null && (
                        <span className="ml-1 font-mono text-[10px] text-ink-4">♥{r.pulse}</span>
                      )}
                    </button>
                  ) : (
                    <span className="font-mono text-[11px] text-ink-4">—</span>
                  );
                return (
                  <tr key={d} className={i > 0 ? "border-t border-line" : ""}>
                    <td className="py-2.5 pl-3.5 pr-2 font-mono text-[11px] text-ink-3">{fmtDate(d)}</td>
                    <td className="px-2 py-2.5">{cell(m)}</td>
                    <td className="py-2.5 pl-2 pr-3.5">{cell(e)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {days.length > 0 && (
        <p className="mt-2 font-mono text-[9px] text-ink-4">
          нажми на значение, чтобы исправить или удалить
        </p>
      )}
    </>
  );
}
