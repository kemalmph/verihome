import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth/guards";

/**
 * The admin gate, in one place.
 *
 * /admin and /site are two route trees serving the same staff, and the rule
 * for reaching either is identical. Copying the three lines into a second
 * layout is how one of them quietly loses a branch — the surveyor redirect,
 * say — and nobody notices because the other tree still behaves.
 *
 * This is a redirect for people who took a wrong turn. It is NOT the access
 * control: every page calls requireAdmin() and every action calls it again,
 * because a layout gates rendering and a server action is separately
 * addressable (§19.6).
 */
export async function requireAdminPageOrRedirect() {
  const viewer = await getViewer();

  // Surveyors sign in through the same page and land here. Sending them back
  // to the login form would loop, since they are already signed in — route
  // them to the one area they do have access to.
  if (viewer?.role === "surveyor") redirect("/survey");
  if (viewer?.role !== "admin") redirect("/admin-login");
}
