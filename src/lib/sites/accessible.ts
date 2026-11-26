import { createAdminClient } from "@/lib/supabase/admin";
import { hasAnyPermission } from "@/lib/auth/permissions";
import type { Viewer } from "@/lib/auth/guards";
import type { NavSite } from "@/lib/nav/menu";

/**
 * The coworking sites this viewer may open.
 *
 * Today there is one branch: a global site permission (sites.operate_all or
 * sites.finance_all) reaches every site. Phase 3 adds the other one — sites
 * the viewer owns or is staff of (site_staff) — and returns the union. Callers
 * already treat the result as "the list", so that change stays in this file.
 *
 * Used to decide what the sidebar lists. Opening a site is still checked by
 * the page itself.
 */
export async function accessibleSites(viewer: Viewer | null): Promise<NavSite[]> {
  if (!viewer) return [];
  if (!hasAnyPermission(viewer.permissions, ["sites.operate_all", "sites.finance_all"])) {
    return [];
  }
  const { data } = await createAdminClient()
    .from("sites")
    .select("id, slug, name")
    .order("name", { ascending: true });
  return (data ?? []).map((s) => ({ id: s.id as string, slug: s.slug as string, name: s.name as string }));
}
