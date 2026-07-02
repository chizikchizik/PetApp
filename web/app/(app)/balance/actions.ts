"use server";
import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { todayISOMoscow } from "@/lib/format";
import { revalidatePath } from "next/cache";

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

export type Sector = { id: number; label: string; description: string | null };
export type ScoreMap = Record<string, number>;

export type Assessment = {
  id: string;
  assessed_at: string;
  created_at: string;
  scores: ScoreMap;
  note: string | null;
};

const DEFAULT_SECTORS: { label: string; description: string }[] = [
  { label: "Семья и любовь",      description: "Близкие отношения, партнёр, родные, тепло дома" },
  { label: "Работа и реализация", description: "Смысл, признание, карьера, реализация потенциала" },
  { label: "Отдых и развлечения", description: "Время для себя, хобби, развлечения, восстановление" },
  { label: "Здоровье и красота",  description: "Тело, питание, сон, внешность и самоощущение" },
  { label: "Дружба и общение",    description: "Круг общения, близкие друзья, социальная жизнь" },
  { label: "Деньги и имущество",  description: "Финансы, стабильность, собственность, достаток" },
  { label: "Духовность",          description: "Смыслы, ценности, внутренний мир, опора на себя" },
  { label: "Личностный рост",     description: "Развитие, знания, навыки, кто ты через год" },
];

const MIN_SECTORS = 3;

export async function getSectors(): Promise<Sector[]> {
  const db = supabaseAdmin();
  if (db) {
    const uid = await getAppUserId();
    const { data, error } = await byUser(
      db.from("balance_sector").select("id, label, description").order("sort", { ascending: true }),
      uid,
    );
    if (!error && data && data.length) {
      return data as Sector[];
    }
    if (uid && uid !== "__legacy__") {
      return DEFAULT_SECTORS.map((s, i) => ({ id: i, label: s.label, description: s.description }));
    }
  }
  return DEFAULT_SECTORS.map((s, i) => ({ id: i, label: s.label, description: s.description }));
}

/** Materializes the default sectors as real rows the first time this user edits them. */
async function ensureSectorsExist(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  uid: string,
): Promise<void> {
  const { data } = await db.from("balance_sector").select("id").eq("app_user_id", uid).limit(1);
  if (data && data.length > 0) return;
  const rows = DEFAULT_SECTORS.map((s, i) => ({
    app_user_id: uid,
    label: s.label,
    description: s.description,
    sort: i,
  }));
  await db.from("balance_sector").insert(rows);
}

/** A client-held id might be a real row id, or (before the user's first edit) a
 *  synthetic default index. Resolve it to a real row id, materializing defaults
 *  as needed — synthetic ids match 1:1 with `sort` by construction. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function resolveRealSectorId(db: any, uid: string, maybeId: number): Promise<number | null> {
  await ensureSectorsExist(db, uid);
  const { data } = await db.from("balance_sector").select("id, sort").eq("app_user_id", uid);
  const rows = (data ?? []) as { id: number; sort: number }[];
  if (rows.some((r) => r.id === maybeId)) return maybeId;
  const bySort = rows.find((r) => r.sort === maybeId);
  return bySort ? bySort.id : null;
}

export async function addSector(label: string, description?: string): Promise<{ ok: boolean }> {
  const trimmed = label.trim();
  if (!trimmed) return { ok: false };
  const db = supabaseAdmin();
  if (!db) return { ok: false };
  const uid = await getAppUserId();
  if (!uid) return { ok: false };
  await ensureSectorsExist(db, uid);
  const { data: maxSort } = await db
    .from("balance_sector")
    .select("sort")
    .eq("app_user_id", uid)
    .order("sort", { ascending: false })
    .limit(1);
  const nextSort = (maxSort?.[0]?.sort ?? -1) + 1;
  const { error } = await db
    .from("balance_sector")
    .insert({ app_user_id: uid, label: trimmed, description: description?.trim() || null, sort: nextSort });
  if (error) return { ok: false };
  revalidatePath("/balance");
  return { ok: true };
}

export async function renameSector(id: number, label: string): Promise<{ ok: boolean }> {
  const trimmed = label.trim();
  if (!trimmed) return { ok: false };
  const db = supabaseAdmin();
  if (!db) return { ok: false };
  const uid = await getAppUserId();
  if (!uid) return { ok: false };
  const realId = await resolveRealSectorId(db, uid, id);
  if (realId == null) return { ok: false };
  const { error } = await db
    .from("balance_sector")
    .update({ label: trimmed })
    .eq("id", realId)
    .eq("app_user_id", uid);
  if (error) return { ok: false };
  revalidatePath("/balance");
  return { ok: true };
}

export async function deleteSector(id: number): Promise<{ ok: boolean; error?: string }> {
  const db = supabaseAdmin();
  if (!db) return { ok: false };
  const uid = await getAppUserId();
  if (!uid) return { ok: false };
  const { count } = await db
    .from("balance_sector")
    .select("id", { count: "exact", head: true })
    .eq("app_user_id", uid);
  const currentTotal = count ?? 0;
  // ensureSectorsExist (inside resolveRealSectorId) may add rows if none exist yet —
  // account for that when checking the minimum.
  const effectiveTotal = currentTotal > 0 ? currentTotal : DEFAULT_SECTORS.length;
  if (effectiveTotal <= MIN_SECTORS) {
    return { ok: false, error: `Минимум ${MIN_SECTORS} сферы в колесе` };
  }
  const realId = await resolveRealSectorId(db, uid, id);
  if (realId == null) return { ok: false };
  const { error } = await db.from("balance_sector").delete().eq("id", realId).eq("app_user_id", uid);
  if (error) return { ok: false };
  revalidatePath("/balance");
  return { ok: true };
}

export async function saveAssessment(
  scores: ScoreMap,
  note: string,
): Promise<{ ok: boolean; error?: string }> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "БД недоступна" };
  const uid = await getAppUserId();
  // Assessments are keyed by real sector ids, so make sure defaults are
  // materialized before the very first save (in case sectors were never
  // touched via add/rename/delete first).
  if (uid) await ensureSectorsExist(db, uid);
  const { error } = await db.from("balance_assessment").insert({
    assessed_at: todayISOMoscow(),
    scores,
    note: note.trim() || null,
    app_user_id: uid,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/balance");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function getAssessments(): Promise<Assessment[]> {
  const db = supabaseAdmin();
  if (!db) return [];
  const uid = await getAppUserId();
  const { data } = await byUser(
    db.from("balance_assessment")
      .select("id, assessed_at, created_at, scores, note")
      .not("scores", "is", null)
      .order("created_at", { ascending: false })
      .limit(12),
    uid,
  );
  return (data ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    assessed_at: r.assessed_at as string,
    created_at: r.created_at as string,
    note: (r.note as string | null) ?? null,
    scores: (r.scores as ScoreMap) ?? {},
  }));
}
