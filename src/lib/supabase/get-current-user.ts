import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  phone_whatsapp: string | null;
  user_type: string | null;
  preferred_area: string | null;
  budget_min: number | null;
  budget_max: number | null;
  is_admin: boolean;
  is_active_client: boolean;
}

export async function getCurrentUser(): Promise<CurrentUser> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("users")
    .select("id, name, email, phone_whatsapp, user_type, preferred_area, budget_min, budget_max, is_admin, is_active_client")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/");

  return {
    id: profile.id,
    name: profile.name ?? user.email?.split("@")[0] ?? "User",
    email: profile.email ?? user.email ?? "",
    phone_whatsapp: profile.phone_whatsapp ?? null,
    user_type: profile.user_type ?? null,
    preferred_area: profile.preferred_area ?? null,
    budget_min: profile.budget_min ?? null,
    budget_max: profile.budget_max ?? null,
    is_admin: profile.is_admin ?? false,
    is_active_client: profile.is_active_client ?? false,
  };
}
