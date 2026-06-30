"use client";

import { useState, useRef } from "react";
import { previewCSV, importCSV, type PreviewStats } from "./actions";

const labelCls = "font-mono text-[10px] tracking-[0.14em] uppercase text-ink-3";

function fmtDate(iso: string) {
  const d = new Date(iso + "T12:00:00");
  const MONTHS = ["янв","фев","мар","апр","май","июн","июл","авг","сен","окт","ноя","дек"];
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function MigreBotImportForm() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [csvText, setCsvText] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewStats | null>(null);
  const [status, setStatus] = useState<"idle" | "parsing" | "importing" | "done" | "error">("idle");
  const [result, setResult] = useState<{ imported: number; skipped: number } | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatus("parsing");
    setPreview(null);
    setResult(null);
    setErrorMsg("");

    try {
      const text = await file.text();
      const res = await previewCSV(text);
      if (!res.ok) {
        setStatus("error");
        setErrorMsg(res.error ?? "Ошибка парсинга");
        return;
      }
      setCsvText(text);
      setPreview(res.stats!);
      setStatus("idle");
    } catch {
      setStatus("error");
      setErrorMsg("Не удалось прочитать файл");
    }
  }

  async function handleImport() {
    if (!csvText) return;
    setStatus("importing");
    const res = await importCSV(csvText);
    if (!res.ok) {
      setStatus("error");
      setErrorMsg(res.error ?? "Ошибка импорта");
      return;
    }
    setResult(res.result!);
    setStatus("done");
    setPreview(null);
    setCsvText(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  function reset() {
    setStatus("idle");
    setPreview(null);
    setCsvText(null);
    setResult(null);
    setErrorMsg("");
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <div className="mt-5 space-y-4">
      {/* File picker */}
      {status !== "done" && (
        <div>
          <span className={labelCls}>CSV файл из Migrebot</span>
          <label className="mt-2 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-card border-2 border-dashed border-line bg-surface px-4 py-8 transition hover:border-phase">
            <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-ink-3">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <span className="font-mono text-[12px] text-ink-3">
              {status === "parsing" ? "Читаю файл…" : "Выбрать CSV файл"}
            </span>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              onChange={handleFile}
              disabled={status === "parsing" || status === "importing"}
            />
          </label>
          <p className="mt-2 font-mono text-[10px] text-ink-4">
            Экспортируй данные из Migrebot: «Настройки → Экспорт данных → CSV»
          </p>
        </div>
      )}

      {/* Preview */}
      {preview && status === "idle" && (
        <div className="rounded-card border border-line bg-surface p-4 space-y-3">
          <p className={labelCls}>Найдено в файле</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="font-mono text-[10px] text-ink-3">Всего дней</p>
              <p className="font-serif text-[28px] font-bold text-ink">{preview.totalRows}</p>
            </div>
            <div>
              <p className="font-mono text-[10px] text-ink-3">С мигренью</p>
              <p className="font-serif text-[28px] font-bold text-phase">{preview.migraineRows}</p>
            </div>
          </div>
          <p className="font-mono text-[11px] text-ink-2">
            Период: {fmtDate(preview.dateFrom)} — {fmtDate(preview.dateTo)}
          </p>
          <p className="font-mono text-[10px] text-ink-3">
            Импортируем все записи (мигрень + чистые дни). Не затронем твои вес/привычки/настроение.
          </p>
          <button
            type="button"
            onClick={handleImport}
            className="w-full rounded-[3px] bg-phase py-3.5 font-sans text-[15px] font-semibold text-on-phase shadow-sm transition active:scale-[0.99]"
          >
            Импортировать
          </button>
          <button
            type="button"
            onClick={reset}
            className="w-full font-mono text-[11px] text-ink-3"
          >
            Отмена
          </button>
        </div>
      )}

      {/* Importing */}
      {status === "importing" && (
        <div className="rounded-card border border-line bg-surface p-6 text-center">
          <p className="font-mono text-[13px] text-ink-2">Импортирую данные…</p>
          <p className="mt-1 font-mono text-[10px] text-ink-4">Это займёт несколько секунд</p>
        </div>
      )}

      {/* Done */}
      {status === "done" && result && (
        <div className="rounded-card border border-phase bg-phase-soft p-5 space-y-2">
          <p className="font-mono text-[10px] tracking-[0.14em] uppercase text-phase-deep">
            Импорт завершён ✓
          </p>
          <p className="font-sans text-[15px] font-semibold text-ink">
            {result.imported} дней импортировано
          </p>
          <p className="font-mono text-[11px] text-ink-2">
            из них с мигренью: {result.skipped}
          </p>
          <button
            type="button"
            onClick={reset}
            className="mt-2 font-mono text-[11px] text-phase-deep underline underline-offset-2"
          >
            Импортировать ещё один файл
          </button>
        </div>
      )}

      {/* Error */}
      {status === "error" && (
        <div className="rounded-card border border-warn bg-warn-soft p-4 space-y-2">
          <p className="font-mono text-[10px] text-warn">Ошибка</p>
          <p className="font-sans text-[13px] text-ink">{errorMsg}</p>
          <button
            type="button"
            onClick={reset}
            className="font-mono text-[11px] text-ink-3 underline underline-offset-2"
          >
            Попробовать снова
          </button>
        </div>
      )}
    </div>
  );
}
