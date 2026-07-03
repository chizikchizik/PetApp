import Link from "next/link";
import { getRecords, getSignedUrl } from "./actions";
import { getMeds } from "@/lib/data";
import { UploadForm } from "./upload-form";
import { DeleteButton } from "./delete-button";

export const dynamic = "force-dynamic";

export const CATEGORY_LABELS: Record<string, string> = {
  analysis:     "Анализ",
  visit:        "Приём",
  prescription: "Назначение",
  referral:     "Направление",
  diagnosis:    "Диагноз",
  vaccination:  "Прививка",
  imaging:      "Снимок / УЗИ",
  discharge:    "Выписка",
  other:        "Документ",
};

const CATEGORY_ORDER = ["analysis","visit","prescription","referral","diagnosis","imaging","discharge","vaccination","other"];

const CAT_COLOR: Record<string, string> = {
  analysis:     "var(--phase)",
  visit:        "#8f5ec8",
  prescription: "#2aa09a",
  referral:     "#e8a23a",
  diagnosis:    "#d04830",
  imaging:      "#5880e0",
  discharge:    "#48a060",
  vaccination:  "#c05890",
  other:        "var(--ink-4)",
};

function formatDate(iso: string | null) {
  if (!iso) return null;
  const d = new Date(iso + (iso.length === 10 ? "T12:00:00" : ""));
  const M = ["янв","фев","мар","апр","май","июн","июл","авг","сен","окт","ноя","дек"];
  return `${d.getDate()} ${M[d.getMonth()]} ${d.getFullYear()}`;
}

function formatSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function groupByYear(records: Awaited<ReturnType<typeof getRecords>>) {
  const years = new Map<string, typeof records>();
  for (const r of records) {
    const y = (r.record_date ?? r.created_at).slice(0, 4);
    if (!years.has(y)) years.set(y, []);
    years.get(y)!.push(r);
  }
  return [...years.entries()].sort((a, b) => b[0].localeCompare(a[0]));
}

