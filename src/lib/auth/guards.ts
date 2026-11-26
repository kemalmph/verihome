import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import {
  hasAnyPermission, hasPermission, isStaffRole, permissionsForRoles,
  type Permission, type StaffRole,
} from "@/lib/auth/permissions";

// Authorization guards for server actions and server components.
//
// These exist because a route-group layout does not protect a server action.
// A layout gates *rendering* a page; server actions are separately addressable
// RPC endpoints that any signed-in client can invoke directly, whatever page
// they are on. Every privileged action has to check for itself.

export interface Viewer {
  id: string;
  email: string | null;
  name: string | null;
  /** Every staff role the user holds (empty array is never returned: that is "not staff", i.e. null). */
  roles: StaffRole[];
  /** Union of the permissions those roles grant. */
  permissions: Permission[];
}

/**
 * Resolves the signed-in staff member, or null when they hold no staff role.
 * Roles are re-read from staff_roles on every call, so a revoked role stops
 * working on the very next request.
 */
export async function getViewer(): Promise<Viewer | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();
  const [{ data: profile }, { data: rows }] = await Promise.all([
    admin.from("users").select("id, email, name").eq("id", user.id).single(),
    admin.from("staff_roles").select("role").eq("user_id", user.id),
  ]);
  if (!profile) return null;

  const roles = (rows ?? []).map((r) => r.role).filter(isStaffRole);
  if (roles.length === 0) return null;

  return {
    id: profile.id as string,
    email: (profile.email as string) ?? null,
    name: (profile.name as string) ?? null,
    roles,
    permissions: permissionsForRoles(roles),
  };
}

/** Throws unless the caller holds the permission. Call at the top of every action and route. */
export async function requirePermission(perm: Permission): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) throw new Error("You need to be signed in as staff.");
  if (!hasPermission(viewer.permissions, perm)) {
    throw new Error("You do not have permission to do this.");
  }
  return viewer;
}

/** Throws unless the caller holds at least one of the permissions. */
export async function requireAnyPermission(perms: readonly Permission[]): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) throw new Error("You need to be signed in as staff.");
  if (!hasAnyPermission(viewer.permissions, perms)) {
    throw new Error("You do not have permission to do this.");
  }
  return viewer;
}

/**
 * Page-level variant: redirects instead of throwing. Staff without the
 * permission go to /admin (their landing page); everyone else to the staff
 * login. Server actions and routes must still check for themselves.
 */
export async function requirePermissionOrRedirect(
  perms: Permission | readonly Permission[],
): Promise<Viewer> {
  const list = typeof perms === "string" ? [perms] : perms;
  const viewer = await getViewer();
  if (!viewer) redirect("/admin-login");
  if (!hasAnyPermission(viewer.permissions, list)) {
    redirect(viewer.permissions.includes("surveys.input") && viewer.roles.length === 1 ? "/survey" : "/admin");
  }
  return viewer;
}

/**
 * Soft check for UI that only chooses what to show (a link, a column). Never
 * a substitute for requirePermission in the code that does the work.
 */
export async function viewerCan(...perms: Permission[]): Promise<boolean> {
  const viewer = await getViewer();
  return !!viewer && hasAnyPermission(viewer.permissions, perms);
}

/** Server-action friendly wrapper: returns {error} instead of throwing. */
export async function guard(perms: Permission | readonly Permission[]):
  Promise<{ viewer: Viewer; error?: undefined } | { viewer?: undefined; error: string }> {
  try {
    const viewer = typeof perms === "string"
      ? await requirePermission(perms)
      : await requireAnyPermission(perms);
    return { viewer };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

/**
 * DEPRECATED, kept only so a caller we missed fails closed: superadmin only.
 * Every caller should use requirePermission with the permission it needs.
 */
export async function requireAdmin(): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) throw new Error("You need to be signed in.");
  if (!viewer.roles.includes("superadmin")) throw new Error("Admin access required.");
  return viewer;
}

/** Can record surveys. Alias for requirePermission("surveys.input"). */
export async function requireSurveyAccess(): Promise<Viewer> {
  return requirePermission("surveys.input");
}

// ── Owner portal ────────────────────────────────────────────────────────────

export interface OwnerViewer {
  /** The authenticated user. */
  userId: string;
  /** The owners row this user controls. Every owner-scoped query filters by it. */
  ownerId: string;
  ownerName: string;
  email: string | null;
}

/**
 * Thrown when an owner asks for something that is not theirs.
 *
 * Deliberately the same error as "does not exist". Telling an owner that a
 * record exists but belongs to someone else confirms the existence of other
 * owners' properties, bookings and earnings — a slower way to enumerate them,
 * but a way. Not-found reveals nothing.
 */
export class NotFoundError extends Error {
  constructor(message = "Not found.") {
    super(message);
    this.name = "NotFoundError";
  }
}

/**
 * Resolves the owner record the caller controls, or throws.
 *
 * Ownership is NOT a role on the user: the same person can be a guest who books
 * stays and an owner who lets a property. It is a relationship, stored on
 * owners.user_id and established only by redeeming an admin-issued invite.
 *
 * portal_access is re-read on every call, so revoking an owner takes effect on
 * their very next request rather than at their next sign-in — a live session
 * must not outlive the access it was granted under.
 *
 * Every owner-scoped server action and query calls this itself and filters by
 * the returned ownerId. Fetching by record id alone is never sufficient.
 */
export async function requireOwner(): Promise<OwnerViewer> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new NotFoundError("You need to be signed in.");

  const admin = createAdminClient();
  const { data: owner } = await admin
    .from("owners")
    .select("id, name, email, portal_access")
    .eq("user_id", user.id)
    .maybeSingle();

  // 'invited' is not access: the token has been issued but never redeemed.
  // 'revoked' and 'none' are refused outright.
  if (!owner || owner.portal_access !== "active") {
    throw new NotFoundError("Owner portal access required.");
  }

  return {
    userId: user.id,
    ownerId: owner.id as string,
    ownerName: (owner.name as string) ?? "",
    email: (owner.email as string) ?? null,
  };
}

/**
 * Confirms a property belongs to this owner, and returns it.
 *
 * The pattern every owner-scoped read follows: filter by record id AND owner
 * id together, in one query, and treat a miss as not-found. Loading by id and
 * then comparing owner_id in JavaScript is the same bug written later — by
 * then the row has already been read.
 */
export async function ownedProperty(ownerId: string, propertyId: string) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("properties")
    .select("id, name, slug, area, address, status, rental_mode, owner_id, platform_commission_pct, cleaning_fee_goes_to, google_maps_url")
    .eq("id", propertyId)
    .eq("owner_id", ownerId)
    .maybeSingle();

  if (!data) throw new NotFoundError();
  return data;
}
