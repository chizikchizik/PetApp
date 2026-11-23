"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type SaveResult = { ok: boolean; error?: string };
export type SaveState = "idle" | "saving" | "saved" | "error";
export type SaveRunner = (fn: () => Promise<SaveResult>, onFail?: () => void) => void;

// Все записи дня уходят по одной, строго по очереди: каждое серверное
// действие перечитывает строку дня, и параллельные вызовы могли бы
// перезаписать друг друга.
export function useSaveQueue() {
  const chain = useRef<Promise<void>>(Promise.resolve());
  const pending = useRef(0);
  const [state, setState] = useState<SaveState>("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (state !== "saved") return;
    const t = setTimeout(() => setState("idle"), 1600);
    return () => clearTimeout(t);
  }, [state]);

  const run = useCallback((fn: () => Promise<SaveResult>, onFail?: () => void) => {
    pending.current += 1;
    setState("saving");
    chain.current = chain.current.then(async () => {
      let res: SaveResult;
      try {
        res = await fn();
      } catch {
        res = { ok: false };
      }
      pending.current -= 1;
      if (!res.ok) {
        setError(res.error ?? "Не сохранилось. Проверь интернет и попробуй ещё раз.");
        setState("error");
        onFail?.();
      } else if (pending.current === 0) {
        setError(null);
        setState("saved");
      }
    });
  }, []);

  return { state, error, run };
}

export function SaveStatus({ state, error }: { state: SaveState; error: string | null }) {
  if (state === "idle") return null;
  const text = state === "saving" ? "сохраняю…" : state === "saved" ? "сохранено ✓" : error;
  return (
    <div
      role="status"
      className={`pointer-events-none fixed left-1/2 z-40 -translate-x-1/2 rounded-full border px-3.5 py-1.5 font-mono text-[12px] shadow-sm ${
        state === "error" ? "border-warn bg-warn-soft text-warn" : "border-line bg-surface text-ink-2"
      }`}
      style={{ bottom: "calc(5.25rem + env(safe-area-inset-bottom))" }}
    >
      {text}
    </div>
  );
}

