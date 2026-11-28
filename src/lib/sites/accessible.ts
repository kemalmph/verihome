import { createAdminClient } from "@/lib/supabase/admin";
import { siteRelationsOf, type SiteActor } from "@/lib/auth/site-access";
import { sitePermissionsFor } from "@/lib/auth/site-permissions";
import type { NavSite } from "@/lib/nav/menu";

/**
 * The coworking sites this person may open, each with the site permissions
 * they hold there.
 *
 * The union of two branches, without duplicates:
 *  - global: sites.operate_all / sites.finance_all (or superadmin) reaches
 *    every site, with the permissions globalSitePermissions() gives;
 *  - per site: sites they own (owners.portal_access = 'active') or are
 *    site_staff of, with what those relations grant.
 * Someone who is both gets, per site, the union of the two.
 *
 * Used to decide what the sidebar lists. Opening a site, and every action in
 * it, is still checked by requireSiteAccess.
 */
export async function accessibleSites(actor: SiteActor | null): Promise<NavSite[]> {
  if (!actor) return [];
  const relations = await siteRelationsOf(actor.userId);
  const global = actor.global.length > 0;
  if (!global && relations.size === 0) return [];

  let query = createAdminClient().from("sites").select("id, slug, name").order("name", { ascending: true });
  if (!global) query = query.in("id", [...relations.keys()]);
  const { data } = await query;

  return (data ?? []).map((s) => ({
    id: s.id as string,
    slug: s.slug as string,
    name: s.name as string,
    perms: [...new Set([...actor.global, ...sitePermissionsFor(relations.get(s.id as string) ?? [])])],
  }));
}
