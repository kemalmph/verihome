import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth/guards";
import { getSiteActor } from "@/lib/auth/site-access";
import { accessibleSites } from "@/lib/sites/accessible";
import { defaultLanding } from "@/lib/nav/server";

/**
 * The staff gate, in one place.
 *
 * /admin and /site are two route trees serving the same staff. Anyone with at
 * least one staff role may walk in; what they can DO there is decided page by
 * page and action by action (requirePermission*), because this is a redirect
 * for people who took a wrong turn, not the access control: a layout gates
 * rendering and a server action is separately addressable (§19.6).
 *
 * A surveyor holds no permission that any /admin or /site page accepts, so
 * they are sent to the one area they do have — sending them back to the login
 * form would loop, since they are already signed in.
 */
export async function requireAdminPageOrRedirect() {
  const viewer = await getViewer();
  if (!viewer) redirect("/admin-login");
  if (viewer.roles.every((r) => r === "surveyor")) redirect("/survey");
}

/**
 * The /site gate (Phase 3). Staff enter as before. So do people who are not
 * Cosystem staff but own a site or are site_staff somewhere — their access is
 * per site, and each page and action checks it (requireSitePage /
 * requireSiteAccess). Anyone else goes where they would have landed.
 */
export async function requireSiteAreaOrRedirect() {
  const actor = await getSiteActor();
  if (!actor) redirect("/admin-login");
  if (actor.staffRoles.length > 0 && !actor.staffRoles.every((r) => r === "surveyor")) return;
  if ((await accessibleSites(actor)).length > 0) return;
  if (actor.staffRoles.length > 0) redirect("/survey");
  redirect(await defaultLanding());
}
