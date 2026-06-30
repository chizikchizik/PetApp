import "server-only"
import { supabaseAdmin } from "@/lib/supabase/server"
import crypto from "crypto"
import { cookies } from "next/headers"

const COOKIE_NAME = "verta_auth"

function generateSalt(): string {
  return crypto.randomBytes(16).toString("hex")
}

async function hashPassword(password: string, salt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 64, (err, derivedKey) => {
      if (err) reject(err)
      else resolve(derivedKey.toString("hex"))
    })
  })
}

async function verifyPassword(password: string, salt: string, hash: string): Promise<boolean> {
  const computed = await hashPassword(password, salt)
  return crypto.timingSafeEqual(Buffer.from(computed, "hex"), Buffer.from(hash, "hex"))
}

export async function createUser(email: string, password: string, displayName: string) {
  const db = supabaseAdmin()
  if (!db) throw new Error("DB unavailable")
  const salt = generateSalt()
  const hash = await hashPassword(password, salt)
  const { data, error } = await db
    .from("app_user")
    .insert({ email: email.toLowerCase().trim(), display_name: displayName, password_hash: hash, password_salt: salt })
    .select("id, email, display_name")
    .single()
  if (error) throw new Error(error.code === "23505" ? "Этот email уже зарегистрирован" : error.message)
  return data as { id: string; email: string; display_name: string }
}

export async function loginUser(email: string, password: string) {
  const db = supabaseAdmin()
  if (!db) return null
  const { data } = await db
    .from("app_user")
    .select("id, email, display_name, password_hash, password_salt")
    .eq("email", email.toLowerCase().trim())
    .single()
  if (!data) return null
  const ok = await verifyPassword(password, data.password_salt as string, data.password_hash as string)
  if (!ok) return null
  return { id: data.id as string, email: data.email as string, displayName: data.display_name as string }
}

export async function setAuthCookie(userId: string) {
  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, userId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 60, // 60 days
  })
}

export async function getCurrentUser(): Promise<{ id: string; email: string; displayName: string } | null> {
  const cookieStore = await cookies()
  const cookie = cookieStore.get(COOKIE_NAME)
  if (!cookie?.value) return null

  // Check if it's a UUID (new format) or legacy password
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cookie.value)
  if (!isUUID) {
    // Legacy: cookie = password. Check PETAPP_PASSWORD env var
    if (cookie.value === process.env.PETAPP_PASSWORD) {
      // Return a "legacy" user placeholder (null id = Marina's data without user_id)
      return { id: "__legacy__", email: "marina@verta", displayName: "Марина" }
    }
    return null
  }

  // New format: cookie = user UUID
  const db = supabaseAdmin()
  if (!db) return null
  const { data } = await db.from("app_user").select("id, email, display_name").eq("id", cookie.value).single()
  if (!data) return null
  return { id: data.id as string, email: data.email as string, displayName: data.display_name as string }
}