export default async function MedicalPage() {
  const [records, meds] = await Promise.all([getRecords(), getMeds()]);

  // Pre-resolve signed URLs for all records with files (server-side, 1h TTL)
  const signedUrls = new Map<string, string>();
  await Promise.all(
    records
      .filter((r) => r.file_path)
      .map(async (r) => {
        const url = await getSignedUrl(r.file_path!);
        if (url) signedUrls.set(r.id, url);
      })
  );

  const byYear = groupByYear(records);

  // Stats
  const countByCategory = new Map<string, number>();
  for (const r of records) {
    countByCategory.set(r.category, (countByCategory.get(r.category) ?? 0) + 1);
  }

  return (
    <>
      <Link href="/dashboard" className="font-mono text-[10px] tracking-[0.14em] uppercase text-ink-3">
        ← дашборд
      </Link>

      <div className="mt-3 flex items-start justify-between gap-3">
        <div>
          <h1 className="font-serif font-bold text-[24px] uppercase leading-tight">МЕДКНИЖКА</h1>
          <p className="mt-1 font-mono text-[11px] text-ink-3">
            анализы · приёмы · назначения · снимки
          </p>
        </div>
        {records.length > 0 && (
          <span className="mt-1 font-mono text-[22px] font-bold text-ink leading-none">
            {records.length}
            <span className="ml-1 font-mono text-[10px] text-ink-4">докум.</span>
          </span>
        )}
      </div>

      {/* Category summary chips */}
      {records.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {CATEGORY_ORDER.filter((c) => countByCategory.has(c)).map((c) => (
            <span
              key={c}
              className="flex items-center gap-1 rounded-[3px] px-2 py-1 font-mono text-[9px] uppercase"
              style={{ background: `${CAT_COLOR[c]}18`, color: CAT_COLOR[c] }}
            >
              {CATEGORY_LABELS[c]}
              <span className="opacity-70">{countByCategory.get(c)}</span>
            </span>
          ))}
        </div>
      )}

      {/* Текущие препараты — связь с приёмом на чек-ине/привычках */}
      {meds.length > 0 && (
        <div className="mt-4 rounded-card border border-line bg-surface p-3.5">
          <div className="flex items-center justify-between">
            <p className="font-mono text-[9px] tracking-[0.12em] uppercase text-ink-3">
              текущие препараты
            </p>
            <Link
              href="/habits/bulk"
              className="font-mono text-[10px] text-phase underline underline-offset-2"
            >
              управлять →
            </Link>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {meds.map((med) => (
              <span
                key={med.id}
                className="rounded-[3px] border border-line px-2 py-1 font-sans text-[12px] text-ink"
              >
                {med.name}
                {med.isAsNeeded ? (
                  <span className="ml-1 text-[10px] text-warn">по мигрени</span>
                ) : med.when ? (
                  <span className="ml-1 text-[10px] text-ink-3">{med.when}</span>
                ) : null}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Quick links: MigreBot + История */}
      <div className="mt-4 flex gap-2">
        <Link
          href="/checkin/meds"
          className="flex flex-1 items-center justify-between rounded-[3px] border border-line bg-surface px-3.5 py-3 active:scale-[0.99]"
        >
          <div>
            <p className="font-mono text-[9px] tracking-[0.12em] uppercase text-ink-3">препараты</p>
            <p className="mt-0.5 font-sans text-[12px] font-semibold text-ink">История мигреней</p>
          </div>
          <span className="font-mono text-[12px] text-phase">→</span>
        </Link>
        <Link
          href="/import/migrebot"
          className="flex flex-1 items-center justify-between rounded-[3px] border border-line bg-surface px-3.5 py-3 active:scale-[0.99]"
        >
          <div>
            <p className="font-mono text-[9px] tracking-[0.12em] uppercase text-ink-3">импорт</p>
            <p className="mt-0.5 font-sans text-[12px] font-semibold text-ink">MigreBot CSV</p>
          </div>
          <span className="font-mono text-[12px] text-phase">→</span>
        </Link>
      </div>

      {/* Upload form */}
      <div className="mt-3">
        <UploadForm />
      </div>

      {/* Records by year */}
      {byYear.length > 0 ? (
        <div className="mt-6 space-y-6">
          {byYear.map(([year, recs]) => (
            <div key={year}>
              <p className="mb-2 font-mono text-[10px] tracking-[0.14em] uppercase text-ink-3">
                {year} · {recs.length}
              </p>
              <div className="space-y-2">
                {recs.map((r) => {
                  const signedUrl = signedUrls.get(r.id) ?? null;
                  const displayDate = formatDate(r.record_date) ?? formatDate(r.created_at.slice(0, 10));
                  const color = CAT_COLOR[r.category] ?? "var(--ink-4)";
                  const isImage = r.file_type?.startsWith("image/");
                  const isPdf  = r.file_type === "application/pdf";

                  return (
                    <div key={r.id} className="rounded-card border border-line bg-surface">
                      <div className="flex gap-3 p-3.5">
                        {/* Color stripe */}
                        <div
                          className="mt-0.5 w-[3px] shrink-0 self-stretch rounded-full"
                          style={{ background: color }}
                        />

                        <div className="min-w-0 flex-1">
                          {/* Title + badge */}
                          <div className="flex items-start gap-2">
                            <div className="min-w-0 flex-1">
                              <span className="font-sans text-[14px] font-semibold leading-snug text-ink">
                                {r.title}
                              </span>
                              {r.subcategory && (
                                <span className="ml-1.5 font-sans text-[12px] text-ink-3">
                                  · {r.subcategory}
                                </span>
                              )}
                            </div>
                            <span
                              className="shrink-0 rounded-[2px] px-1.5 py-0.5 font-mono text-[8px] uppercase"
                              style={{ background: `${color}18`, color }}
                            >
                              {CATEGORY_LABELS[r.category] ?? r.category}
                            </span>
                          </div>

                          {/* Meta row */}
                          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                            {displayDate && (
                              <span className="font-mono text-[10px] text-ink-3">{displayDate}</span>
                            )}
                            {r.doctor && (
                              <span className="font-mono text-[10px] text-ink-3">
                                {r.doctor}
                              </span>
                            )}
                            {r.clinic && (
                              <span className="font-mono text-[10px] text-ink-4">
                                {r.clinic}
                              </span>
                            )}
                          </div>

                          {/* Note */}
                          {r.note && (
                            <p className="mt-1.5 font-sans text-[12px] leading-snug text-ink-2">
                              {r.note}
                            </p>
                          )}

                          {/* File actions */}
                          <div className="mt-2 flex flex-wrap items-center gap-3">
                            {signedUrl && isPdf && (
                              <a
                                href={signedUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-mono text-[10px] tracking-[0.06em] uppercase"
                                style={{ color: "var(--phase)" }}
                              >
                                PDF ↗
                              </a>
                            )}
                            {signedUrl && isImage && (
                              <a
                                href={signedUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-mono text-[10px] tracking-[0.06em] uppercase"
                                style={{ color: "var(--phase)" }}
                              >
                                Фото ↗
                              </a>
                            )}
                            {signedUrl && !isPdf && !isImage && (
                              <a
                                href={signedUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-mono text-[10px] tracking-[0.06em] uppercase"
                                style={{ color: "var(--phase)" }}
                              >
                                Скачать ↓
                              </a>
                            )}
                            {r.file_name && (
                              <span className="font-mono text-[9px] text-ink-4 truncate max-w-[140px]">
                                {r.file_name}
                                {r.file_size ? ` · ${formatSize(r.file_size)}` : ""}
                              </span>
                            )}
                            <DeleteButton id={r.id} />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-6 rounded-card border border-dashed border-line p-6 text-center">
          <p className="font-mono text-[12px] text-ink-3">Документов пока нет</p>
          <p className="mt-1 font-mono text-[11px] text-ink-4">
            Загрузи первый — анализы, выписки, назначения из ЕМИАС
          </p>
        </div>
      )}
    </>
  );
}
