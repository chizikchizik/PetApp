// Подписанная cookie сессии: "v1.<uid>.<exp>.<sig>".
// sig = HMAC-SHA256(ключ, "v1.<uid>.<exp>"), exp — unix-секунды.
// Раньше в cookie лежал голый id аккаунта: вечный, неотзываемый ключ
// (решение Марины 2026-11-23). Без server-only: нужен и proxy.ts.
//
// Ключ: AUTH_SECRET, если задан, иначе производный от service-role ключа
// (он уже есть на Vercel и только на сервере). Смена ключа разлогинивает всех.

export const SESSION_COOKIE = "verta_auth";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 60; // 60 дней

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const enc = new TextEncoder();

let keyPromise: Promise<CryptoKey | null> | null = null;

function getKey(): Promise<CryptoKey | null> {
  if (!keyPromise) {
    const secret = process.env.AUTH_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
    keyPromise = secret
      ? crypto.subtle.importKey(
          "raw",
          enc.encode(`verta-session-v1:${secret}`),
          { name: "HMAC", hash: "SHA-256" },
          false,
          ["sign", "verify"],
        )
      : Promise.resolve(null);
  }
  return keyPromise;
}

function toB64url(buf: ArrayBuffer): string {
  let s = "";
  for (const b of new Uint8Array(buf)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64url(s: string): Uint8Array<ArrayBuffer> | null {
  if (!/^[A-Za-z0-9_-]+$/.test(s)) return null;
  try {
    const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
    const out = new Uint8Array(new ArrayBuffer(bin.length));
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

export async function signSession(uid: string, nowMs = Date.now()): Promise<string | null> {
  if (!UUID.test(uid)) return null;
  const key = await getKey();
  if (!key) return null;
  const exp = Math.floor(nowMs / 1000) + SESSION_MAX_AGE;
  const payload = `v1.${uid.toLowerCase()}.${exp}`;
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return `${payload}.${toB64url(sig)}`;
}

// id аккаунта, если подпись верна и срок не истёк; иначе null.
export async function verifySession(value: string | undefined | null, nowMs = Date.now()): Promise<string | null> {
  if (!value || value.length > 200) return null;
  const parts = value.split(".");
  if (parts.length !== 4 || parts[0] !== "v1") return null;
  const [, uid, expStr, sigStr] = parts;
  if (!UUID.test(uid) || !/^\d{1,12}$/.test(expStr)) return null;
  if (Number(expStr) * 1000 <= nowMs) return null;
  const sig = fromB64url(sigStr);
  if (!sig) return null;
  const key = await getKey();
  if (!key) return null;
  const ok = await crypto.subtle.verify("HMAC", key, sig, enc.encode(`v1.${uid}.${expStr}`));
  return ok ? uid : null;
}
