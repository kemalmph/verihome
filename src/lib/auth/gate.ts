import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth/guards";

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
