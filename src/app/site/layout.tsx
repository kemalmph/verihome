import { requireAdminPageOrRedirect } from "@/lib/auth/gate";

/**
 * /site is staff-only, exactly like /admin.
 *
 * Moving these pages out of /admin took them out from under that tree's
 * layout and out of the proxy's PROTECTED_PREFIXES in one go. Both are
 * restored here and in src/proxy.ts: a nicer URL is not worth a quieter door.
 */
export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  await requireAdminPageOrRedirect();
  return <>{children}</>;
}
