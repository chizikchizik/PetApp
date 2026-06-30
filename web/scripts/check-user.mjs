import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const envPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "../.env.local");
const envVars = Object.fromEntries(
  readFileSync(envPath, "utf8").split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0,i).trim(), l.slice(i+1).trim().replace(/^"|"$/g,"")]; })
);

const db = createClient(envVars.NEXT_PUBLIC_SUPABASE_URL, envVars.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const { data, error } = await db.from("app_user")
  .select("id, email, display_name, password_hash, password_salt, created_at")
  .eq("email", "chizikchizik@gmail.com")
  .single();

if (error || !data) { console.error("Пользователь не найден:", error?.message); process.exit(1); }

console.log("id:          ", data.id);
console.log("email:       ", data.email);
console.log("display_name:", data.display_name);
console.log("created_at:  ", data.created_at);
console.log("salt:        ", data.password_salt ? data.password_salt.slice(0,8)+"..." : "NULL");
console.log("hash:        ", data.password_hash ? data.password_hash.slice(0,16)+"..." : "NULL");

// Verify password "qwerty81"
const testPassword = "qwerty81";
const ok = await new Promise((res) =>
  crypto.scrypt(testPassword, data.password_salt, 64, (err, dk) =>
    res(!err && crypto.timingSafeEqual(dk, Buffer.from(data.password_hash, "hex")))
  )
);
console.log(`\nПароль "qwerty81" совпадает: ${ok ? "✓ ДА" : "✗ НЕТ"}`);
