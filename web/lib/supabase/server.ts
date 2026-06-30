import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

/**
 * Серверный клиент на service_role-ключе. ТОЛЬКО для server-кода
 * (Server Components, Server Actions) — ключ не попадает в браузер.
 * RLS включён без публичных политик, service_role обходит его → данные приватны.
 * Возвращает null, если переменные окружения не заданы (тогда слой данных
 * берёт значения из сида).
 */
export function supabaseAdmin(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  if (!cached) {
    cached = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return cached;
}
