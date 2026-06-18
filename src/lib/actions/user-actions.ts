"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";

export async function toggleUserAdmin(userId: string, makeAdmin: boolean) {
  const admin = createAdminClient();
  const { error } = await admin
    .from("users")
    .update({ is_admin: makeAdmin })
    .eq("id", userId);
  if (error) return { error: error.message };
  revalidatePath("/admin/users");
  return { success: true };
}

export async function toggleActiveClient(userId: string, active: boolean) {
  const admin = createAdminClient();
  const { error } = await admin
    .from("users")
    .update({ is_active_client: active })
    .eq("id", userId);
  if (error) return { error: error.message };
  revalidatePath("/admin/users");
  return { success: true };
}

export async function updateUser(userId: string, formData: FormData) {
  const admin          = createAdminClient();
  const name           = (formData.get("name") as string)?.trim() || null;
  const email          = (formData.get("email") as string)?.trim() || null;
  const phone_whatsapp = (formData.get("phone_whatsapp") as string)?.trim() || null;
  const user_type      = (formData.get("user_type") as string) || null;
  const preferred_area = (formData.get("preferred_area") as string)?.trim() || null;
  const budget_min     = parseInt(formData.get("budget_min") as string) || null;
  const budget_max     = parseInt(formData.get("budget_max") as string) || null;

  // Update auth email if provided
  if (email) {
    await admin.auth.admin.updateUserById(userId, { email });
  }

  const { error } = await admin
    .from("users")
    .update({ name, email, phone_whatsapp, user_type, preferred_area, budget_min, budget_max })
    .eq("id", userId);
  if (error) return { error: error.message };
  revalidatePath("/admin/users");
  return { success: true };
}

export async function deleteUser(userId: string) {
  const admin = createAdminClient();
  // Delete from auth (cascades to users table via trigger)
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) {
    // Fall back: just remove from users table
    await admin.from("users").delete().eq("id", userId);
  }
  revalidatePath("/admin/users");
  return { success: true };
}

export async function createAdminUser(formData: FormData) {
  const admin    = createAdminClient();
  const name     = (formData.get("name") as string)?.trim();
  const email    = (formData.get("email") as string)?.trim();
  const password = (formData.get("password") as string)?.trim();
  const isAdmin  = formData.get("is_admin") !== "false";

  if (!name || !email || !password) return { error: "All fields are required." };
  if (password.length < 8)          return { error: "Password must be at least 8 characters." };

  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: name },
  });
  if (authError) return { error: authError.message };

  await admin.from("users").upsert(
    { id: authData.user.id, name, email, is_admin: isAdmin },
    { onConflict: "id" }
  );

  revalidatePath("/admin/users");
  return { success: true };
}
