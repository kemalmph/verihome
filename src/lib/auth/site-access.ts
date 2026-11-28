import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NotFoundError } from "@/lib/auth/guards";
import { isStaffRole, permissionsForRoles, type Permission, type StaffRole } from "@/lib/auth/permissions";
import {
  globalSitePermissions, hasSitePermission, isSiteRole, sitePermissionsFor,
  type SitePermission, type SiteRelation,
} from "@/lib/auth/site-permissions";
import { looksLikeUuid, resolveSiteId } from "@/lib/coworking/resolve";
import { notFound, redirect } from "next/navigation";

/**
 * Who may do what on which coworking site (Phase 3).
 *
 * The rule every site action follows:
 *
 *   1. Never trust a site id from the client for a child record. An action
 *      that receives the id of a unit, reservation, membership, plan, event,
 *      item, document or reservation item loads that record, takes its
 *      site_id from the database, and checks access against THAT site.
 *   2. If the action also received a site id and it is not the record's
 *      site, the answer is not-found — the same answer as a record that does
 *      not exist, so a refusal never confirms that some other site has it.
 *   3. Everything is re-read on every call: a revoked site role, a revoked
 *      owner portal, or a removed staff role stops working on the very next
 *      request, not at the next sign-in.
 *
 * SERVER ONLY (service key).
 */

export interface SiteActor {
  userId: string;
  email: string | null;
  name: string | null;
  staffRoles: StaffRole[];
  /** Global staff permissions (empty for someone who is not Cosystem staff). */
  permissions: Permission[];
  isSuperadmin: boolean;
  /** Site permissions this person holds on every site, from their global role. */
  global: SitePermission[];
}

export interface SiteAccess {
  actor: SiteActor;
  siteId: string;
  /** Owner and/or site_staff roles on this site. Empty for global-only access. */
  relations: SiteRelation[];
  /** Union of global and per-site permissions for this site. */
  perms: SitePermission[];
}

/** The signed-in person, staff or not. Null when nobody is signed in. */
export async function getSiteActor(): Promise<SiteActor | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();
  const [{ data: profile }, { data: rows }] = await Promise.all([
    admin.from("users").select("id, email, name").eq("id", user.id).maybeSingle(),
    admin.from("staff_roles").select("role").eq("user_id", user.id),
  ]);
  const staffRoles = (rows ?? []).map((r) => r.role).filter(isStaffRole);
  const permissions = permissionsForRoles(staffRoles);
  return {
    userId: user.id,
    email: (profile?.email as string) ?? user.email ?? null,
    name: (profile?.name as string) ?? null,
    staffRoles,
    permissions,
    isSuperadmin: staffRoles.includes("superadmin"),
    global: globalSitePermissions(staffRoles, permissions),
  };
}

/**
 * Every site this user owns or is staff of, with the relations held there.
 *
 * Ownership needs portal_access = 'active' on the owners row, exactly as the
 * owner portal does: 'invited' was never redeemed, 'revoked' was taken away.
 */
export async function siteRelationsOf(userId: string): Promise<Map<string, SiteRelation[]>> {
  const admin = createAdminClient();
  const [{ data: owners }, { data: staff }] = await Promise.all([
    admin.from("owners").select("id").eq("user_id", userId).eq("portal_access", "active"),
    admin.from("site_staff").select("site_id, role").eq("user_id", userId),
  ]);

  const out = new Map<string, SiteRelation[]>();
  const add = (siteId: string, rel: SiteRelation) => {
    const list = out.get(siteId) ?? [];
    if (!list.includes(rel)) list.push(rel);
    out.set(siteId, list);
  };

  const ownerIds = (owners ?? []).map((o) => o.id as string);
  if (ownerIds.length) {
    const { data: owned } = await admin.from("sites").select("id").in("owner_id", ownerIds);
    for (const s of owned ?? []) add(s.id as string, "owner");
  }
  for (const r of staff ?? []) if (isSiteRole(r.role)) add(r.site_id as string, r.role);
  return out;
}

/** This actor's access to one site, or null when the site does not exist or they have none. */
export async function siteAccessFor(actor: SiteActor, siteId: string): Promise<SiteAccess | null> {
  if (!looksLikeUuid(siteId)) return null;
  const admin = createAdminClient();

  const { data: site } = await admin.from("sites").select("id, owner_id").eq("id", siteId).maybeSingle();
  if (!site) return null;

  const relations: SiteRelation[] = [];
  if (site.owner_id) {
    const { data: owner } = await admin
      .from("owners").select("id")
      .eq("id", site.owner_id).eq("user_id", actor.userId).eq("portal_access", "active")
      .maybeSingle();
    if (owner) relations.push("owner");
  }
  const { data: staff } = await admin
    .from("site_staff").select("role").eq("site_id", siteId).eq("user_id", actor.userId);
  for (const r of staff ?? []) if (isSiteRole(r.role) && !relations.includes(r.role)) relations.push(r.role);

  const perms = [...new Set([...actor.global, ...sitePermissionsFor(relations)])];
  if (perms.length === 0) return null;
  return { actor, siteId, relations, perms };
}

