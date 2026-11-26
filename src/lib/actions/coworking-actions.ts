"use server";

import { revalidatePath } from "next/cache";
import { requirePermission, requireAnyPermission } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  isLettingMode, isSiteStatus, isSiteType, isUnitStatus, isUnitType,
} from "@/lib/coworking/taxonomy";

/**
 * Coworking: sites and the lettable units inside them.
 *
 * Every function here calls requirePermission("sites.operate_all") itself. Not because the /admin
 * layout is missing, but because a layout gates *rendering a page* and these
 * are separately addressable POST endpoints that any signed-in client can
 * invoke from anywhere (§19.6, and the Next.js docs say the same thing in
 * their own words). A disabled button is not a rule.
 */

export interface SiteRow {
  id: string;
  name: string;
  slug: string;
  status: string;
  site_type: string;
  area: string | null;
  address: string | null;
  owner_id: string | null;
  owner_name: string | null;
  opening_time: string | null;
  closing_time: string | null;
  notes: string | null;
  unit_count: number;
  capacity: number;
}

export interface UnitRow {
  id: string;
  site_id: string;
  name: string;
  unit_type: string;
  letting_mode: string;
  capacity: number;
  floor: string | null;
  size_sqm: number | null;
  price: number | null;
  status: string;
  notes: string | null;
}

