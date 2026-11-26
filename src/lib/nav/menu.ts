// The one shared sidebar's menu: what exists, and who sees it.
//
// Pure data and functions, no server imports, so a test (and a client
// component, if ever needed) can import it. Like permissions.ts, this decides
// what to SHOW. It grants nothing: every page still enforces its own
// permission (requirePermissionOrRedirect / requireOwner), and
// scripts/test-admin-nav.js checks that each item a viewer is shown opens for
// them and each one hidden from them is refused when typed into the URL bar.
//
// Rule for `requires`: an item's list is the SAME list its page passes to
// requirePermissionOrRedirect. If the page accepts the viewer, the link is
// shown; if it would bounce them, the link is not. Change both together.

import { PERMISSIONS, hasAnyPermission, type Permission } from "@/lib/auth/permissions";
import type { StringKey } from "@/lib/i18n/strings";

export type SectionId = "admin" | "site" | "marketplace";

export interface NavItem {
  /** Where it goes. May carry a query (?tab=admins) to tell two entries on one page apart. */
  href: string;
  icon: string;
  /** English label for staff items. */
  label: string;
  /** i18n key for owner-portal items; wins over `label` when set. */
  labelKey?: StringKey;
  /** Shown when the viewer holds ANY of these. Absent on owner items (see `owner`). */
  requires?: readonly Permission[];
  /** Owner-portal item: shown only to an active property owner. */
  owner?: boolean;
}

export interface NavGroup {
  /** Small heading inside a section; only rendered when the section has more than one group. */
  label?: string;
  labelKey?: StringKey;
  items: NavItem[];
}

export interface NavSection {
  id: SectionId;
  heading: string;
  groups: NavGroup[];
}

/** Everything a staff member can hold except the survey-only permission. */
const NOT_SURVEY_ONLY = PERMISSIONS.filter((p) => p !== "surveys.input");

const MONEY_PAGES = ["bookings.operate", "payments.settle", "finance.view"] as const;

/**
 * Admin Management and Marketplace, in full. Site Management is built from
 * the sites the viewer can reach (see buildMenu), so it is not listed here.
 */
export const ADMIN_SECTION: NavSection = {
  id: "admin",
  heading: "Admin Management",
  groups: [
    {
      label: "Overview",
      items: [
        // /admin accepts every permission, but a survey-only account is sent
        // on to /survey by the layout — so for them it is not a destination.
        { href: "/admin", icon: "dashboard", label: "Dashboard", requires: NOT_SURVEY_ONLY },
      ],
    },
    {
      label: "People",
      items: [
        { href: "/admin/users", icon: "group", label: "Users", requires: ["users.manage", "staff.manage"] },
        { href: "/admin/users?tab=admins", icon: "badge", label: "Staff roles", requires: ["staff.manage"] },
      ],
    },
    {
      label: "Finance",
      items: [
        { href: "/admin/reports/position", icon: "account_balance", label: "Financial Position", requires: ["finance.view"] },
        { href: "/admin/reports/sales", icon: "trending_up", label: "Sales Report", requires: ["finance.view"] },
        { href: "/admin/expenses", icon: "payments", label: "Expenses", requires: ["finance.view", "finance.operate"] },
        { href: "/admin/placements", icon: "handshake", label: "Placements", requires: ["finance.view", "finance.operate"] },
      ],
    },
    {
      label: "System",
      items: [
        { href: "/admin/cron", icon: "schedule", label: "Daily Jobs", requires: ["platform.settings"] },
        { href: "/admin/settings", icon: "settings", label: "Settings", requires: ["platform.settings"] },
      ],
    },
  ],
};

const OWNER_ITEMS: NavItem[] = [
  { href: "/owner",            icon: "dashboard",   label: "Overview",   labelKey: "owner.nav.overview",   owner: true },
  { href: "/owner/properties", icon: "apartment",   label: "Properties", labelKey: "owner.nav.properties", owner: true },
  { href: "/owner/bookings",   icon: "hotel",       label: "Bookings",   labelKey: "owner.nav.bookings",   owner: true },
  { href: "/owner/viewings",   icon: "location_on", label: "Viewings",   labelKey: "owner.nav.viewings",   owner: true },
  { href: "/owner/earnings",   icon: "payments",    label: "Earnings",   labelKey: "owner.nav.earnings",   owner: true },
  { href: "/owner/placements", icon: "handshake",   label: "Placements", labelKey: "owner.nav.placements", owner: true },
  { href: "/owner/profile",    icon: "person",      label: "Profile",    labelKey: "owner.nav.profile",    owner: true },
];

