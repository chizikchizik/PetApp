"use server";
import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { MIGREBOT_MED_PATTERNS } from "@/lib/migrebot-meds";

async function getAppUserId(): Promise<string | null> {
  try {
    const user = await getCurrentUser();
    if (!user || user.id === "__legacy__") return null;
    return user.id;
  } catch {
    return null;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function byUser(q: any, uid: string | null): any {
  if (!uid) return q.is("app_user_id", null);
  return q.eq("app_user_id", uid);
}

// A MigreBot import's free-text meds mentions (e.g. "Спрей", "Делмигрен")
// can reference a medication the user has never added a real record for —
// detectMedIds()/med-calendar.tsx then has nothing to match against, and
// those days silently never count toward "по факту мигрени". Registers
// any detected medication missing from the user's own list as as-needed
// (купирование), so history stays visible without a manual fix each time.
async function autoRegisterDetectedMeds(
  db: NonNullable<ReturnType<typeof supabaseAdmin>>,
  uid: string | null,
  medsTexts: string[],
): Promise<void> {
  const allText = medsTexts.join(" | ");
  const detectedLabels = MIGREBOT_MED_PATTERNS
    .filter(({ pattern }) => pattern.test(allText))
    .map(({ label }) => label);
  if (detectedLabels.length === 0) return;

  const { data: existing } = await byUser(db.from("medication").select("name"), uid);
  const existingNames = new Set((existing ?? []).map((m: { name: string }) => m.name));

  const toCreate = detectedLabels.filter((label) => !existingNames.has(label));
  for (let i = 0; i < toCreate.length; i++) {
    await db.from("medication").insert({
      id: `custom_${Date.now()}_${i}`,
      name: toCreate[i],
      is_as_needed: true,
      kind: "as_needed",
      habit_key: toCreate[i],
      sort: 99,
      app_user_id: uid,
    });
  }
}

/** Минимальный парсер CSV: обрабатывает quoted fields с переносами строк внутри */
function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let i = 0;
  const n = text.length;

  while (i < n) {
    const row: string[] = [];

    while (i < n) {
      let cell = "";
      if (text[i] === '"') {
        i++;
        while (i < n) {
          if (text[i] === '"' && text[i + 1] === '"') {
            cell += '"';
            i += 2;
          } else if (text[i] === '"') {
            i++;
            break;
          } else {
            cell += text[i++];
          }
        }
      } else {
        while (i < n && text[i] !== "," && text[i] !== "\n" && text[i] !== "\r") {
          cell += text[i++];
        }
      }
      row.push(cell.trim());
      if (i < n && text[i] === ",") {
        i++;
        continue;
      }
      break;
    }

    while (i < n && (text[i] === "\r" || text[i] === "\n")) i++;
    if (row.some((c) => c !== "")) rows.push(row);
  }

  return rows;
}

export type PreviewStats = {
  totalRows: number;
  migraineRows: number;
  dateFrom: string;
  dateTo: string;
};

export async function previewCSV(
  csvText: string,
): Promise<{ ok: boolean; stats?: PreviewStats; error?: string }> {
  const rows = parseCSV(csvText);
  if (rows.length < 2) return { ok: false, error: "Файл пустой или неверный формат" };

  const header = rows[0];
  if (!header[0]?.toLowerCase().includes("дата") && !header[0]?.includes("date")) {
    return { ok: false, error: "Не похоже на файл Migrebot — ожидаем колонку 'Дата'" };
  }

  const dataRows = rows.slice(1).filter((r) => /^\d{4}-\d{2}-\d{2}$/.test(r[0]));
  if (dataRows.length === 0) return { ok: false, error: "Нет строк с датами в формате YYYY-MM-DD" };

  const migraineRows = dataRows.filter((r) => r[2] === "Да");
  const dates = dataRows.map((r) => r[0]).sort();

  return {
    ok: true,
    stats: {
      totalRows: dataRows.length,
      migraineRows: migraineRows.length,
      dateFrom: dates[0],
      dateTo: dates[dates.length - 1],
    },
  };
}

export async function importCSV(
  csvText: string,
  fileName?: string,
): Promise<{ ok: boolean; result?: { imported: number; skipped: number }; error?: string }> {
  const rows = parseCSV(csvText);
  if (rows.length < 2) return { ok: false, error: "Файл пустой" };

  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "БД недоступна" };

  const uid = await getAppUserId();
  const dataRows = rows.slice(1).filter((r) => /^\d{4}-\d{2}-\d{2}$/.test(r[0]));

  const toImport = dataRows.map((r) => {
    const hasMigraine = r[2] === "Да";
    const triggersRaw = r[14] ?? "";
    const triggers = triggersRaw
      ? triggersRaw.split(",").map((s) => s.trim()).filter(Boolean)
      : [];

    const medsText = r[6] ? r[6].replace(/\n/g, "; ").trim() : "";
    const comment = r[17] ? r[17].trim() : "";
    const note = [medsText, comment].filter(Boolean).join(" · ") || null;

    return {
      app_user_id: uid,
      log_date: r[0],
      migraine: hasMigraine,
      migraine_aura: r[4] === "Да",
      migraine_intensity: hasMigraine && r[7] ? parseInt(r[7]) || null : null,
      migraine_triggers: triggers,
      note,
      updated_at: new Date().toISOString(),
    };
  });

  if (toImport.length === 0) return { ok: false, error: "Нет строк для импорта" };

  const CHUNK = 100;
  for (let i = 0; i < toImport.length; i += CHUNK) {
    const chunk = toImport.slice(i, i + CHUNK);
    const { error } = await db
      .from("daily_log")
      .upsert(chunk, { onConflict: "app_user_id,log_date" });
    if (error) return { ok: false, error: error.message };
  }

  await autoRegisterDetectedMeds(db, uid, dataRows.map((r) => r[6] ?? ""));

  const migraineCount = toImport.filter((r) => r.migraine).length;
  const dates = dataRows.map((r) => r[0]).sort();

  // Persist import history
  await db.from("import_log").insert({
    app_user_id: uid,
    source: "migrebot",
    file_name: fileName ?? null,
    total_rows: toImport.length,
    migraine_rows: migraineCount,
    date_from: dates[0],
    date_to: dates[dates.length - 1],
  });

  revalidatePath("/import/migrebot");
  revalidatePath("/insights");
  revalidatePath("/dashboard");
  revalidatePath("/checkin");
  revalidatePath("/checkin/meds");
  revalidatePath("/habits");

  return {
    ok: true,
    result: {
      imported: toImport.length,
      skipped: migraineCount,
    },
  };
}

export type ImportLogEntry = {
  id: string;
  source: string;
  file_name: string | null;
  imported_at: string;
  total_rows: number | null;
  migraine_rows: number | null;
  date_from: string | null;
  date_to: string | null;
};

export async function getImportLog(): Promise<ImportLogEntry[]> {
  const db = supabaseAdmin();
  if (!db) return [];
  const uid = await getAppUserId();
  const q = db
    .from("import_log")
    .select("id, source, file_name, imported_at, total_rows, migraine_rows, date_from, date_to")
    .order("imported_at", { ascending: false })
    .limit(20);
  const { data } = uid ? await q.eq("app_user_id", uid) : await q.is("app_user_id", null);
  return (data ?? []) as ImportLogEntry[];
}
