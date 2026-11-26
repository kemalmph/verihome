import { getViewer, requireOwner, type Viewer, type OwnerViewer } from "@/lib/auth/guards";
import { accessibleSites } from "@/lib/sites/accessible";
import { landingPath, type MenuInput } from "@/lib/nav/menu";

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
  const [viewer, owner] = await Promise.all([
    getViewer(),
    requireOwner().catch(() => null),
  ]);
  const sites = await accessibleSites(viewer);
  return {
    viewer,
    owner,
    permissions: viewer?.permissions ?? [],
    isOwner: !!owner,
    sites,
  };
}

/** Where to send someone who has just signed in without asking for a particular page. */
export async function defaultLanding(): Promise<string> {
  return landingPath(await getNavContext());
}
