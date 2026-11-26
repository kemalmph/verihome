"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePermission } from "@/lib/auth/guards";
import { isStaffRole } from "@/lib/auth/permissions";

// Every action here mutates privilege or destroys data, so each one authorizes
// itself. The /admin layout only gates page rendering — it does not stand
// between a caller and these endpoints.
//
// Two permissions, deliberately apart:
//   users.manage  edit / deactivate / delete ordinary users
//   staff.manage  grant and revoke staff roles (superadmin only)
// A users.manage holder must not be able to touch a staff account at all: edit
// its email and reset the password and you are that person. So any action on a
// user who holds a staff role also needs staff.manage.

type Caller = Awaited<ReturnType<typeof requirePermission>>;

/** Staff roles currently held by a user. */
async function rolesOf(userId: string): Promise<string[]> {
  const { data } = await createAdminClient()
    .from("staff_roles").select("role").eq("user_id", userId);
  return (data ?? []).map((r) => r.role as string);
}

/** Error string when the caller may not act on this target, else null. */
async function denyIfTargetIsStaff(caller: Caller, userId: string): Promise<string | null> {
  if (caller.permissions.includes("staff.manage")) return null;
  if ((await rolesOf(userId)).length > 0) {
    return "Only a superadmin can change a staff account.";
  }
  return null;
}

export async function grantStaffRole(userId: string, role: string) {
  let caller: Caller;
  try { caller = await requirePermission("staff.manage"); } catch (e) { return { error: (e as Error).message }; }
  if (!isStaffRole(role)) return { error: "Unknown role." };

  const admin = createAdminClient();
  const { data: target } = await admin.from("users").select("id").eq("id", userId).maybeSingle();
  if (!target) return { error: "User not found." };

  const { error } = await admin
    .from("staff_roles")
    .upsert({ user_id: userId, role, granted_by: caller.id }, { onConflict: "user_id,role", ignoreDuplicates: true });
  if (error) return { error: error.message };
  revalidatePath("/admin/users");
  return { success: true };
}

export async function revokeStaffRole(userId: string, role: string) {
  let caller: Caller;
  try { caller = await requirePermission("staff.manage"); } catch (e) { return { error: (e as Error).message }; }
  if (!isStaffRole(role)) return { error: "Unknown role." };

  const admin = createAdminClient();

  if (role === "superadmin") {
    // Removing your own superadmin locks you out of the console with no way back,
    // and removing the last one locks everybody out.
    if (caller.id === userId) return { error: "You cannot revoke your own superadmin access." };
    const { count } = await admin
      .from("staff_roles").select("user_id", { count: "exact", head: true }).eq("role", "superadmin");
    if ((count ?? 0) <= 1) return { error: "There must be at least one superadmin." };
  }

  const { error } = await admin.from("staff_roles").delete().eq("user_id", userId).eq("role", role);
  if (error) return { error: error.message };
  revalidatePath("/admin/users");
  return { success: true };
}

export async function toggleActiveClient(userId: string, active: boolean) {
  let caller: Caller;
  try { caller = await requirePermission("users.manage"); } catch (e) { return { error: (e as Error).message }; }
  const denied = await denyIfTargetIsStaff(caller, userId);
  if (denied) return { error: denied };

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
  let caller: Caller;
  try { caller = await requirePermission("users.manage"); } catch (e) { return { error: (e as Error).message }; }
  const denied = await denyIfTargetIsStaff(caller, userId);
  if (denied) return { error: denied };

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
  let caller: Caller;
  try { caller = await requirePermission("users.manage"); } catch (e) { return { error: (e as Error).message }; }
  if (caller.id === userId) return { error: "You cannot delete your own account." };
  const denied = await denyIfTargetIsStaff(caller, userId);
  if (denied) return { error: denied };

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
  let caller: Caller;
  try { caller = await requirePermission("users.manage"); } catch (e) { return { error: (e as Error).message }; }

  const admin    = createAdminClient();
  const name     = (formData.get("name") as string)?.trim();
  const email    = (formData.get("email") as string)?.trim();
  const password = (formData.get("password") as string)?.trim();
  // Creating a staff account is granting a role: staff.manage, not users.manage.
  const wantsStaff = formData.get("is_admin") !== "false";
  const role = String(formData.get("role") ?? "superadmin");
  if (wantsStaff) {
    if (!caller.permissions.includes("staff.manage")) {
      return { error: "Only a superadmin can create a staff account." };
    }
    if (!isStaffRole(role)) return { error: "Unknown role." };
  }

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
    { id: authData.user.id, name, email },
    { onConflict: "id" }
  );

  if (wantsStaff) {
    const { error: roleError } = await admin
      .from("staff_roles")
      .insert({ user_id: authData.user.id, role, granted_by: caller.id });
    if (roleError) return { error: `Account created, but the role was not granted: ${roleError.message}` };
  }

  revalidatePath("/admin/users");
  return { success: true };
}
