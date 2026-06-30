"use server";
import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
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

export type Scores = {
  family:  number;
  work:    number;
  rest:    number;
  health:  number;
  friends: number;
  money:   number;
  spirit:  number;
  growth:  number;
};

export type Assessment = {
  id: string;
  assessed_at: string;
  scores: Scores;
  note: string | null;
};

const DEFAULT_SCORES: Scores = {
  family: 5, work: 5, rest: 5, health: 5,
  friends: 5, money: 5, spirit: 5, growth: 5,
};

export async function saveAssessment(
  scores: Scores,
  note: string,
): Promise<{ ok: boolean; error?: string }> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "БД недоступна" };
  const uid = await getAppUserId();
  const { error } = await db.from("balance_assessment").insert({
    assessed_at: new Date().toISOString().slice(0, 10),
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
      .select("id, assessed_at, scores, note")
      .order("assessed_at", { ascending: false })
      .limit(12),
    uid,
  );
  return (data ?? []).map((r: Record<string, unknown>) => {
    const s = (r.scores as Partial<Scores>) ?? {};
    return {
      id: r.id as string,
      assessed_at: r.assessed_at as string,
      note: (r.note as string | null) ?? null,
      scores: {
        family:  s.family  ?? DEFAULT_SCORES.family,
        work:    s.work    ?? DEFAULT_SCORES.work,
        rest:    s.rest    ?? DEFAULT_SCORES.rest,
        health:  s.health  ?? DEFAULT_SCORES.health,
        friends: s.friends ?? DEFAULT_SCORES.friends,
        money:   s.money   ?? DEFAULT_SCORES.money,
        spirit:  s.spirit  ?? DEFAULT_SCORES.spirit,
        growth:  s.growth  ?? DEFAULT_SCORES.growth,
      },
    };
  });
}
