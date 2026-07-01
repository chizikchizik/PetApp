"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { uploadRecord } from "./actions";

const CATEGORIES = [
  { value: "analysis",     label: "Анализ" },
  { value: "visit",        label: "Приём врача" },
  { value: "prescription", label: "Назначение" },
  { value: "referral",     label: "Направление" },
  { value: "diagnosis",    label: "Диагноз / заключение" },
  { value: "imaging",      label: "Снимок / УЗИ" },
  { value: "discharge",    label: "Выписка" },
  { value: "vaccination",  label: "Прививка" },
  { value: "other",        label: "Другое" },
];

// Common subcategories per category
const SUBCATS: Record<string, string[]> = {
  analysis: ["ОАК","Биохимия","Гормоны","Витамины","Коагулограмма","ОАМ","ПЦР","Посев","УЗИ крови"],
  visit:    ["Невролог","Гинеколог","Терапевт","Кардиолог","Офтальмолог","Дерматолог","Эндокринолог","Ортопед","Психиатр"],
  imaging:  ["МРТ","КТ","Рентген","УЗИ","ЭКГ","ФГДС"],
};

type Status = "idle" | "uploading" | "done" | "error";

const lbl = "font-mono text-[10px] tracking-[0.14em] uppercase text-ink-3";
const inp = "mt-1.5 w-full rounded-[3px] border border-line bg-surface px-3.5 py-2.5 text-[14px] text-ink placeholder:text-ink-3 outline-none focus:border-phase";

