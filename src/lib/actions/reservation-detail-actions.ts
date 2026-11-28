"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRecordAccess, requireSiteAccess, siteIdOf } from "@/lib/auth/site-access";
import { canSeeDocumentKind, hasSitePermission, type SitePermission } from "@/lib/auth/site-permissions";

/**
 * One booking, and what it actually cost.
 *
 * The margin on a meeting-room booking is the rate less what was handed out
 * with it. Without the consumables, every booking looks equally profitable,
 * which is the same as having no margin at all.
 *
 * Phase 3: every action takes the site from the reservation (or item row,
 * or document) in the database and checks access there. A site id from the
 * client only ever narrows: when it disagrees with the record, not-found.
 */


/** An embedded PostgREST row, whether it arrived as an object or a 1-element array. */
function first<T>(v: unknown): T | null {
  if (v == null) return null;
  return (Array.isArray(v) ? (v[0] ?? null) : v) as T | null;
}

export interface ResItem {
  id: string;
  name: string;
  qty: number;
  cost_price: number;
  sell_price: number;
  included: boolean;
  notes: string | null;
}

export interface ResDocument {
  id: string;
  kind: string;
  title: string | null;
  file_name: string;
  size_bytes: number;
  created_at: string;
}

export interface ReservationDetail {
  id: string;
  reservation_code: string;
  site_id: string;
  site_slug: string;
  site_name: string;
  unit_name: string;
  unit_type: string;
  who: string;
  contract_ref: string | null;
  starts_at: string;
  ends_at: string;
  status: string;
  payment_status: string;
  /** NILAI KONTRAK — the whole term. */
  total_price: number;
  /** The agreed rate, per the unit's own period (per month for a lease). */
  monthly_rate: number;
  /** The unit's asking rate, for comparison. */
  list_price: number | null;
  utilities_included: boolean;
  event_title: string | null;
  membership_holder: string | null;
  items: ResItem[];
  documents: ResDocument[];
  /**
   * What the consumables cost, what they brought in, and the margin. Null
   * unless the viewer holds site.revenue (global finance only): revenue for a
   * site waits on the revenue-share decision (§20.7).
   */
  cogs: number | null;
  item_sales: number | null;
  /** Room rate plus items sold, less what the items cost. */
  margin: number | null;
  /** The viewer's permissions on this reservation's site, for the page to choose what to show. */
  perms: SitePermission[];
}

