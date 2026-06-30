// Usage: node scripts/reset-password.mjs <email> <newPassword>
// Requires .env.local with NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY

import crypto from "crypto";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";
import { createClient } from "@supabase/supabase-js";

// Load .env.local manually
const envPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "../.env.local");
const envVars = Object.fromEntries(
  readFileSync(envPath, "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => {
      const idx = l.indexOf("=");
      return [l.slice(0, idx).trim(), l.slice(idx + 1).trim().replace(/^"|"$/g, "")];
    }),
);

const url = envVars["NEXT_PUBLIC_SUPABASE_URL"];
const key = envVars["SUPABASE_SERVICE_ROLE_KEY"];
if (!url || !key) { console.error("Missing SUPABASE env vars in .env.local"); process.exit(1); }

const [email, newPassword] = process.argv.slice(2);
if (!email || !newPassword || newPassword.length < 8) {
  console.error("Usage: node scripts/reset-password.mjs <email> <newPassword>");
  process.exit(1);
}

const db = createClient(url, key, { auth: { persistSession: false } });

const salt = crypto.randomBytes(16).toString("hex");
const hash = await new Promise((res, rej) =>
  crypto.scrypt(newPassword, salt, 64, (err, dk) => (err ? rej(err) : res(dk.toString("hex"))))
);

const { data, error } = await db
  .from("app_user")
  .update({ password_hash: hash, password_salt: salt })
  .eq("email", email.toLowerCase().trim())
  .select("id, email, display_name")
  .single();

if (error || !data) {
  console.error("Ошибка:", error?.message ?? "пользователь не найден");
  process.exit(1);
}

console.log(`✓ Пароль обновлён для ${data.email} (id: ${data.id})`);