export function UploadForm() {
  const router = useRouter();
  const [open, setOpen]           = useState(false);
  const [dragOver, setDragOver]   = useState(false);
  const [file, setFile]           = useState<File | null>(null);
  const [title, setTitle]         = useState("");
  const [category, setCategory]   = useState("analysis");
  const [subcat, setSubcat]       = useState("");
  const [recordDate, setDate]     = useState("");
  const [doctor, setDoctor]       = useState("");
  const [clinic, setClinic]       = useState("ЕМИАС");
  const [note, setNote]           = useState("");
  const [status, setStatus]       = useState<Status>("idle");
  const [storageWarn, setStorageWarn] = useState(false);
  const [errorMsg, setErrorMsg]   = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function reset() {
    setFile(null); setTitle(""); setCategory("analysis"); setSubcat("");
    setDate(""); setDoctor(""); setClinic("ЕМИАС"); setNote("");
    setStorageWarn(false); setErrorMsg(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  function pickFile(f: File) {
    setFile(f);
    if (!title) setTitle(f.name.replace(/\.[^.]+$/, "").replace(/_/g, " "));
  }

  async function submit() {
    if (!title.trim()) return;
    setStatus("uploading");
    const fd = new FormData();
    fd.append("title", title);
    fd.append("category", category);
    fd.append("subcategory", subcat);
    fd.append("record_date", recordDate);
    fd.append("doctor", doctor);
    fd.append("clinic", clinic);
    fd.append("note", note);
    if (file) fd.append("file", file);

    const res = await uploadRecord(fd);
    if (res.ok) {
      setStorageWarn(!!res.storageWarning);
      setStatus("done");
      reset();
      router.refresh();
      setTimeout(() => { setStatus("idle"); setStorageWarn(false); }, 2500);
    } else {
      setStatus("error");
      setErrorMsg(res.error ?? "Ошибка");
      setTimeout(() => setStatus("idle"), 3000);
    }
  }

  const subcatOptions = SUBCATS[category] ?? [];

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-center gap-2.5 rounded-card border border-dashed border-line py-4 font-mono text-[12px] tracking-[0.08em] uppercase text-ink-2 transition active:scale-[0.99]"
      >
        + добавить документ
      </button>
    );
  }

  return (
    <div className="rounded-card border border-line bg-surface">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <span className="font-mono text-[10px] tracking-[0.14em] uppercase text-ink-2">Новый документ</span>
        <button type="button" onClick={() => { setOpen(false); reset(); }} className="font-mono text-[18px] leading-none text-ink-3">×</button>
      </div>

      <div className="space-y-3.5 p-4">
        {/* Drop zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) pickFile(f); }}
          onClick={() => fileRef.current?.click()}
          className={`cursor-pointer rounded-[3px] border-2 border-dashed px-4 py-5 text-center transition ${
            dragOver ? "border-phase bg-phase/5" : "border-line"
          }`}
        >
          <input ref={fileRef} type="file" accept="image/*,application/pdf,.doc,.docx" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) pickFile(f); }} />
          {file ? (
            <div>
              <p className="font-sans text-[13px] font-semibold text-ink">{file.name}</p>
              <p className="font-mono text-[10px] text-ink-3 mt-0.5">{(file.size/1024).toFixed(0)} KB</p>
            </div>
          ) : (
            <div>
              <p className="font-mono text-[12px] text-ink-2">↑ Перетащи PDF или фото</p>
              <p className="font-mono text-[10px] text-ink-4 mt-0.5">или нажми чтобы выбрать</p>
            </div>
          )}
        </div>

        {/* Category */}
        <div>
          <p className={lbl}>Категория</p>
          <select value={category} onChange={(e) => { setCategory(e.target.value); setSubcat(""); }}
            className={inp}>
            {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>

        {/* Subcategory */}
        {subcatOptions.length > 0 && (
          <div>
            <p className={lbl}>Уточнение</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {subcatOptions.map((s) => (
                <button key={s} type="button"
                  onClick={() => setSubcat(subcat === s ? "" : s)}
                  className={`rounded-[3px] border px-2.5 py-1 font-sans text-[12px] transition ${
                    subcat === s ? "border-phase bg-phase text-on-phase" : "border-line text-ink-3"
                  }`}
                >
                  {s}
                </button>
              ))}
              <input type="text" value={subcatOptions.includes(subcat) ? "" : subcat}
                onChange={(e) => setSubcat(e.target.value)}
                placeholder="другое…"
                className="rounded-[3px] border border-line bg-surface px-2.5 py-1 text-[12px] text-ink placeholder:text-ink-4 outline-none focus:border-phase w-[90px]" />
            </div>
          </div>
        )}

        {/* Title */}
        <div>
          <p className={lbl}>Название <span className="text-phase">*</span></p>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
            placeholder="Анализ крови общий, МРТ головы…" className={inp} autoFocus={!file} />
        </div>

        {/* Date + Doctor */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className={lbl}>Дата</p>
            <input type="date" value={recordDate} onChange={(e) => setDate(e.target.value)} className={inp} />
          </div>
          <div>
            <p className={lbl}>Врач</p>
            <input type="text" value={doctor} onChange={(e) => setDoctor(e.target.value)}
              placeholder="Фамилия И.О." className={inp} />
          </div>
        </div>

        {/* Clinic */}
        <div>
          <p className={lbl}>Клиника / источник</p>
          <input type="text" value={clinic} onChange={(e) => setClinic(e.target.value)}
            placeholder="ЕМИАС, Инвитро, Гемотест…" className={inp} />
        </div>

        {/* Note */}
        <div>
          <p className={lbl}>Заметка / результат</p>
          <textarea value={note} onChange={(e) => setNote(e.target.value)}
            placeholder="Ключевые показатели, выводы врача…" rows={2}
            className={`${inp} resize-none`} />
        </div>

        {storageWarn && (
          <div className="rounded-[3px] border border-warn/40 bg-warn/5 px-3 py-2 font-mono text-[10px] text-warn">
            Запись сохранена, но файл не загрузился — создай бакет «medical-records» в Supabase Storage
          </div>
        )}
        {status === "error" && errorMsg && (
          <div className="rounded-[3px] border border-red-400/40 px-3 py-2 font-mono text-[10px] text-red-500">{errorMsg}</div>
        )}

        <div className="flex gap-2 pt-0.5">
          <button type="button" onClick={() => { setOpen(false); reset(); }}
            className="rounded-[3px] border border-line px-4 py-3 text-[13px] text-ink-3">
            Отмена
          </button>
          <button type="button" onClick={submit} disabled={!title.trim() || status === "uploading"}
            className="flex-1 rounded-[3px] bg-phase py-3 text-[13px] font-semibold text-on-phase disabled:opacity-50">
            {status === "uploading" ? "Загружаю…" : status === "done" ? "Загружено ✓" : status === "error" ? "Ошибка" : "Сохранить"}
          </button>
        </div>
      </div>
    </div>
  );
}
