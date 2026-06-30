import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getRecords } from "./actions";
import { UploadForm } from "./upload-form";
import { DeleteButton } from "./delete-button";

export const dynamic = "force-dynamic";

const CATEGORY_LABELS: Record<string, string> = {
  analysis: "Анализ",
  prescription: "Назначение",
  referral: "Направление",
  diagnosis: "Диагноз",
  vaccination: "Прививка",
  other: "Документ",
};

function formatDate(iso: string | null) {
  if (!iso) return null;
  const d = new Date(iso + (iso.length === 10 ? "T12:00:00" : ""));
  const MONTHS = ["янв","фев","мар","апр","май","июн","июл","авг","сен","окт","ноя","дек"];
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function getPublicUrl(filePath: string): string {
  const db = supabaseAdmin();
  if (!db) return "#";
  return db.storage.from("medical-records").getPublicUrl(filePath).data.publicUrl;
}

export default async function MedicalPage() {
  const records = await getRecords();

  return (
    <>
      {/* Header */}
      <Link
        href="/dashboard"
        className="font-mono text-[10px] tracking-[0.14em] uppercase text-ink-3"
      >
        ← дашборд
      </Link>
      <h1 className="mt-3 font-serif font-bold text-[24px] uppercase">МЕДКНИЖКА</h1>
      <p className="mt-2 font-mono text-[11px] text-ink-2">анализы, назначения, направления</p>

      {/* Import links */}
      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href="/import/migrebot"
          className="inline-flex items-center gap-1.5 rounded-[3px] border border-line bg-surface px-3.5 py-2 font-mono text-[11px] text-ink-2 transition active:bg-surface-2"
        >
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Импорт из Migrebot
        </Link>
      </div>

      {/* Upload form */}
      <UploadForm />

      {/* Records list */}
      {records.length > 0 && (
        <div className="mt-5 space-y-2">
          <p className="font-mono text-[10px] tracking-[0.14em] uppercase text-ink-3">
            документы · {records.length}
          </p>
          {records.map((r) => {
            const publicUrl = r.file_path ? getPublicUrl(r.file_path) : null;
            const displayDate = formatDate(r.record_date) ?? formatDate(r.created_at.slice(0, 10));
            return (
              <div
                key={r.id}
                className="rounded-card border border-line bg-surface p-4 flex gap-3"
              >
                {/* Category badge */}
                <div className="shrink-0 pt-0.5">
                  <span className="rounded-[2px] px-2 py-1 font-mono text-[9px] uppercase bg-surface-3 text-ink-3">
                    {CATEGORY_LABELS[r.category] ?? r.category}
                  </span>
                </div>

                {/* Content */}
                <div className="min-w-0 flex-1">
                  <div className="font-sans font-semibold text-[14px] text-ink leading-snug">
                    {r.title}
                  </div>
                  {displayDate && (
                    <div className="mt-1 font-mono text-[10px] text-ink-3">{displayDate}</div>
                  )}
                  {r.note && (
                    <p className="mt-1.5 font-sans text-[12.5px] leading-[1.5] text-ink-2">
                      {r.note}
                    </p>
                  )}
                  <div className="mt-2 flex items-center gap-3">
                    {publicUrl && (
                      <a
                        href={publicUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-[10px] tracking-[0.06em] uppercase"
                        style={{ color: "var(--phase)" }}
                      >
                        скачать ↓
                      </a>
                    )}
                    <DeleteButton id={r.id} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {records.length === 0 && (
        <p className="mt-6 font-mono text-[13px] text-ink-3">
          Документов пока нет. Добавь первый.
        </p>
      )}

      {/* Storage setup notice */}
      <p className="mt-6 font-mono text-[10px] text-ink-4">
        Для хранения файлов: Supabase → Storage → New bucket → &ldquo;medical-records&rdquo; → private
      </p>
    </>
  );
}