export async function getReservationDetail(reservationId: string): Promise<ReservationDetail | null> {
  // Site from the reservation itself. Throws NotFoundError for no access.
  const access = await requireRecordAccess("reservation", reservationId, "site.reservations.view");
  const seeMoney = hasSitePermission(access.perms, "site.revenue");
  const admin = createAdminClient();

  const { data: r } = await admin
    .from("unit_reservations")
    .select(`
      id, reservation_code, unit_id, tenant_name, user_id, contract_ref,
      starts_at, ends_at, status, payment_status, total_price, unit_price, utilities_included,
      event_id, membership_id,
      lettable_units!inner(name, unit_type, site_id, price, sites!inner(id, name, slug)),
      events(title),
      memberships(member_name)
    `)
    .eq("id", reservationId)
    .maybeSingle();
  if (!r) return null;

  const unit = first<{
    name: string; unit_type: string; site_id: string; price: number | null;
    sites: { id: string; name: string; slug: string } | { id: string; name: string; slug: string }[];
  }>(r.lettable_units)!;
  const site = first<{ id: string; name: string; slug: string }>(unit.sites)!;

  const { data: itemRows } = await admin
    .from("reservation_items")
    .select("id, name, qty, cost_price, sell_price, included, notes")
    .eq("reservation_id", reservationId)
    .order("created_at");

  const items: ResItem[] = (itemRows ?? []).map((i) => ({
    id: i.id,
    name: i.name,
    qty: Number(i.qty),
    cost_price: Number(i.cost_price),
    sell_price: Number(i.sell_price),
    included: i.included,
    notes: i.notes,
  }));

  const { data: docRows } = await admin
    .from("coworking_documents")
    .select("id, kind, title, file_name, size_bytes, created_at")
    .eq("reservation_id", reservationId)
    .order("created_at", { ascending: false });

  // Documents by kind: finance sees invoices and receipts; contracts and IDs
  // need site.documents.
  const docs = (docRows ?? []).filter((d) => canSeeDocumentKind(access.perms, d.kind));

  const cogs = items.reduce((n, i) => n + i.qty * i.cost_price, 0);
  const item_sales = items.reduce((n, i) => n + i.qty * i.sell_price, 0);
  const total = Number(r.total_price);

  return {
    id: r.id,
    reservation_code: r.reservation_code,
    site_id: site.id,
    site_slug: site.slug,
    site_name: site.name,
    unit_name: unit.name,
    unit_type: unit.unit_type,
    who: r.tenant_name ?? (r.user_id ? "Akun terdaftar" : "—"),
    contract_ref: r.contract_ref,
    starts_at: r.starts_at,
    ends_at: r.ends_at,
    status: r.status,
    payment_status: r.payment_status,
    total_price: total,
    monthly_rate: Number(r.unit_price ?? 0),
    list_price: unit.price === null || unit.price === undefined ? null : Number(unit.price),
    utilities_included: r.utilities_included,
    // PostgREST returns an embedded row as an object or a one-element array
    // depending on how it infers the relationship, and the generated types
    // say array. Taking the first of either is the shape-agnostic read; a
    // cast would compile and then be undefined at runtime.
    event_title: first<{ title: string }>(r.events)?.title ?? null,
    membership_holder: first<{ member_name: string | null }>(r.memberships)?.member_name ?? null,
    // Item lines carry cost prices; without site.revenue they go out
    // without them.
    items: seeMoney ? items : items.map((i) => ({ ...i, cost_price: 0 })),
    documents: docs.map((d) => ({ ...d, size_bytes: Number(d.size_bytes) })),
    cogs: seeMoney ? cogs : null,
    item_sales: seeMoney ? item_sales : null,
    margin: seeMoney ? total + item_sales - cogs : null,
    perms: access.perms,
  };
}

/** The catalog a booking at this site can draw from: the site's items plus the all-sites ones. */
export async function listItems(siteId: string) {
  const access = await requireSiteAccess(siteId, ["site.reservations", "site.catalog"]);
  // Cost prices go to whoever keeps the catalog (site.catalog) or reads
  // revenue (site.revenue); front office picks items by name and sell price.
  const seeCost = hasSitePermission(access.perms, ["site.catalog", "site.revenue"]);
  const admin = createAdminClient();
  const { data } = await admin
    .from("items")
    .select("id, name, unit, cost_price, sell_price, kind")
    .or(`site_id.eq.${siteId},site_id.is.null`)
    .eq("status", "active")
    .order("name");
  return (data ?? []).map((i) => ({
    ...i, cost_price: seeCost ? Number(i.cost_price) : 0, sell_price: Number(i.sell_price),
  }));
}

export async function createItem(siteId: string, fd: FormData) {
  try { await requireSiteAccess(siteId, "site.catalog"); } catch { return { error: "Not found." }; }
  const admin = createAdminClient();

  const name = ((fd.get("name") as string) ?? "").trim();
  if (!name) return { error: "Nama item harus diisi." };

  const n = (k: string) => {
    const v = ((fd.get(k) as string) ?? "").trim();
    const x = Number(v.replace(/[^\d.-]/g, ""));
    return Number.isFinite(x) && x >= 0 ? x : 0;
  };

  const { error } = await admin.from("items").insert({
    site_id: siteId,
    name,
    kind: (fd.get("kind") as string) || "consumable",
    unit: ((fd.get("unit") as string) ?? "pcs").trim() || "pcs",
    cost_price: n("cost_price"),
    sell_price: n("sell_price"),
  });
  if (error) return { error: error.message };
  return { success: true };
}

