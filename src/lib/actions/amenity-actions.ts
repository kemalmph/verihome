"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * What a building and its rooms have.
 *
 * Amenities are a fixed vocabulary in a reference table, so the set written
 * here is always a set of ids that exist. The forms never invent one — adding
 * a new amenity is a migration, deliberately, because "AC" and "A/C" as two
 * facilities is the thing the table exists to prevent.
 */

export interface Amenity {
  id: string;
  code: string;
  label: string;
  category: string;
  icon: string | null;
}

export interface AmenityAssignments {
  all: Amenity[];
  site: string[];
  byUnit: Record<string, string[]>;
}

export async function getAmenityAssignments(siteId: string): Promise<AmenityAssignments> {
  await requireAdmin();
  const admin = createAdminClient();

  const [{ data: all }, { data: siteRows }, { data: unitRows }] = await Promise.all([
    admin.from("amenities").select("id, code, label, category, icon").order("category").order("label"),
    admin.from("site_amenities").select("amenity_id").eq("site_id", siteId),
    admin
      .from("unit_amenities")
      .select("amenity_id, unit_id, lettable_units!inner(site_id)")
      .eq("lettable_units.site_id", siteId),
  ]);

  const byUnit: Record<string, string[]> = {};
  for (const r of unitRows ?? []) {
    (byUnit[r.unit_id] ??= []).push(r.amenity_id);
  }

  return {
    all: (all ?? []) as Amenity[],
    site: (siteRows ?? []).map((r) => r.amenity_id),
    byUnit,
  };
}

/**
 * Replace the whole set, rather than toggling one at a time.
 *
 * A toggle endpoint has to be told the current state by the caller, and a
 * caller working from a stale page would flip the wrong way. Sending the set
 * the operator can see is idempotent: submitting twice leaves the same rows.
 */
export async function setSiteAmenities(siteId: string, amenityIds: string[]) {
  try { await requireAdmin(); } catch (e) { return { error: (e as Error).message }; }
  const admin = createAdminClient();

  const { error: delErr } = await admin.from("site_amenities").delete().eq("site_id", siteId);
  if (delErr) return { error: delErr.message };

  if (amenityIds.length) {
    const { error } = await admin
      .from("site_amenities")
      .insert(amenityIds.map((amenity_id) => ({ site_id: siteId, amenity_id })));
    if (error) return { error: error.message };
  }
  revalidatePath(`/site/${siteId}`);
  return { success: true };
}

export async function setUnitAmenities(siteId: string, unitId: string, amenityIds: string[]) {
  try { await requireAdmin(); } catch (e) { return { error: (e as Error).message }; }
  const admin = createAdminClient();

  // The unit must belong to this site. Without this check the action is a
  // separately addressable endpoint that edits any unit anywhere given its id
  // (§19.6) — the site in the URL would be decoration.
  const { data: unit } = await admin
    .from("lettable_units").select("id").eq("id", unitId).eq("site_id", siteId).maybeSingle();
  if (!unit) return { error: "Unit tidak ada di site ini." };

  const { error: delErr } = await admin.from("unit_amenities").delete().eq("unit_id", unitId);
  if (delErr) return { error: delErr.message };

  if (amenityIds.length) {
    const { error } = await admin
      .from("unit_amenities")
      .insert(amenityIds.map((amenity_id) => ({ unit_id: unitId, amenity_id })));
    if (error) return { error: error.message };
  }
  revalidatePath(`/site/${siteId}`);
  return { success: true };
}
