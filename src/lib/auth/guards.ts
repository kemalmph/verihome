import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Authorization guards for server actions and server components.
//
// These exist because a route-group layout does not protect a server action.
// A layout gates *rendering* a page; server actions are separately addressable
// RPC endpoints that any signed-in client can invoke directly, whatever page
// they are on. Every privileged action has to check for itself.

export type AccessRole = "admin" | "surveyor";

export interface Viewer {
  id: string;
  email: string | null;
  name: string | null;
  role: AccessRole;
}

async function currentProfile() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("users")
    .select("id, email, name, is_admin, is_surveyor")
    .eq("id", user.id)
    .single();

  if (!profile) return null;
  return profile as {
    id: string; email: string | null; name: string | null;
    is_admin: boolean | null; is_surveyor: boolean | null;
  };
}

/** Resolves the viewer's role, or null when they have neither. Admin outranks surveyor. */
export async function getViewer(): Promise<Viewer | null> {
  const p = await currentProfile();
  if (!p) return null;
  const base = { id: p.id, email: p.email, name: p.name };
  if (p.is_admin)    return { ...base, role: "admin" };
  if (p.is_surveyor) return { ...base, role: "surveyor" };
  return null;
}

/** Throws unless the caller is an admin. Use at the top of every admin server action. */
export async function requireAdmin(): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer)                 throw new Error("You need to be signed in.");
  if (viewer.role !== "admin") throw new Error("Admin access required.");
  return viewer;
}

/** Throws unless the caller can record surveys — surveyors, and admins by inheritance. */
export async function requireSurveyAccess(): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) throw new Error("You need to be signed in as a surveyor.");
  return viewer;
}
