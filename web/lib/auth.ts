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

export async function loginUser(email: string, password: string): Promise<
  { user: { id: string; email: string; displayName: string } } |
  { error: "not_found" | "wrong_password" }
> {
  const db = supabaseAdmin()
  if (!db) return { error: "not_found" }
  const { data } = await db
    .from("app_user")
    .select("id, email, display_name, password_hash, password_salt")
    .eq("email", email.toLowerCase().trim())
    .single()
  if (!data) return { error: "not_found" }
  const ok = await verifyPassword(password, data.password_salt as string, data.password_hash as string)
  if (!ok) return { error: "wrong_password" }
  return { user: { id: data.id as string, email: data.email as string, displayName: data.display_name as string } }
}

export async function deleteUnfinishedUser(email: string): Promise<void> {
  const db = supabaseAdmin()
  if (!db) return
  await db.from("app_user").delete()
    .eq("email", email.toLowerCase().trim())
    .eq("onboarding_done", false)
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

export async function clearAuthCookie() {
  const cookieStore = await cookies()
  cookieStore.delete(COOKIE_NAME)
}

export type AppUser = {
  id: string
  email: string
  displayName: string
  weightGoalKg: number | null
  weightStartKg: number | null
  onboardingDone: boolean
  avgCycleLength: number | null
  menstrualDays: number | null
  workoutYearGoal: number | null
  calorieBalanceKcal: number | null
  calorieGoalKcal: number | null
}

const USER_SELECT = "id, email, display_name, weight_goal_kg, weight_start_kg, onboarding_done, avg_cycle_length, menstrual_days, workout_year_goal, calorie_balance_kcal, calorie_goal_kcal"

function rowToUser(data: Record<string, unknown>): AppUser {
  return {
    id: data.id as string,
    email: data.email as string,
    displayName: (data.display_name as string) ?? "",
    weightGoalKg: (data.weight_goal_kg as number | null) ?? null,
    weightStartKg: (data.weight_start_kg as number | null) ?? null,
    onboardingDone: (data.onboarding_done as boolean) ?? false,
    avgCycleLength: (data.avg_cycle_length as number | null) ?? null,
    menstrualDays: (data.menstrual_days as number | null) ?? null,
    workoutYearGoal: (data.workout_year_goal as number | null) ?? null,
    calorieBalanceKcal: (data.calorie_balance_kcal as number | null) ?? null,
    calorieGoalKcal: (data.calorie_goal_kcal as number | null) ?? null,
  }
}

export async function getCurrentUser(): Promise<AppUser | null> {
  const cookieStore = await cookies()
  const cookie = cookieStore.get(COOKIE_NAME)
  if (!cookie?.value) return null

  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cookie.value)
  if (!isUUID) {
    if (cookie.value === process.env.PETAPP_PASSWORD) {
      const db = supabaseAdmin()
      if (db) {
        const { data } = await db
          .from("app_user")
          .select(USER_SELECT)
          .order("created_at", { ascending: true })
          .limit(1)
          .single()
        if (data) return rowToUser(data as Record<string, unknown>)
      }
      return { id: "__legacy__", email: "marina@verta", displayName: "Марина", weightGoalKg: null, weightStartKg: null, onboardingDone: true, avgCycleLength: null, menstrualDays: null, workoutYearGoal: null, calorieBalanceKcal: null, calorieGoalKcal: null }
    }
    return null
  }

  const db = supabaseAdmin()
  if (!db) return null
  const { data } = await db.from("app_user").select(USER_SELECT).eq("id", cookie.value).single()
  if (!data) return null
  return rowToUser(data as Record<string, unknown>)
}
