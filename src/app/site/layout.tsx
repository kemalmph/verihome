import { requireSiteAreaOrRedirect } from "@/lib/auth/gate";

/**
 * /site is for staff and, since Phase 3, for site owners and site staff —
 * each of whom only reaches their own sites (requireSitePage on every page,
 * requireSiteAccess in every action).
 *
 * Moving these pages out of /admin took them out from under that tree's
 * layout and out of the proxy's PROTECTED_PREFIXES in one go. Both are
 * restored here and in src/proxy.ts: a nicer URL is not worth a quieter door.
 */
export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  await requireSiteAreaOrRedirect();
  return <>{children}</>;
}