/**
 * Throws NotFoundError unless the signed-in person holds `need` (any of, when
 * a list) on this site. Same error for "no such site" and "not yours", like
 * requireOwner: a refusal must not confirm that the site exists.
 */
export async function requireSiteAccess(
  siteId: string,
  need: SitePermission | readonly SitePermission[],
): Promise<SiteAccess> {
  const actor = await getSiteActor();
  if (!actor) throw new NotFoundError();
  const access = await siteAccessFor(actor, String(siteId ?? ""));
  if (!access || !hasSitePermission(access.perms, need)) throw new NotFoundError();
  return access;
}

// ── Child records → their site, read from the database ─────────────────────

export type SiteRecordKind =
  | "unit" | "reservation" | "membership" | "event" | "document" | "reservation_item"
  | "plan" | "item";

function first<T>(v: unknown): T | null {
  if (v == null) return null;
  return (Array.isArray(v) ? (v[0] ?? null) : v) as T | null;
}

/**
 * The site a record belongs to, from the database. Null when the record does
 * not exist — or, for plans and items, when it belongs to every site
 * (site_id null), which callers handle themselves.
 */
export async function siteIdOf(kind: SiteRecordKind, id: string): Promise<string | null> {
  if (!looksLikeUuid(String(id ?? ""))) return null;
  const admin = createAdminClient();
  switch (kind) {
    case "unit": {
      const { data } = await admin.from("lettable_units").select("site_id").eq("id", id).maybeSingle();
      return (data?.site_id as string) ?? null;
    }
    case "reservation": {
      const { data } = await admin
        .from("unit_reservations").select("lettable_units!inner(site_id)").eq("id", id).maybeSingle();
      return first<{ site_id: string }>(data?.lettable_units)?.site_id ?? null;
    }
    case "reservation_item": {
      const { data } = await admin
        .from("reservation_items").select("reservation_id").eq("id", id).maybeSingle();
      return data ? siteIdOf("reservation", data.reservation_id as string) : null;
    }
    case "membership": {
      const { data } = await admin.from("memberships").select("site_id").eq("id", id).maybeSingle();
      return (data?.site_id as string) ?? null;
    }
    case "event": {
      const { data } = await admin.from("events").select("site_id").eq("id", id).maybeSingle();
      return (data?.site_id as string) ?? null;
    }
    case "plan": {
      const { data } = await admin.from("membership_plans").select("site_id").eq("id", id).maybeSingle();
      return (data?.site_id as string) ?? null;
    }
    case "item": {
      const { data } = await admin.from("items").select("site_id").eq("id", id).maybeSingle();
      return (data?.site_id as string) ?? null;
    }
    case "document": {
      // A document hangs on exactly one of: a site, a unit, a reservation.
      const { data } = await admin
        .from("coworking_documents").select("site_id, unit_id, reservation_id").eq("id", id).maybeSingle();
      if (!data) return null;
      if (data.site_id) return data.site_id as string;
      if (data.unit_id) return siteIdOf("unit", data.unit_id as string);
      if (data.reservation_id) return siteIdOf("reservation", data.reservation_id as string);
      return null;
    }
  }
}

/**
 * Load the record's site from the database and require `need` there.
 * `claimedSiteId`, when the action also received one, must match the record's
 * site, or the answer is not-found.
 */
export async function requireRecordAccess(
  kind: SiteRecordKind,
  id: string,
  need: SitePermission | readonly SitePermission[],
  claimedSiteId?: string | null,
): Promise<SiteAccess> {
  const siteId = await siteIdOf(kind, id);
  if (!siteId) throw new NotFoundError();
  if (claimedSiteId !== undefined && claimedSiteId !== null && claimedSiteId !== siteId) {
    throw new NotFoundError();
  }
  return requireSiteAccess(siteId, need);
}

/**
 * The ids of every site this person can open: all of them for global site
 * staff, otherwise the ones they own or are staff of. No duplicates.
 */
export async function accessibleSiteIds(actor: SiteActor): Promise<{ all: boolean; ids: string[] }> {
  if (actor.global.length > 0) return { all: true, ids: [] };
  return { all: false, ids: [...(await siteRelationsOf(actor.userId)).keys()] };
}

/** Server-action friendly: {error} instead of a throw, with the same message for every refusal. */
export async function siteGuard<T>(fn: () => Promise<T>): Promise<T | { error: string }> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof NotFoundError) return { error: "Not found." };
    throw e;
  }
}

/**
 * Page variant: resolves the site from a URL segment (slug or uuid), checks
 * access, and calls notFound() for both "no such site" and "not yours".
 * Signed-out visitors go to the staff login.
 */
export async function requireSitePage(
  param: string,
  need: SitePermission | readonly SitePermission[],
): Promise<SiteAccess> {
  const actor = await getSiteActor();
  if (!actor) redirect("/admin-login");
  const siteId = await resolveSiteId(param);
  const access = siteId ? await siteAccessFor(actor, siteId) : null;
  if (!access || !hasSitePermission(access.perms, need)) notFound();
  return access;
}
