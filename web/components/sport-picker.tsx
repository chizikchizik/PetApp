"use client";

import { useState } from "react";
import { DEFAULT_SPORT_TYPES, orderForPicker, type SportType } from "@/lib/sports";
import { sportColor } from "@/lib/sport-colors";

export const OTHER_SPORT = "__other__";

// Сколько видов видно сразу; остальные — под «ещё N».
const VISIBLE = 5;

// Выбор вида тренировки: свой список пользовательницы, последние виды
// первыми (lib/sports.ts). Новый вид — через «Другое»; он попадёт в список
// после первой записанной тренировки.
export function SportPicker({
  types,
  value,
  custom,
  onPick,
  onCustom,
}: {
  types: SportType[];
  value: string | null;
  custom: string;
  onPick: (type: string) => void;
  onCustom: (text: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const list = types.length
    ? orderForPicker(types)
    : DEFAULT_SPORT_TYPES.map((name, i) => ({ name, color: sportColor(i), suggested: true }));
  const fold = list.length > VISIBLE + 1;
  const shown = !fold || expanded ? list : list.slice(0, VISIBLE);
  // Выбранный вид из свёрнутой части не прячем.
  const picked = fold && !expanded ? list.slice(VISIBLE).find((t) => t.name === value) : undefined;
  const chips = picked ? [...shown, picked] : shown;
  const hidden = fold ? list.length - VISIBLE - (picked ? 1 : 0) : 0;

  // Подсказок из стандартного списка при вводе нет: удалённый вид (как
  // «Силовая» у Марины) не должен возвращаться.
  const known = new Set(list.map((t) => t.name.toLowerCase()));
  const customTrim = custom.trim();
  const customKnown = customTrim && known.has(customTrim.toLowerCase());

  return (
    <div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {chips.map((t) => {
          const on = value === t.name;
          return (
            <button
              key={t.name}
              type="button"
              aria-pressed={on}
              onClick={() => onPick(t.name)}
              className={`flex min-h-[44px] items-center gap-1.5 rounded-[3px] border px-3 font-sans text-[13px] transition ${
                on ? "border-transparent font-semibold text-white" : "border-line bg-surface text-ink-2"
              }`}
              style={on ? { background: t.color, borderColor: t.color } : {}}
            >
              <span
                className="inline-block h-2 w-2 shrink-0 rounded-full transition"
                style={{ background: on ? "rgba(255,255,255,0.8)" : t.color }}
              />
              {t.name}
            </button>
          );
        })}
        {fold && (
          <button
            type="button"
            aria-expanded={expanded}
            onClick={() => setExpanded((v) => !v)}
            className="min-h-[44px] px-2 font-mono text-[12px] text-ink-2 underline underline-offset-2"
          >
            {expanded ? "свернуть" : `ещё ${hidden}`}
          </button>
        )}
        <button
          type="button"
          aria-pressed={value === OTHER_SPORT}
          onClick={() => onPick(OTHER_SPORT)}
          className={`min-h-[44px] rounded-[3px] border px-3 font-sans text-[13px] transition ${
            value === OTHER_SPORT ? "border-ink-2 bg-ink-2 font-semibold text-surface" : "border-line text-ink-3"
          }`}
        >
          Другое
        </button>
      </div>
      {value === OTHER_SPORT && (
        <>
          <input
            type="text"
            value={custom}
            onChange={(e) => onCustom(e.target.value)}
            placeholder="Название занятия…"
            maxLength={40}
            autoFocus
            aria-label="Название занятия"
            className="mt-2 min-h-[44px] w-full rounded-[3px] border border-line bg-surface px-3.5 text-[14px] text-ink placeholder:text-ink-3 outline-none focus:border-phase"
          />
          {customTrim && !customKnown && (
            <p className="mt-1 font-mono text-[11px] text-ink-3">«{customTrim}» появится в твоём списке видов</p>
          )}
        </>
      )}
    </div>
  );
}
