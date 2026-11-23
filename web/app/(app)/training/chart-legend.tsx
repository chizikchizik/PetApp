"use client";
import { useCallback, useLayoutEffect, useRef, useState } from "react";

// minor — редкий пункт (например, вид спорта с одной тренировкой за период):
// всегда прячется под «ещё», даже если место в строках есть.
export type LegendItem = { key: string; label: string; color: string; circle?: boolean; minor?: boolean };

const ROW_PX = 16; // leading-4 у подписи
const GAP_Y_PX = 4; // gap-y-1

function Swatch({ color, circle }: { color: string; circle?: boolean }) {
  return circle ? (
    <svg width={9} height={9} aria-hidden className="shrink-0"><circle cx={4.5} cy={4.5} r={4.5} fill={color} /></svg>
  ) : (
    <svg width={9} height={9} aria-hidden className="shrink-0"><rect width={9} height={9} rx={2} fill={color} /></svg>
  );
}

function Item({ item }: { item: LegendItem }) {
  return (
    <span data-legend-item className="flex items-center gap-1.5 whitespace-nowrap">
      <Swatch color={item.color} circle={item.circle} />
      <span className="font-mono text-[11px] leading-4 text-ink-2">{item.label}</span>
    </span>
  );
}

// after: — невидимая зона касания 44px вокруг короткой подписи, строку не раздувает.
const toggleCls = "relative font-mono text-[11px] leading-4 text-ink-2 underline underline-offset-2 after:absolute after:-inset-x-2 after:-inset-y-3.5 after:content-['']";

// Легенда в `rows` строк: всё, что не помещается, и редкие пункты прячутся
// под «ещё N».
// Сколько помещается, считаем по невидимой копии на всю ширину — так
// результат не зависит от того, что сейчас показано, и пересчитывается
// при смене ширины экрана и после загрузки шрифтов.
export function ChartLegend({ items, rows = 2 }: { items: LegendItem[]; rows?: number }) {
  const mirrorRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLSpanElement>(null);
  const [fit, setFit] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(false);
  const itemsKey = items.map((i) => `${i.key}${i.minor ? "*" : ""}`).join("|");
  const primary = items.filter((i) => !i.minor);
  const minorCount = items.length - primary.length;

  const measure = useCallback(() => {
    const box = mirrorRef.current;
    const toggle = toggleRef.current;
    if (!box || !toggle) return;
    const els = Array.from(box.querySelectorAll<HTMLElement>("[data-legend-item]"));
    const tops = [...new Set(els.map((e) => e.offsetTop))].sort((a, b) => a - b);
    // Всё влезло и прятать нечего — или влезло со свободной строкой под «ещё».
    if (tops.length < rows || (tops.length === rows && minorCount === 0)) { setFit(els.length); return; }
    const lastTop = tops[rows - 1];
    let k = els.filter((e) => e.offsetTop <= lastTop).length;
    const gapX = parseFloat(getComputedStyle(box).columnGap) || 0;
    // Кнопка «ещё N» должна встать в последнюю разрешённую строку.
    while (k > 0) {
      const last = els[k - 1];
      if (last.offsetTop < lastTop) break;
      if (last.offsetLeft + last.offsetWidth + gapX + toggle.offsetWidth <= box.clientWidth) break;
      k--;
    }
    setFit(k);
  }, [rows, minorCount]);

  useLayoutEffect(() => {
    measure();
    const box = mirrorRef.current;
    if (!box) return;
    const ro = new ResizeObserver(measure);
    ro.observe(box);
    document.fonts?.ready.then(measure).catch(() => {});
    return () => ro.disconnect();
  }, [measure, itemsKey]);

  if (items.length === 0) return null;
  const shown = expanded ? items : fit == null ? primary : primary.slice(0, fit);
  const hidden = items.length - shown.length;
  // До первого замера (серверный рендер) просто обрезаем по высоте.
  const clampStyle = fit == null && !expanded ? { maxHeight: rows * ROW_PX + (rows - 1) * GAP_Y_PX, overflow: "hidden" } : undefined;

  return (
    <div className="relative mt-2">
      <div className="flex flex-wrap gap-x-4 gap-y-1" style={clampStyle}>
        {shown.map((it) => <Item key={it.key} item={it} />)}
        {hidden > 0 && (
          <button type="button" onClick={() => setExpanded(true)} className={toggleCls}>
            ещё {hidden}
          </button>
        )}
        {expanded && fit != null && fit < primary.length + minorCount && (
          <button type="button" onClick={() => setExpanded(false)} className={toggleCls}>
            свернуть
          </button>
        )}
      </div>

      {/* Невидимая копия для замера */}
      <div
        ref={mirrorRef}
        aria-hidden
        className="pointer-events-none invisible absolute inset-x-0 top-0 flex flex-wrap gap-x-4 gap-y-1"
      >
        {primary.map((it) => <Item key={it.key} item={it} />)}
        <span ref={toggleRef} className={`${toggleCls} absolute`}>ещё {items.length}</span>
      </div>
    </div>
  );
}
