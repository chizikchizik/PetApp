// Свой список видов спорта у каждой пользовательницы (решение Марины
// 2026-11-23): то, что она добавила сама (sport_type), плюс всё, чем она
// реально занималась (workout_log). Стандартные виды — основной список, только
// пока своего нет; потом — подсказки при вводе «Другое» (удалённый вид, как
// «Силовая» у Марины, не возвращается).
// Без server-only: canonicalSport нужен и клиентскому графику.

import { sportColor } from "@/lib/sport-colors";

export type SportType = {
  name: string;
  color: string;
  // Дата последней тренировки этого вида (ISO) и число тренировок.
  lastUsed?: string | null;
  uses?: number;
  // Стандартный вид из DEFAULT_SPORT_TYPES, пока своего списка нет.
  suggested?: boolean;
};

export const DEFAULT_SPORT_TYPES = ["Силовая", "Функциональная", "Бег", "Групповая"];

// «Спорт» из старых записей и отметок дня — общий вид, не направление.
export const SPORT_KEY = "спорт";

// Видам только из истории (не из sport_type) — цвета из отдельного
// диапазона, по порядку первого появления: добавление новых видов в список
// их не перекрашивает.
const HISTORY_COLOR_BASE = 100;

// Приводит сырое название тренировки к виду из списка: точное совпадение,
// затем ключевые слова («Зал и волейбол» → «Волейбол»).
export function canonicalSport(names: string[], raw: string): string {
  const name = raw.trim();
  const lower = name.toLowerCase();
  const exact = names.find((n) => n.toLowerCase() === lower);
  if (exact) return exact;
  const byKeyword = (kw: string) => names.find((n) => n.toLowerCase().includes(kw));
  if (lower.includes("волейбол")) return byKeyword("волейбол") ?? name;
  if (lower.includes("бег"))      return byKeyword("бег") ?? name;
  if (lower.includes("зал") || lower.includes("сил")) return byKeyword("сил") ?? name;
  if (lower.includes("сноуборд")) return byKeyword("сноуборд") ?? name;
  if (lower.includes("функц"))    return byKeyword("функц") ?? name;
  return name;
}

export function buildSportList(
  rows: { name: string; sort: number | null }[],
  // В порядке добавления записей (created_at), а не даты тренировки: запись
  // задним числом нового вида не перекрашивает уже существующие.
  history: { workout_date: string; type: string | null; created_at?: string | null }[],
  defaults: string[],
): SportType[] {
  const own: SportType[] = rows.map((r, i) => ({
    name: r.name,
    color: sportColor(typeof r.sort === "number" && r.sort >= 0 ? r.sort : i),
    lastUsed: null,
    uses: 0,
  }));
  const find = (n: string) => own.find((s) => s.name.toLowerCase() === n.toLowerCase());

  const sorted = [...history].sort((a, b) => (a.created_at ?? "").localeCompare(b.created_at ?? ""));
  let k = 0;
  for (const w of sorted) {
    const raw = (w.type ?? "").trim();
    if (!raw || raw.toLowerCase() === SPORT_KEY) continue;
    const t = canonicalSport(own.map((s) => s.name), raw);
    let entry = find(t);
    if (!entry) {
      entry = { name: t, color: sportColor(HISTORY_COLOR_BASE + k++), lastUsed: null, uses: 0 };
      own.push(entry);
    }
    entry.uses = (entry.uses ?? 0) + 1;
    if (!entry.lastUsed || w.workout_date > entry.lastUsed) entry.lastUsed = w.workout_date;
  }

  if (own.length === 0) {
    return defaults.map((name, i) => ({ name, color: sportColor(i), lastUsed: null, uses: 0, suggested: true }));
  }
  return own;
}

// Порядок в форме: недавние первыми, потом виды без тренировок (в порядке
// списка).
export function orderForPicker(types: SportType[]): SportType[] {
  const idx = new Map(types.map((t, i) => [t, i]));
  return [...types].sort((a, b) => {
    if (!!a.suggested !== !!b.suggested) return a.suggested ? 1 : -1;
    const la = a.lastUsed ?? "", lb = b.lastUsed ?? "";
    if (la !== lb) return la < lb ? 1 : -1;
    return (idx.get(a) ?? 0) - (idx.get(b) ?? 0);
  });
}
