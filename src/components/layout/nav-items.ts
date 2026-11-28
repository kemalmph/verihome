import type { StringKey } from "@/lib/i18n/strings";

/**
 * The public header's menu, shared by the desktop dropdowns and the phone
 * panel so the two cannot drift apart.
 *
 * Product / Solutions / Pricing / Resources come from the V7 copy. Where the
 * copy names something that does not exist yet, the link goes to the
 * nearest real thing rather than to a 404:
 *   - Pricing: there is no pricing page; plans are quoted → /contact.
 *   - Resources: there is no blog or docs. It carries the marketplace and
 *     list-your-property, which the new homepage no longer links, so they
 *     stay one click from every public page.
 * Every in-page anchor here must exist on the homepage —
 * scripts/test-homepage-links.js checks it.
 */
export type NavLink = { href: string; label: StringKey; blurb?: StringKey };
export type NavEntry =
  | { kind: "link"; href: string; label: StringKey }
  | { kind: "menu"; label: StringKey; items: NavLink[] };

export const PUBLIC_NAV: NavEntry[] = [
  {
    kind: "menu",
    label: "nav.product",
    items: [
      { href: "/#features", label: "nav.p.features", blurb: "nav.p.featuresBlurb" },
      { href: "/#platform", label: "nav.p.platform", blurb: "nav.p.platformBlurb" },
    ],
  },
  {
    kind: "menu",
    label: "nav.solutions",
    items: [
      { href: "/#solutions", label: "home.models.cowork.t", blurb: "home.models.cowork.d" },
      { href: "/#solutions", label: "home.models.office.t", blurb: "home.models.office.d" },
      { href: "/#solutions", label: "home.models.hub.t", blurb: "home.models.hub.d" },
      { href: "/#solutions", label: "home.models.live.t", blurb: "home.models.live.d" },
    ],
  },
  { kind: "link", href: "/contact", label: "nav.pricing" },
  {
    kind: "menu",
    label: "nav.resources",
    items: [
      { href: "/listings", label: "nav.r.marketplace", blurb: "nav.r.marketplaceBlurb" },
      { href: "/list-your-property", label: "footer.listProperty", blurb: "nav.r.listBlurb" },
      { href: "/contact", label: "nav.contact", blurb: "nav.r.contactBlurb" },
    ],
  },
];
