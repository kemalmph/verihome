"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/** Removes one saved listing, filtered by row id AND the session user. */
export async function removeSaved(savedId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Tidak ditemukan." };

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("saved_listings")
    .delete()
    .eq("id", savedId)
    .eq("user_id", user.id)
    .select("id");

  if (error) return { error: error.message };
  if (!data?.length) return { error: "Tidak ditemukan." };

  revalidatePath("/dashboard/saved");
  revalidatePath("/dashboard/unit");
  return { success: true };
}
