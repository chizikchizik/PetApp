"use client";

import { useEffect, useRef, useState } from "react";

// Ширина контейнера в px — чтобы рисовать SVG в натуральную величину
// (viewBox = реальная ширина) и подписи оставались 10–11 px на любом экране,
// а не сжимались вместе с графиком (QA раунд 8). До замера — null.
export function useWidth<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState<number | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = Math.round(entries[0]?.contentRect.width ?? 0);
      if (w > 0) setWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}
