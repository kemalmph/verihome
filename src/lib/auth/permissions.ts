// The one role → permission map for Cosystem staff.
//
// Mirrored in SQL by public.staff_role_permissions() (migration
// 20261126120000_staff_roles.sql) for RLS; scripts/test-staff-permissions.js
// asserts the two agree. Change both together.
//
// This file has no server imports so client components can use it to decide
// what to *show*. Showing is a convenience; enforcement is requirePermission()
// in guards.ts, called by every action and route itself.

export const STAFF_ROLES = [
  "superadmin",
  "admin_general",
  "admin_listings",
  "admin_finance",
  "surveyor",
] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export const PERMISSIONS = [
  "staff.manage",         // grant/revoke staff roles
  "users.manage",         // edit/delete ordinary (non-staff) users
  "listings.manage",      // properties, listing builder, uploads, rates, owners
  "bookings.operate",     // viewings, bookings, consultations, non-money owner requests
  "payments.settle",      // verify payment proofs, settle booking/viewing money
  "owners.payout_verify", // approve owner payout-account changes
  "finance.view",         // read ledger, reports, money lists
  "finance.operate",      // credit refunds, placements/commission, expenses
  "surveys.input",        // record a survey
  "surveys.review",       // link/reject pending survey imports
  "sites.operate_all",    // operate every coworking site
  "sites.finance_all",    // coworking money across every site
  "platform.settings",    // platform settings, cron
] as const;
export type Permission = (typeof PERMISSIONS)[number];

export const ROLE_PERMISSIONS: Record<StaffRole, readonly Permission[]> = {
  superadmin: PERMISSIONS,
  admin_general: [
    "users.manage", "listings.manage", "bookings.operate",
    "surveys.input", "surveys.review", "sites.operate_all",
  ],
  admin_listings: [
    "listings.manage", "bookings.operate", "surveys.input", "surveys.review",
  ],
  admin_finance: [
    "payments.settle", "owners.payout_verify", "finance.view",
    "finance.operate", "sites.finance_all",
  ],
  surveyor: ["surveys.input"],
};

export function isStaffRole(v: unknown): v is StaffRole {
  return typeof v === "string" && (STAFF_ROLES as readonly string[]).includes(v);
}

export function permissionsForRoles(roles: readonly StaffRole[]): Permission[] {
  const set = new Set<Permission>();
  for (const r of roles) for (const p of ROLE_PERMISSIONS[r] ?? []) set.add(p);
  return [...set];
}

export function hasPermission(perms: readonly Permission[], p: Permission): boolean {
  return perms.includes(p);
}
export function hasAnyPermission(perms: readonly Permission[], list: readonly Permission[]): boolean {
  return list.some((p) => perms.includes(p));
}