export async function addReservationItem(reservationId: string, fd: FormData) {
  let siteId: string;
  try { siteId = (await requireRecordAccess("reservation", reservationId, "site.reservations")).siteId; }
  catch { return { error: "Not found." }; }
  const admin = createAdminClient();

  const qty = Number(((fd.get("qty") as string) ?? "1").replace(/[^\d.]/g, "")) || 0;
  if (qty <= 0) return { error: "Jumlah harus lebih dari nol." };

  const included = fd.get("included") === "on" || fd.get("included") === "true";
  const itemId = ((fd.get("item_id") as string) ?? "").trim();

  let name = ((fd.get("name") as string) ?? "").trim();
  let cost_price = Number(((fd.get("cost_price") as string) ?? "0").replace(/[^\d.]/g, "")) || 0;
  let sell_price = Number(((fd.get("sell_price") as string) ?? "0").replace(/[^\d.]/g, "")) || 0;

  if (itemId) {
    const { data: item } = await admin
      .from("items").select("name, cost_price, sell_price, site_id").eq("id", itemId).maybeSingle();
    // The item must be this reservation's site's, or one sold at every site
    // (site_id null). Another site's catalog is not-found, not "wrong site".
    if (!item || (item.site_id !== null && item.site_id !== siteId)) return { error: "Not found." };
    // Snapshot: a supplier raising the price of water in April must not change
    // what a booking in March cost.
    name = item.name;
    cost_price = Number(item.cost_price);
    sell_price = Number(item.sell_price);
  }
  if (!name) return { error: "Pilih item atau isi namanya." };

  // Bundled means not charged. The CHECK enforces it too, but a sentence is
  // better than a constraint violation shown to an operator.
  if (included) sell_price = 0;

  const { error } = await admin.from("reservation_items").insert({
    reservation_id: reservationId,
    item_id: itemId || null,
    name, qty, cost_price, sell_price, included,
    notes: ((fd.get("notes") as string) ?? "").trim() || null,
  });
  if (error) return { error: error.message };

  revalidatePath(`/site/booking/${reservationId}`);
  return { success: true };
}

export async function removeReservationItem(reservationId: string, itemRowId: string) {
  // The row's own reservation's site; a reservationId that disagrees is not-found.
  try {
    const rowSite = await siteIdOf("reservation_item", itemRowId);
    const resSite = await siteIdOf("reservation", reservationId);
    if (!rowSite || rowSite !== resSite) return { error: "Not found." };
    await requireSiteAccess(rowSite, "site.reservations");
  } catch { return { error: "Not found." }; }
  const admin = createAdminClient();
  const { error } = await admin
    .from("reservation_items").delete().eq("id", itemRowId).eq("reservation_id", reservationId);
  if (error) return { error: error.message };
  revalidatePath(`/site/booking/${reservationId}`);
  return { success: true };
}

export async function setReservationUtilities(reservationId: string, included: boolean) {
  try { await requireRecordAccess("reservation", reservationId, "site.reservations"); } catch { return { error: "Not found." }; }
  const admin = createAdminClient();
  const { error } = await admin
    .from("unit_reservations").update({ utilities_included: included }).eq("id", reservationId);
  if (error) return { error: error.message };
  revalidatePath(`/site/booking/${reservationId}`);
  return { success: true };
}

/**
 * Remove a document.
 *
 * The row goes; the object in the bucket stays. That is deliberate for now —
 * a signed contract someone deleted by mistake is not recoverable from a
 * bucket we have already emptied, and orphaned private objects cost pennies.
 * When a real retention policy exists, it sweeps by key.
 */
export async function removeDocument(reservationId: string, documentId: string) {
  try {
    const docSite = await siteIdOf("document", documentId);
    const resSite = await siteIdOf("reservation", reservationId);
    if (!docSite || docSite !== resSite) return { error: "Not found." };
    await requireSiteAccess(docSite, "site.documents");
  } catch { return { error: "Not found." }; }
  const admin = createAdminClient();
  const { error } = await admin
    .from("coworking_documents").delete().eq("id", documentId).eq("reservation_id", reservationId);
  if (error) return { error: error.message };
  revalidatePath(`/site/booking/${reservationId}`);
  return { success: true };
}