export const MARKETPLACE_SECTION: NavSection = {
  id: "marketplace",
  heading: "Marketplace",
  groups: [
    {
      label: "Operations",
      items: [
        { href: "/admin/listings", icon: "apartment", label: "Listings", requires: ["listings.manage"] },
        { href: "/admin/inventory", icon: "inventory_2", label: "Inventory", requires: ["listings.manage"] },
        { href: "/admin/bookings", icon: "hotel", label: "Bookings", requires: MONEY_PAGES },
        { href: "/admin/viewings", icon: "location_on", label: "Viewings", requires: MONEY_PAGES },
        { href: "/admin/consultations", icon: "calendar_today", label: "Consultations", requires: ["bookings.operate"] },
        { href: "/admin/owners", icon: "real_estate_agent", label: "Owners", requires: ["listings.manage", "owners.payout_verify"] },
        { href: "/admin/owner-requests", icon: "rule", label: "Owner Requests", requires: ["listings.manage", "owners.payout_verify"] },
      ],
    },
    {
      label: "Surveys",
      items: [
        { href: "/survey", icon: "fact_check", label: "Surveys", requires: ["surveys.input"] },
        { href: "/admin/surveys/pending", icon: "assignment", label: "Survey Imports", requires: ["surveys.review"] },
      ],
    },
    {
      label: "My properties",
      labelKey: "owner.portal",
      items: OWNER_ITEMS,
    },
  ],
};

/** A coworking site as the sidebar needs it. */
export interface NavSite {
  id: string;
  /** Pages link sites by slug (/site/[slug]); the id resolves too. */
  slug: string;
  name: string;
}

/** The "all sites" entry and its per-site entries. Both open /site pages that accept either site permission. */
export const SITE_REQUIRES: readonly Permission[] = ["sites.operate_all", "sites.finance_all"];

export interface MenuInput {
  /** Union of the viewer's staff permissions; empty for a non-staff user. */
  permissions: readonly Permission[];
  /** True for a user whose owners row has portal_access = 'active'. */
  isOwner: boolean;
  /** From accessibleSites(); already filtered to what the viewer may open. */
  sites: readonly NavSite[];
}

function visible(item: NavItem, input: MenuInput): boolean {
  if (item.owner) return input.isOwner;
  return !!item.requires && hasAnyPermission(input.permissions, item.requires);
}

/**
 * The sections this viewer sees. Items they cannot use are dropped, then
 * groups with no items, then sections with no groups: an empty heading is
 * noise, and for a surveyor it would be three of them.
 */
export function buildMenu(input: MenuInput): NavSection[] {
  const siteSection: NavSection = {
    id: "site",
    heading: "Site Management",
    groups: [
      {
        items: [
          ...(hasAnyPermission(input.permissions, SITE_REQUIRES)
            ? [{ href: "/site", icon: "desk", label: "All sites", requires: SITE_REQUIRES } as NavItem]
            : []),
          ...input.sites.map(
            (s): NavItem => ({
              href: `/site/${s.slug}`,
              icon: "meeting_room",
              label: s.name,
              requires: SITE_REQUIRES,
            }),
          ),
        ],
      },
    ],
  };

  return [ADMIN_SECTION, siteSection, MARKETPLACE_SECTION]
    .map((section) => ({
      ...section,
      groups: section.groups
        .map((g) => ({ ...g, items: g.items.filter((i) => visible(i, input)) }))
        .filter((g) => g.items.length > 0),
    }))
    .filter((section) => section.groups.length > 0);
}

export function flattenMenu(sections: readonly NavSection[]): NavItem[] {
  return sections.flatMap((s) => s.groups.flatMap((g) => g.items));
}

/**
 * Where someone lands after signing in with no destination of their own.
 * Staff: the first item they have (a surveyor therefore lands on /survey,
 * everyone else on the dashboard). An active owner who is not staff: /owner.
 * Anyone else is an ordinary guest: /dashboard.
 *
 * Staff wins over owner when someone is both, matching the order of the menu.
 */
export function landingPath(input: MenuInput): string {
  const first = flattenMenu(buildMenu(input))[0];
  if (first) return first.href;
  return "/dashboard";
}

/**
 * Which item is current. Several can match by prefix (/admin matches
 * everything under it, /admin/users matches /admin/users?tab=admins), so
 * the most specific one wins and exactly one is ever marked.
 *
 * `activeHref` is what the page passes: a path, optionally with the query
 * that distinguishes two entries on one page.
 */
export function activeItemHref(items: readonly NavItem[], activeHref: string): string | null {
  const [activePath] = activeHref.split("?");
  let best: string | null = null;
  let bestScore = -1;
  for (const item of items) {
    const [path, query] = item.href.split("?");
    let score = -1;
    if (activeHref === item.href) score = 1000 + item.href.length;
    else if (query === undefined && path === activePath) score = 500 + path.length;
    else if (query === undefined && path !== "/admin" && path !== "/owner" && activePath.startsWith(path + "/")) {
      score = path.length;
    }
    if (score > bestScore) {
      bestScore = score;
      best = item.href;
    }
  }
  return best;
}
