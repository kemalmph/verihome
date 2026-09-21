"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";

export interface PlatformSettings {
  default_commission_pct: number | null;
  updated_at: string | null;
  updated_by_name: string | null;
}

/**
 * Reads the single settings row. Returns nulls rather than throwing when the
 * row is somehow missing, so the page renders and says so.
 */
export async function getPlatformSettings(): Promise<PlatformSettings> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("platform_settings")
    .select("default_commission_pct, updated_at, updated_by")
    .eq("id", 1)
    .maybeSingle();

  let updatedByName: string | null = null;
  if (data?.updated_by) {
    const { data: u } = await admin
      .from("users").select("name, email").eq("id", data.updated_by).maybeSingle();
    updatedByName = u?.name ?? u?.email ?? null;
  }

  return {
    default_commission_pct:
      data?.default_commission_pct == null ? null : Number(data.default_commission_pct),
    updated_at: data?.updated_at ?? null,
    updated_by_name: updatedByName,
  };
}

/**
 * How many bookings a change to the default would NOT affect.
 *
 * The rate is frozen onto each booking when it is taken (migration 028), so a
 * new default applies only to bookings made from now on. The settings page
 * states this with a real number rather than a promise, because "does this
 * change what I already sold?" is the first thing anyone asks.
 */
export async function countBookingsUnaffected(): Promise<number> {
  const admin = createAdminClient();
  const { count } = await admin
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .not("commission_pct", "is", null)
    .not("status", "in", '("completed","cancelled","expired")');
  return count ?? 0;
}

export async function saveDefaultCommission(formData: FormData) {
  let caller;
  try { caller = await requireAdmin(); } catch (e) { return { error: (e as Error).message }; }

  const raw = String(formData.get("default_commission_pct") ?? "").trim();

  // An empty field means "no default", which is a real choice: bookings on
  // unconfigured properties then post entirely to the owner and get flagged,
  // exactly as they did before this setting existed.
  let pct: number | null = null;
  if (raw !== "") {
    pct = Number(raw.replace(",", "."));
    if (!Number.isFinite(pct)) return { error: "Komisi harus berupa angka." };
    if (pct < 0 || pct > 100) return { error: "Komisi harus antara 0 dan 100 persen." };
    pct = Math.round(pct * 100) / 100;   // numeric(5,2)
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("platform_settings")
    .update({
      default_commission_pct: pct,
      updated_at: new Date().toISOString(),
      updated_by: caller.id,
    })
    .eq("id", 1);

  if (error) return { error: error.message };

  revalidatePath("/admin/settings");
  revalidatePath("/admin");
  return { success: true, saved: pct };
}
