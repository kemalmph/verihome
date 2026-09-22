import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Authorization guards for server actions and server components.
//
// These exist because a route-group layout does not protect a server action.
// A layout gates *rendering* a page; server actions are separately addressable
// RPC endpoints that any signed-in client can invoke directly, whatever page
// they are on. Every privileged action has to check for itself.

export type AccessRole = "admin" | "surveyor";

export interface Viewer {
  id: string;
  email: string | null;
  name: string | null;
  role: AccessRole;
}

async function currentProfile() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("users")
    .select("id, email, name, is_admin, is_surveyor")
    .eq("id", user.id)
    .single();

  if (!profile) return null;
  return profile as {
    id: string; email: string | null; name: string | null;
    is_admin: boolean | null; is_surveyor: boolean | null;
  };
}

/** Resolves the viewer's role, or null when they have neither. Admin outranks surveyor. */
export async function getViewer(): Promise<Viewer | null> {
  const p = await currentProfile();
  if (!p) return null;
  const base = { id: p.id, email: p.email, name: p.name };
  if (p.is_admin)    return { ...base, role: "admin" };
  if (p.is_surveyor) return { ...base, role: "surveyor" };
  return null;
}

/** Throws unless the caller is an admin. Use at the top of every admin server action. */
export async function requireAdmin(): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer)                 throw new Error("You need to be signed in.");
  if (viewer.role !== "admin") throw new Error("Admin access required.");
  return viewer;
}

/** Throws unless the caller can record surveys — surveyors, and admins by inheritance. */
export async function requireSurveyAccess(): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) throw new Error("You need to be signed in as a surveyor.");
  return viewer;
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
