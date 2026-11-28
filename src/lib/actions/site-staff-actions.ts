"use server";

import { createHash, randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireSiteAccess } from "@/lib/auth/site-access";
import { looksLikeUuid } from "@/lib/coworking/resolve";
import {
  isSiteRole, manageableSiteRoles, SITE_ROLE_LABELS, type SiteRole,
} from "@/lib/auth/site-permissions";

/**
 * Site staff and their invites (Phase 3).
 *
 * Who may manage whom (manageableSiteRoles):
 *   - the site owner and a superadmin: every site role;
 *   - a superstaff: front_office, back_office and finance — never another
 *     superstaff, and never the owner (who is not a site_staff row at all).
 * Global operate_all staff (admin_general) do not manage site staff.
 *
 * Delivery mirrors owner invites: email is not connected, so the action
 * returns a link and a prefilled WhatsApp link for the inviter to send. The
 * raw token is returned once and never stored — only its SHA-256 hash.
 */

const INVITE_DAYS = 7;
const NOT_FOUND = "Not found.";

const hash = (token: string) => createHash("sha256").update(token).digest("hex");
const siteOrigin = () => process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function manager(siteId: string) {
  const access = await requireSiteAccess(siteId, "site.staff");
  return {
    access,
    roles: manageableSiteRoles({ isSuperadmin: access.actor.isSuperadmin, relations: access.relations }),
  };
}

export interface SiteStaffRow {
  user_id: string;
  name: string | null;
  email: string | null;
  role: SiteRole;
  granted_at: string;
  /** Whether the viewer may revoke this role. */
  revocable: boolean;
}

export interface SiteInviteRow {
  id: string;
  email: string;
  role: SiteRole;
  created_at: string;
  expires_at: string;
  state: "open" | "redeemed" | "revoked" | "expired";
  revocable: boolean;
}

export async function listSiteStaff(siteId: string): Promise<{
  owner: { name: string; email: string | null } | null;
  staff: SiteStaffRow[];
  invites: SiteInviteRow[];
  invitable: SiteRole[];
}> {
  const { roles } = await manager(siteId);
  const admin = createAdminClient();

  const [{ data: site }, { data: rows }, { data: inv }] = await Promise.all([
    admin.from("sites").select("owner_id").eq("id", siteId).maybeSingle(),
    admin.from("site_staff").select("user_id, role, granted_at").eq("site_id", siteId).order("granted_at"),
    admin.from("site_staff_invites")
      .select("id, email, role, created_at, expires_at, redeemed_at, revoked_at")
      .eq("site_id", siteId).order("created_at", { ascending: false }).limit(50),
  ]);

  let owner = null;
  if (site?.owner_id) {
    const { data: o } = await admin.from("owners").select("name, email").eq("id", site.owner_id).maybeSingle();
    if (o) owner = { name: o.name as string, email: (o.email as string) ?? null };
  }

  const ids = [...new Set((rows ?? []).map((r) => r.user_id as string))];
  const { data: users } = ids.length
    ? await admin.from("users").select("id, name, email").in("id", ids)
    : { data: [] as { id: string; name: string | null; email: string | null }[] };
  const byId = new Map((users ?? []).map((u) => [u.id, u]));

  const now = Date.now();
  return {
    owner,
    staff: (rows ?? []).filter((r) => isSiteRole(r.role)).map((r) => ({
      user_id: r.user_id as string,
      name: (byId.get(r.user_id)?.name as string) ?? null,
      email: (byId.get(r.user_id)?.email as string) ?? null,
      role: r.role as SiteRole,
      granted_at: r.granted_at as string,
      revocable: roles.includes(r.role as SiteRole),
    })),
    invites: (inv ?? []).filter((i) => isSiteRole(i.role)).map((i) => {
      const state = i.redeemed_at ? "redeemed" : i.revoked_at ? "revoked"
        : Date.parse(i.expires_at as string) < now ? "expired" : "open";
      return {
        id: i.id as string,
        email: i.email as string,
        role: i.role as SiteRole,
        created_at: i.created_at as string,
        expires_at: i.expires_at as string,
        state,
        revocable: state === "open" && roles.includes(i.role as SiteRole),
      };
    }),
    invitable: roles,
  };
}

export interface StaffInviteResult {
  url: string;
  whatsappUrl: string;
  expiresAt: string;
}

/** Issue a single-use invite to one role on one site. */
export async function createSiteStaffInvite(siteId: string, fd: FormData):
  Promise<{ error: string } | { success: true; invite: StaffInviteResult }> {
  let m;
  try { m = await manager(siteId); } catch { return { error: NOT_FOUND }; }

  const role = String(fd.get("role") ?? "");
  if (!isSiteRole(role)) return { error: "Peran tidak dikenal." };
  if (!m.roles.includes(role)) {
    return { error: role === "superstaff"
      ? "Hanya pemilik site yang boleh mengangkat superstaff."
      : "Anda tidak boleh mengundang peran ini." };
  }

  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  if (!EMAIL.test(email)) return { error: "Email tidak valid." };

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + INVITE_DAYS * 86_400_000).toISOString();

  const admin = createAdminClient();
  const { error } = await admin.from("site_staff_invites").insert({
    site_id: siteId,
    role,
    email,
    token_hash: hash(token),
    invited_by: m.access.actor.userId,
    expires_at: expiresAt,
  });
  if (error) return { error: error.message };

  const { data: site } = await admin.from("sites").select("name, slug").eq("id", siteId).maybeSingle();
  const url = `${siteOrigin()}/invite/site/${token}`;
  const message =
    `Halo, Anda diundang sebagai ${SITE_ROLE_LABELS[role]} di ${site?.name ?? "site Cosystem"}. ` +
    `Masuk atau daftar dengan email ${email}, lalu buka tautan ini. ` +
    `Berlaku ${INVITE_DAYS} hari dan hanya dapat dipakai sekali: ${url}`;
  // Email is not connected; the inviter sends this by hand. With a number the
  // link opens that chat, without one WhatsApp asks whom to send it to.
  const phone = String(fd.get("phone") ?? "").replace(/\D/g, "");
  const whatsappUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;

  revalidatePath(`/site/${site?.slug ?? siteId}/staff`);
  return { success: true, invite: { url, whatsappUrl, expiresAt } };
}

