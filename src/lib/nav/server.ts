import { getViewer, requireOwner, type Viewer, type OwnerViewer } from "@/lib/auth/guards";
import { accessibleSites } from "@/lib/sites/accessible";
import { getSiteActor } from "@/lib/auth/site-access";
import { landingPath, type MenuInput } from "@/lib/nav/menu";
import { createAdminClient } from "@/lib/supabase/admin";

export interface NavContext extends MenuInput {
  viewer: Viewer | null;
  owner: OwnerViewer | null;
}

/**
 * Everything the sidebar and the post-login redirect need to know about the
 * signed-in person: their staff roles, whether they are an active property
 * owner, and the sites they can reach. One person can be several of these at
 * once; the menu is the union, with no role picker.
 *
 * Both lookups re-read the database on every call (getViewer, requireOwner),
 * so a revoked role or owner access disappears from the menu on the next
 * request. Failing to resolve either one is "not that", never an error.
 */
export async function getNavContext(): Promise<NavContext> {
  const [viewer, owner, actor] = await Promise.all([
    getViewer(),
    requireOwner().catch(() => null),
    getSiteActor(),
  ]);
  // Sites come from the signed-in person, staff or not: a site owner or site
  // staff member holds no staff role (viewer is null) and still has sites.
  const sites = await accessibleSites(actor);

  // The property-owner portal (Marketplace → "Portal Pemilik") is offered only
  // to an owner who has at least one property. An owners row is also what
  // makes someone a SITE owner, and a person who only owns a coworking site
  // has nothing in that portal: they see Site Management alone. This only
  // decides what the menu shows — the /owner gate (requireOwner) is unchanged.
  let ownsProperty = false;
  if (owner) {
    const { count } = await createAdminClient()
      .from("properties").select("id", { count: "exact", head: true })
      .eq("owner_id", owner.ownerId);
    ownsProperty = (count ?? 0) > 0;
  }

  return {
    viewer,
    owner,
    permissions: viewer?.permissions ?? [],
    isOwner: ownsProperty,
    sites,
  };
}

/** Where to send someone who has just signed in without asking for a particular page. */
export async function defaultLanding(): Promise<string> {
  return landingPath(await getNavContext());
}
