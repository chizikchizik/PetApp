"use client";

import { useRef, useState } from "react";
import { uploadRecord } from "./actions";

const CATEGORIES = [
  { value: "analysis", label: "Анализ" },
  { value: "prescription", label: "Назначение" },
  { value: "referral", label: "Направление" },
  { value: "diagnosis", label: "Диагноз" },
  { value: "vaccination", label: "Прививка" },
  { value: "other", label: "Документ" },
];

type Status = "idle" | "uploading" | "done" | "error";

export function UploadForm() {
  const [open, setOpen] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("other");
  const [recordDate, setRecordDate] = useState("");
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [storageWarning, setStorageWarning] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function resetForm() {
    setFile(null);
    setTitle("");
    setCategory("other");
    setRecordDate("");
    setNote("");
    setStorageWarning(false);
    setErrorMsg(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) {
      setFile(dropped);
      if (!title) setTitle(dropped.name.replace(/\.[^.]+$/, ""));
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0] ?? null;
    if (picked) {
      setFile(picked);
      if (!title) setTitle(picked.name.replace(/\.[^.]+$/, ""));
    }
  }

  async function handleSubmit() {
    if (!title.trim()) return;
    setStatus("uploading");
    setStorageWarning(false);
    setErrorMsg(null);

    const fd = new FormData();
    fd.append("title", title);
    fd.append("category", category);
    fd.append("record_date", recordDate);
    fd.append("note", note);
    if (file) fd.append("file", file);

    const res = await uploadRecord(fd);
    if (res.ok) {
      setStatus("done");
      setStorageWarning(!!res.storageWarning);
      resetForm();
      setTimeout(() => {
        setStatus("idle");
        setStorageWarning(false);
      }, 3000);
    } else {
      setStatus("error");
      setErrorMsg(res.error ?? "Ошибка загрузки");
      setTimeout(() => setStatus("idle"), 3000);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3.5 flex w-full items-center justify-center gap-2.5 rounded-card border border-dashed border-line py-4 font-mono text-[12px] tracking-[0.08em] uppercase text-ink-2 transition active:scale-[0.99]"
      >
        + добавить документ
      </button>
    );
  }

  return (
    <div className="mt-3.5 space-y-4 rounded-card border border-line bg-surface p-4">
      {/* Drag & drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`cursor-pointer rounded-card p-8 text-center transition ${
          dragOver
            ? "border-2 border-dashed border-phase bg-phase-soft"
            : "border-2 border-dashed border-line"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,application/pdf,.doc,.docx"
          className="hidden"
          onChange={handleFileChange}
        />
        {file ? (
          <div className="space-y-1">
            <div className="font-sans text-[13px] font-semibold text-ink">{file.name}</div>
            <div className="font-mono text-[10px] text-ink-3">
              {(file.size / 1024).toFixed(0)} KB
            </div>
          </div>
        ) : (
          <div className="space-y-1">
            <svg
              viewBox="0 0 24 24"
              className="mx-auto h-8 w-8 text-ink-3"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <p className="font-mono text-[11px] text-ink-2">Перетащи файл или нажми</p>
            <p className="font-mono text-[10px] text-ink-4">PDF, изображения, DOC</p>
          </div>
        )}
      </div>

      {/* Title */}
      <div>
        <p className="font-mono text-[10px] tracking-[0.14em] uppercase text-ink-3">
          название <span className="text-phase">*</span>
        </p>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Анализ крови, назначение невролога…"
          className="mt-2 w-full rounded-[3px] border border-line bg-surface px-4 py-2.5 text-[14px] text-ink placeholder:text-ink-3 outline-none focus:border-phase"
        />
      </div>

      {/* Category */}
      <div>
        <p className="font-mono text-[10px] tracking-[0.14em] uppercase text-ink-3">категория</p>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="mt-2 w-full rounded-[3px] border border-line bg-surface px-4 py-2.5 text-[14px] text-ink outline-none focus:border-phase"
        >
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      {/* Date */}
      <div>
        <p className="font-mono text-[10px] tracking-[0.14em] uppercase text-ink-3">дата документа</p>
        <input
          type="date"
          value={recordDate}
          onChange={(e) => setRecordDate(e.target.value)}
          className="mt-2 w-full rounded-[3px] border border-line bg-surface px-4 py-2.5 text-[14px] text-ink outline-none focus:border-phase"
        />
      </div>

      {/* Note */}
      <div>
        <p className="font-mono text-[10px] tracking-[0.14em] uppercase text-ink-3">заметка</p>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Комментарий к документу…"
          rows={2}
          className="mt-2 w-full resize-none rounded-[3px] border border-line bg-surface px-4 py-3 text-[15px] text-ink placeholder:text-ink-3 outline-none focus:border-phase"
        />
      </div>

      {/* Storage warning */}
      {storageWarning && (
        <div className="rounded-[3px] border border-yellow-400/50 bg-yellow-50/10 px-4 py-3 font-mono text-[11px] text-yellow-600">
          Файл не сохранён в Storage. Создай bucket &lsquo;medical-records&rsquo; в Supabase.
        </div>
      )}

      {/* Error */}
      {status === "error" && errorMsg && (
        <div className="rounded-[3px] border border-red-400/40 bg-red-50/10 px-4 py-2.5 font-mono text-[11px] text-red-500">
          {errorMsg}
        </div>
      )}

      {/* Buttons */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => { setOpen(false); resetForm(); setStatus("idle"); }}
          className="rounded-[3px] border border-line px-4 py-3 text-[13px] font-medium text-ink-3"
        >
          Отмена
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!title.trim() || status === "uploading"}
          className="flex-1 rounded-[3px] bg-phase py-3 text-[13px] font-semibold text-on-phase transition active:scale-[0.99] disabled:opacity-50"
        >
          {status === "uploading"
            ? "Загружаю…"
            : status === "done"
            ? "Загружено ✓"
            : status === "error"
            ? "Ошибка — повторить"
            : "Загрузить"}
        </button>
      </div>
    </div>
  );
}