/** Withdraw an invite that has not been used. Its site comes from the invite. */
export async function revokeSiteStaffInvite(inviteId: string): Promise<{ error?: string; success?: true }> {
  if (!looksLikeUuid(String(inviteId ?? ""))) return { error: NOT_FOUND };
  const admin = createAdminClient();
  const { data: inv } = await admin
    .from("site_staff_invites").select("id, site_id, role, redeemed_at, revoked_at").eq("id", inviteId).maybeSingle();
  if (!inv) return { error: NOT_FOUND };

  let m;
  try { m = await manager(inv.site_id as string); } catch { return { error: NOT_FOUND }; }
  if (!m.roles.includes(inv.role as SiteRole)) return { error: "Anda tidak boleh mencabut undangan peran ini." };
  if (inv.redeemed_at) return { error: "Undangan ini sudah dipakai." };

  const { error } = await admin
    .from("site_staff_invites").update({ revoked_at: new Date().toISOString() })
    .eq("id", inviteId).is("redeemed_at", null).is("revoked_at", null);
  if (error) return { error: error.message };
  revalidatePath("/site", "layout");
  return { success: true };
}

/**
 * Remove one person's role on a site. Effective on their next request:
 * requireSiteAccess re-reads site_staff every call.
 */
export async function revokeSiteStaffRole(siteId: string, userId: string, role: string):
  Promise<{ error?: string; success?: true }> {
  let m;
  try { m = await manager(siteId); } catch { return { error: NOT_FOUND }; }
  if (!isSiteRole(role)) return { error: "Peran tidak dikenal." };
  if (!m.roles.includes(role)) {
    return { error: role === "superstaff"
      ? "Hanya pemilik site yang boleh mencabut superstaff."
      : "Anda tidak boleh mencabut peran ini." };
  }

  const admin = createAdminClient();
  const { data: gone, error } = await admin
    .from("site_staff").delete()
    .eq("site_id", siteId).eq("user_id", userId).eq("role", role)
    .select("user_id");
  if (error) return { error: error.message };
  if (!gone?.length) return { error: NOT_FOUND };

  // A superstaff who loses the role loses the invites they issued but nobody
  // has used yet: an invite should not outlive the authority it came from.
  if (role === "superstaff") {
    await admin.from("site_staff_invites")
      .update({ revoked_at: new Date().toISOString() })
      .eq("site_id", siteId).eq("invited_by", userId)
      .is("redeemed_at", null).is("revoked_at", null);
  }

  revalidatePath("/site", "layout");
  return { success: true };
}

const REDEEM_MESSAGES: Record<string, string> = {
  invite_invalid: "Tautan undangan tidak valid.",
  invite_already_used: "Undangan ini sudah dipakai.",
  invite_revoked: "Undangan ini sudah dicabut.",
  invite_expired: "Undangan ini sudah kedaluwarsa. Minta undangan baru.",
  invite_email_mismatch: "Undangan ini untuk email lain. Masuk dengan email yang diundang.",
  invite_email_unconfirmed: "Email akun Anda belum dikonfirmasi. Buka tautan konfirmasi di email Anda, lalu buka undangan ini lagi.",
};

/**
 * Redeem an invite for the signed-in user. A form action, so it works before
 * hydration. Every refusal is decided by redeem_site_staff_invite; this only
 * maps the code to a sentence.
 */
export async function acceptSiteStaffInvite(
  _prev: { error?: string } | null,
  fd: FormData,
): Promise<{ error?: string }> {
  const token = String(fd.get("token") ?? "");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/auth/login?next=${encodeURIComponent(`/invite/site/${token}`)}`);

  const { data, error } = await createAdminClient().rpc("redeem_site_staff_invite", {
    p_token_hash: hash(token),
    p_user_id: user.id,
  });
  if (error) {
    const key = Object.keys(REDEEM_MESSAGES).find((k) => error.message.includes(k));
    return { error: key ? REDEEM_MESSAGES[key] : REDEEM_MESSAGES.invite_invalid };
  }
  const row = (Array.isArray(data) ? data[0] : data) as { site_slug: string } | undefined;
  revalidatePath("/site", "layout");
  redirect(`/site/${row?.site_slug ?? ""}`);
}

// ── Form-action shapes (useActionState), so the staff page works before hydration ──

export async function inviteSiteStaffForm(
  _prev: { error?: string; invite?: StaffInviteResult } | null,
  fd: FormData,
): Promise<{ error?: string; invite?: StaffInviteResult }> {
  const res = await createSiteStaffInvite(String(fd.get("site_id") ?? ""), fd);
  return "error" in res ? { error: res.error } : { invite: res.invite };
}

export async function revokeSiteStaffRoleForm(_prev: { error?: string } | null, fd: FormData) {
  return revokeSiteStaffRole(String(fd.get("site_id") ?? ""), String(fd.get("user_id") ?? ""), String(fd.get("role") ?? ""));
}

export async function revokeSiteStaffInviteForm(_prev: { error?: string } | null, fd: FormData) {
  return revokeSiteStaffInvite(String(fd.get("invite_id") ?? ""));
}
