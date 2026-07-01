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
  } catch { return null; }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function byUser(q: any, uid: string | null): any {
  if (!uid) return q.is("app_user_id", null);
  return q.eq("app_user_id", uid);
}

export type MedicalRecord = {
  id: string;
  title: string;
  category: string;
  subcategory: string | null;
  file_path: string | null;
  file_name: string | null;
  file_type: string | null;
  file_size: number | null;
  note: string | null;
  record_date: string | null;
  doctor: string | null;
  clinic: string | null;
  created_at: string;
};

export async function uploadRecord(
  formData: FormData
): Promise<{ ok: boolean; storageWarning?: boolean; error?: string }> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "DB unavailable" };

  const uid = await getAppUserId();
  const file         = formData.get("file") as File | null;
  const title        = (formData.get("title") as string | null)?.trim();
  const category     = (formData.get("category") as string | null) ?? "other";
  const subcategory  = (formData.get("subcategory") as string | null)?.trim() || null;
  const record_date  = (formData.get("record_date") as string | null) || null;
  const note         = (formData.get("note") as string | null)?.trim() || null;
  const doctor       = (formData.get("doctor") as string | null)?.trim() || null;
  const clinic       = (formData.get("clinic") as string | null)?.trim() || null;

  if (!title) return { ok: false, error: "Название обязательно" };

  let filePath: string | null = null;
  let fileName: string | null = null;
  let fileType: string | null = null;
  let fileSize: number | null = null;
  let storageWarning = false;

  if (file && file.size > 0) {
    fileName = file.name;
    fileType = file.type;
    fileSize = file.size;
    try {
      const fileBuffer = Buffer.from(await file.arrayBuffer());
      const storagePath = `records/${uid ?? "legacy"}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const { data: storageData, error: storageError } = await db.storage
        .from("medical-records")
        .upload(storagePath, fileBuffer, { contentType: file.type, upsert: false });
      if (storageError) { storageWarning = true; }
      else { filePath = storageData?.path ?? null; }
    } catch { storageWarning = true; }
  }

  const { error: dbError } = await db.from("medical_record").insert({
    title, category, subcategory,
    file_path: filePath, file_name: fileName, file_type: fileType, file_size: fileSize,
    note, record_date: record_date || null, doctor, clinic,
    app_user_id: uid,
  });

  if (dbError) return { ok: false, error: dbError.message };

  revalidatePath("/medical");
  return { ok: true, storageWarning };
}

export async function deleteRecord(id: string): Promise<{ ok: boolean }> {
  const db = supabaseAdmin();
  if (!db) return { ok: false };
  const uid = await getAppUserId();

  const { data: record } = await byUser(
    db.from("medical_record").select("file_path").eq("id", id),
    uid,
  ).single();

  if (record?.file_path) {
    await db.storage.from("medical-records").remove([record.file_path]);
  }

  const { error } = await byUser(
    db.from("medical_record").delete().eq("id", id),
    uid,
  );
  if (error) return { ok: false };

  revalidatePath("/medical");
  return { ok: true };
}

export async function getRecords(): Promise<MedicalRecord[]> {
  const db = supabaseAdmin();
  if (!db) return [];
  const uid = await getAppUserId();
  const { data } = await byUser(
    db.from("medical_record")
      .select("id, title, category, subcategory, file_path, file_name, file_type, file_size, note, record_date, doctor, clinic, created_at")
      .order("record_date", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false }),
    uid,
  );
  return (data ?? []) as MedicalRecord[];
}

export async function getSignedUrl(filePath: string): Promise<string | null> {
  const db = supabaseAdmin();
  if (!db) return null;
  const { data } = await db.storage.from("medical-records").createSignedUrl(filePath, 3600);
  return data?.signedUrl ?? null;
}