/** name → url-safe slug, with a base-36 suffix so two "Lantai 2" never collide. */
function slugify(name: string): string {
  const base = name.toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${base || "site"}-${Date.now().toString(36)}`;
}

function text(fd: FormData, key: string): string {
  return String(fd.get(key) ?? "").trim();
}

/** Empty string means "not set", which is a different thing from zero. */
function optionalText(fd: FormData, key: string): string | null {
  const v = text(fd, key);
  return v === "" ? null : v;
}

function optionalNumber(fd: FormData, key: string): number | null | "invalid" {
  const v = text(fd, key).replace(",", ".");
  if (v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : "invalid";
}

// ─── Reads ──────────────────────────────────────────────────────────────────

export async function listSites(): Promise<SiteRow[]> {
  await requireAnyPermission(["sites.operate_all","sites.finance_all"]);
  const admin = createAdminClient();

  const { data: sites } = await admin
    .from("sites")
    .select("id, name, slug, status, site_type, area, address, owner_id, opening_time, closing_time, notes")
    .order("name");

  if (!sites?.length) return [];

  // Unit counts come from one query rather than one per site. Capacity counts
  // only lettable stock: a retired desk is not somewhere anyone can sit.
  const { data: units } = await admin
    .from("lettable_units")
    .select("site_id, capacity, status")
    .in("site_id", sites.map((s) => s.id));

  const { data: owners } = await admin
    .from("owners")
    .select("id, name")
    .in("id", sites.map((s) => s.owner_id).filter(Boolean) as string[]);

  const ownerName = new Map((owners ?? []).map((o) => [o.id, o.name as string]));

  return sites.map((s) => {
    const mine = (units ?? []).filter((u) => u.site_id === s.id);
    return {
      ...s,
      owner_name: s.owner_id ? ownerName.get(s.owner_id) ?? null : null,
      unit_count: mine.length,
      capacity: mine
        .filter((u) => u.status === "available")
        .reduce((sum, u) => sum + Number(u.capacity ?? 0), 0),
    } as SiteRow;
  });
}

export async function getSite(siteId: string) {
  await requireAnyPermission(["sites.operate_all","sites.finance_all"]);
  const admin = createAdminClient();

  const { data: site } = await admin
    .from("sites")
    .select("id, name, slug, status, site_type, area, address, google_maps_url, owner_id, opening_time, closing_time, notes")
    .eq("id", siteId)
    .maybeSingle();

  if (!site) return null;

  const { data: units } = await admin
    .from("lettable_units")
    .select("id, site_id, name, unit_type, letting_mode, capacity, floor, size_sqm, price, status, notes")
    .eq("site_id", siteId)
    .order("unit_type")
    .order("name");

  return { site, units: (units ?? []) as UnitRow[] };
}

export async function listOwnerOptions() {
  await requireAnyPermission(["sites.operate_all","sites.finance_all"]);
  const admin = createAdminClient();
  const { data } = await admin.from("owners").select("id, name").order("name");
  return (data ?? []) as { id: string; name: string }[];
}

// ─── Sites ──────────────────────────────────────────────────────────────────

export async function createSite(
  fd: FormData,
): Promise<{ error?: string; id?: string; slug?: string }> {
  await requirePermission("sites.operate_all");

  const name = text(fd, "name");
  if (!name) return { error: "Nama site wajib diisi." };

  const status = text(fd, "status") || "draft";
  if (!isSiteStatus(status)) return { error: "Status site tidak dikenal." };

  const siteType = text(fd, "site_type") || "coworking";
  if (!isSiteType(siteType)) return { error: "Tipe site tidak dikenal." };

  const opening = optionalText(fd, "opening_time");
  const closing = optionalText(fd, "closing_time");
  // The database enforces this too; saying it here means the person gets a
  // sentence instead of a constraint violation.
  if ((opening === null) !== (closing === null)) {
    return { error: "Isi jam buka dan jam tutup bersama-sama, atau kosongkan keduanya." };
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("sites")
    .insert({
      name,
      slug: slugify(name),
      status,
      site_type: siteType,
      area: optionalText(fd, "area"),
      address: optionalText(fd, "address"),
      google_maps_url: optionalText(fd, "google_maps_url"),
      owner_id: optionalText(fd, "owner_id"),
      opening_time: opening,
      closing_time: closing,
      notes: optionalText(fd, "notes"),
    })
    .select("id, slug")
    .single();

  if (error) return { error: error.message };

  revalidatePath("/site");
  // The slug goes back too, so a site created in the browser lands on
  // /site/cosystem-kemang rather than on its uuid. Both resolve, but the
  // first URL someone sees is the one they copy.
  return { id: data.id as string, slug: data.slug as string };
}

export async function updateSite(fd: FormData): Promise<{ error?: string }> {
  await requirePermission("sites.operate_all");

  const id = text(fd, "id");
  if (!id) return { error: "Site tidak dikenali." };

  const name = text(fd, "name");
  if (!name) return { error: "Nama site wajib diisi." };

  const status = text(fd, "status");
  if (!isSiteStatus(status)) return { error: "Status site tidak dikenal." };

  const siteType = text(fd, "site_type");
  if (!isSiteType(siteType)) return { error: "Tipe site tidak dikenal." };

  const opening = optionalText(fd, "opening_time");
  const closing = optionalText(fd, "closing_time");
  if ((opening === null) !== (closing === null)) {
    return { error: "Isi jam buka dan jam tutup bersama-sama, atau kosongkan keduanya." };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("sites")
    .update({
      name,
      status,
      site_type: siteType,
      area: optionalText(fd, "area"),
      address: optionalText(fd, "address"),
      google_maps_url: optionalText(fd, "google_maps_url"),
      owner_id: optionalText(fd, "owner_id"),
      opening_time: opening,
      closing_time: closing,
      notes: optionalText(fd, "notes"),
    })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/site");
  revalidatePath(`/site/${id}`);
  return {};
}

// ─── Units ──────────────────────────────────────────────────────────────────

export async function createUnit(fd: FormData): Promise<{ error?: string }> {
  await requirePermission("sites.operate_all");

  const siteId = text(fd, "site_id");
  const name   = text(fd, "name");
  if (!siteId) return { error: "Site tidak dikenali." };
  if (!name)   return { error: "Nama unit wajib diisi." };

  const unitType    = text(fd, "unit_type");
  const lettingMode = text(fd, "letting_mode");
  if (!isUnitType(unitType))       return { error: "Tipe unit tidak dikenal." };
  if (!isLettingMode(lettingMode)) return { error: "Cara sewa tidak dikenal." };

  const capacity = Number(text(fd, "capacity") || "1");
  if (!Number.isInteger(capacity) || capacity < 1) {
    return { error: "Kapasitas harus bilangan bulat minimal 1." };
  }

  const price = optionalNumber(fd, "price");
  if (price === "invalid") return { error: "Harga harus angka dan tidak negatif." };
  const sizeSqm = optionalNumber(fd, "size_sqm");
  if (sizeSqm === "invalid") return { error: "Luas harus angka dan tidak negatif." };

  const admin = createAdminClient();
  const { error } = await admin.from("lettable_units").insert({
    site_id: siteId,
    name,
    unit_type: unitType,
    letting_mode: lettingMode,
    capacity,
    floor: optionalText(fd, "floor"),
    size_sqm: sizeSqm,
    price,
    notes: optionalText(fd, "notes"),
  });

  if (error) {
    // The (site_id, name) unique constraint is the likely one, and "duplicate
    // key value violates..." is not a sentence anyone should have to read.
    if (error.code === "23505") {
      return { error: `Sudah ada unit bernama "${name}" di site ini.` };
    }
    return { error: error.message };
  }

  revalidatePath(`/site/${siteId}`);
  revalidatePath("/site");
  return {};
}

export async function updateUnit(fd: FormData): Promise<{ error?: string }> {
  await requirePermission("sites.operate_all");

  const id     = text(fd, "id");
  const siteId = text(fd, "site_id");
  if (!id || !siteId) return { error: "Unit tidak dikenali." };

  const name = text(fd, "name");
  if (!name) return { error: "Nama unit wajib diisi." };

  const unitType    = text(fd, "unit_type");
  const lettingMode = text(fd, "letting_mode");
  const status      = text(fd, "status");
  if (!isUnitType(unitType))       return { error: "Tipe unit tidak dikenal." };
  if (!isLettingMode(lettingMode)) return { error: "Cara sewa tidak dikenal." };
  if (!isUnitStatus(status))       return { error: "Status unit tidak dikenal." };

  const capacity = Number(text(fd, "capacity") || "1");
  if (!Number.isInteger(capacity) || capacity < 1) {
    return { error: "Kapasitas harus bilangan bulat minimal 1." };
  }

  const price = optionalNumber(fd, "price");
  if (price === "invalid") return { error: "Harga harus angka dan tidak negatif." };
  const sizeSqm = optionalNumber(fd, "size_sqm");
  if (sizeSqm === "invalid") return { error: "Luas harus angka dan tidak negatif." };

  const admin = createAdminClient();
  const { error } = await admin
    .from("lettable_units")
    .update({
      name,
      unit_type: unitType,
      letting_mode: lettingMode,
      status,
      capacity,
      floor: optionalText(fd, "floor"),
      size_sqm: sizeSqm,
      price,
      notes: optionalText(fd, "notes"),
    })
    .eq("id", id)
    .eq("site_id", siteId); // both, in one query — never load then compare

  if (error) {
    if (error.code === "23505") {
      return { error: `Sudah ada unit bernama "${name}" di site ini.` };
    }
    return { error: error.message };
  }

  revalidatePath(`/site/${siteId}`);
  revalidatePath("/site");
  return {};
}

/**
 * Retire rather than delete.
 *
 * A unit will carry bookings and ledger history as soon as the booking slice
 * lands, and deleting a row that money points at is how history develops
 * holes. `retired` takes it out of capacity and out of the dashboard while
 * leaving everything that refers to it intact.
 */
export async function retireUnit(fd: FormData): Promise<{ error?: string }> {
  await requirePermission("sites.operate_all");

  const id     = text(fd, "id");
  const siteId = text(fd, "site_id");
  if (!id || !siteId) return { error: "Unit tidak dikenali." };

  const admin = createAdminClient();
  const { error } = await admin
    .from("lettable_units")
    .update({ status: "retired" })
    .eq("id", id)
    .eq("site_id", siteId);

  if (error) return { error: error.message };

  revalidatePath(`/site/${siteId}`);
  revalidatePath("/site");
  return {};
}

/** Sites a property can be linked to. Used by the listing edit form. */
export async function listSiteOptions() {
  await requireAnyPermission(["sites.operate_all","sites.finance_all"]);
  const admin = createAdminClient();
  const { data } = await admin.from("sites").select("id, name, site_type").order("name");
  return (data ?? []) as { id: string; name: string; site_type: string }[];
}
