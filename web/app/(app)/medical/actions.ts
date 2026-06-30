"use server";
import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type MedicalRecord = {
  id: string;
  title: string;
  category: string;
  file_path: string | null;
  file_name: string | null;
  file_type: string | null;
  file_size: number | null;
  note: string | null;
  record_date: string | null;
  created_at: string;
};

export async function uploadRecord(
  formData: FormData
): Promise<{ ok: boolean; storageWarning?: boolean; error?: string }> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "DB unavailable" };

  const file = formData.get("file") as File | null;
  const title = (formData.get("title") as string | null)?.trim();
  const category = (formData.get("category") as string | null) ?? "other";
  const record_date = (formData.get("record_date") as string | null) || null;
  const note = (formData.get("note") as string | null)?.trim() || null;

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
      const storagePath = `records/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const { data: storageData, error: storageError } = await db.storage
        .from("medical-records")
        .upload(storagePath, fileBuffer, { contentType: file.type, upsert: false });

      if (storageError) {
        storageWarning = true;
        filePath = null;
      } else {
        filePath = storageData?.path ?? null;
      }
    } catch {
      storageWarning = true;
    }
  }

  const { error: dbError } = await db.from("medical_record").insert({
    title,
    category,
    file_path: filePath,
    file_name: fileName,
    file_type: fileType,
    file_size: fileSize,
    note,
    record_date: record_date || null,
  });

  if (dbError) return { ok: false, error: dbError.message };

  revalidatePath("/medical");
  return { ok: true, storageWarning };
}

export async function deleteRecord(id: string): Promise<{ ok: boolean }> {
  const db = supabaseAdmin();
  if (!db) return { ok: false };

  // Fetch record to get file_path
  const { data: record } = await db
    .from("medical_record")
    .select("file_path")
    .eq("id", id)
    .single();

  // Delete from storage if file exists
  if (record?.file_path) {
    await db.storage.from("medical-records").remove([record.file_path]);
  }

  const { error } = await db.from("medical_record").delete().eq("id", id);
  if (error) return { ok: false };

  revalidatePath("/medical");
  return { ok: true };
}

export async function getRecords(): Promise<MedicalRecord[]> {
  const db = supabaseAdmin();
  if (!db) return [];
  const { data } = await db
    .from("medical_record")
    .select("id, title, category, file_path, file_name, file_type, file_size, note, record_date, created_at")
    .order("created_at", { ascending: false });
  return (data ?? []) as MedicalRecord[];
}
