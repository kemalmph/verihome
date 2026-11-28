// The one site-role → site-permission map for coworking sites (Phase 3).
//
// A site permission is held FOR ONE SITE. It comes from one of three places:
//   - a global staff permission (sites.operate_all / sites.finance_all, or
//     superadmin), which reaches every site — see globalSitePermissions();
//   - being the site's owner: sites.owner_id → owners row whose user_id is the
//     viewer and portal_access = 'active';
//   - a site_staff row (site_id, user_id, role).
//
// Pure: no server imports, so client components and tests can read it. It
// decides what to SHOW. Enforcement is requireSiteAccess() in site-access.ts,
// called by every site action, route and page itself.
//
// scripts/test-site-isolation.js holds the owner's matrix written out by hand
// and asserts this file equals it, so the two cannot drift apart silently.

import type { Permission, StaffRole } from "@/lib/auth/permissions";

export const SITE_ROLES = ["superstaff", "front_office", "back_office", "finance"] as const;
export type SiteRole = (typeof SITE_ROLES)[number];

/** A site role, or being the site's owner. Owner is a relationship, not a site_staff row. */
export type SiteRelation = SiteRole | "owner";

export const SITE_PERMISSIONS = [
  "site.view",              // open the site: details, unit list, occupancy
  "site.reservations.view", // reservation detail, calendar (read)
  "site.reservations",      // operate reservations: utilities, items on a booking
  "site.members.view",      // list memberships and plans
  "site.members",           // create memberships, change their status (not payment)
  "site.events",            // create events, hold rooms for them, change their status
  "site.units",             // units and unit amenities
  "site.catalog",           // item catalog and membership plans
  "site.documents.view",    // download invoice/receipt documents only
  "site.documents",         // upload, download (any kind), remove documents
  "site.settings",          // site details (never owner_id) and site amenities
  "site.billing",           // payment status, instalments, billing summary
  "site.staff",             // site staff and invites
  "site.revenue",           // committed rent, item sales, COGS, margin — global finance only (§20.7)
] as const;
export type SitePermission = (typeof SITE_PERMISSIONS)[number];

/**
 * What each relation grants inside its site.
 *
 * No site relation holds site.revenue: revenue, ledger and financial reports
 * for a site wait on the revenue-share decision (§20.7). Global finance only.
 */
export const SITE_ROLE_PERMISSIONS: Record<SiteRelation, readonly SitePermission[]> = {
  owner: SITE_PERMISSIONS.filter((p) => p !== "site.revenue"),
  // Everything the owner has. The one thing a superstaff cannot do — appoint
  // or remove another superstaff — is a rule inside the staff actions, not a
  // missing permission: they do manage the other three roles.
  superstaff: SITE_PERMISSIONS.filter((p) => p !== "site.revenue"),
  front_office: [
    "site.view", "site.reservations.view", "site.reservations",
    "site.members.view", "site.members", "site.events",
  ],
  back_office: [
    "site.view", "site.reservations.view", "site.members.view",
    "site.units", "site.catalog", "site.documents", "site.settings",
  ],
  finance: [
    "site.view", "site.reservations.view", "site.members.view",
    "site.billing", "site.documents.view",
  ],
};

/**
 * Site permissions a global staff member holds on EVERY site.
 *  - sites.operate_all: everything except billing, staff and revenue.
 *  - sites.finance_all: billing and revenue, plus read access.
 *  - superadmin: all of it, including managing site staff.
 */
export function globalSitePermissions(
  roles: readonly StaffRole[],
  permissions: readonly Permission[],
): SitePermission[] {
  if (roles.includes("superadmin")) return [...SITE_PERMISSIONS];
  const set = new Set<SitePermission>();
  if (permissions.includes("sites.operate_all")) {
    for (const p of SITE_PERMISSIONS) {
      if (p !== "site.billing" && p !== "site.staff" && p !== "site.revenue") set.add(p);
    }
  }
  if (permissions.includes("sites.finance_all")) {
    for (const p of [
      "site.view", "site.reservations.view", "site.members.view",
      "site.documents.view", "site.billing", "site.revenue",
    ] as const) set.add(p);
  }
  return [...set];
}

export function sitePermissionsFor(relations: readonly SiteRelation[]): SitePermission[] {
  const set = new Set<SitePermission>();
  for (const r of relations) for (const p of SITE_ROLE_PERMISSIONS[r] ?? []) set.add(p);
  return [...set];
}

export function isSiteRole(v: unknown): v is SiteRole {
  return typeof v === "string" && (SITE_ROLES as readonly string[]).includes(v);
}

export function hasSitePermission(
  perms: readonly SitePermission[],
  need: SitePermission | readonly SitePermission[],
): boolean {
  const list = typeof need === "string" ? [need] : need;
  return list.some((p) => perms.includes(p));
}

/** Document kinds site.documents.view opens. Contracts and IDs need site.documents. */
export const BILLING_DOCUMENT_KINDS = ["invoice", "receipt"] as const;

export function canSeeDocumentKind(perms: readonly SitePermission[], kind: string): boolean {
  if (perms.includes("site.documents")) return true;
  return perms.includes("site.documents.view") &&
    (BILLING_DOCUMENT_KINDS as readonly string[]).includes(kind);
}

/**
 * Which site roles this person may invite or revoke.
 *  - owner (and superadmin): every role.
 *  - superstaff: front_office, back_office, finance — never another superstaff.
 */
export function manageableSiteRoles(opts: { isSuperadmin: boolean; relations: readonly SiteRelation[] }): SiteRole[] {
  if (opts.isSuperadmin || opts.relations.includes("owner")) return [...SITE_ROLES];
  if (opts.relations.includes("superstaff")) return ["front_office", "back_office", "finance"];
  return [];
}

export const SITE_ROLE_LABELS: Record<SiteRelation, string> = {
  owner: "Pemilik site",
  superstaff: "Superstaff",
  front_office: "Front office",
  back_office: "Back office",
  finance: "Finance",
};
