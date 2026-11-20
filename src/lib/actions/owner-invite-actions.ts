"use server";

import { createHash, randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const INVITE_DAYS = 7;

/** The raw token never touches the database — only this hash does. */
function hash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function siteOrigin(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

export interface InviteResult {
  url: string;
  /** Prefilled WhatsApp link, because email delivery is not connected. */
  whatsappUrl: string | null;
  expiresAt: string;
}

/**
 * Issues a single-use portal invite for one owner record.
 *
 * Admin-initiated by design. Linking on a typed email address would let anyone
 * claim another person's properties by entering their address — the token binds
 * the link to one specific owner record chosen by someone who already knows it
 * is theirs.
 *
 * The raw token is returned once, here, and never stored. A leaked database
 * backup therefore contains no usable invite.
 */
export async function createOwnerInvite(ownerId: string) {
  let caller;
  try { caller = await requireAdmin(); } catch (e) { return { error: (e as Error).message }; }

  const admin = createAdminClient();
  const { data: owner } = await admin
    .from("owners")
    .select("id, name, phone_whatsapp, portal_access")
    .eq("id", ownerId)
    .maybeSingle();

  if (!owner) return { error: "Pemilik tidak ditemukan." };
  if (owner.portal_access === "revoked") {
    return { error: "Akses pemilik ini dicabut. Pulihkan dulu sebelum mengundang." };
  }

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + INVITE_DAYS * 86_400_000).toISOString();

  const { error } = await admin.from("owner_invites").insert({
    owner_id: ownerId,
    token_hash: hash(token),
    expires_at: expiresAt,
    created_by: caller.id,
  });
  if (error) return { error: error.message };

  await admin
    .from("owners")
    .update({
      invited_at: new Date().toISOString(),
      // 'invited' is not access. requireOwner() admits only 'active'.
      portal_access: owner.portal_access === "active" ? "active" : "invited",
    })
    .eq("id", ownerId);

  const url = `${siteOrigin()}/owner/invite/${token}`;

  // Email is not connected, so the team sends this by hand. A prefilled wa.me
  // link is the delivery mechanism, not a convenience.
  const phone = String(owner.phone_whatsapp ?? "").replace(/\D/g, "");
  const message =
    `Halo ${owner.name}, ini tautan untuk mengaktifkan portal pemilik VeriHome Anda. ` +
    `Berlaku ${INVITE_DAYS} hari dan hanya dapat dipakai sekali: ${url}`;
  const whatsappUrl = phone ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}` : null;

  revalidatePath("/admin/owners");
  revalidatePath(`/admin/owners/${ownerId}`);

  return { success: true, invite: { url, whatsappUrl, expiresAt } as InviteResult };
}

/** Switches an owner's portal access off. Takes effect on their next request. */
export async function setOwnerPortalAccess(ownerId: string, access: "active" | "revoked") {
  try { await requireAdmin(); } catch (e) { return { error: (e as Error).message }; }

  const admin = createAdminClient();

  // Re-activating someone who never linked an account would grant access to a
  // row with no user behind it.
  if (access === "active") {
    const { data: owner } = await admin
      .from("owners").select("user_id").eq("id", ownerId).maybeSingle();
    if (!owner?.user_id) {
      return { error: "Pemilik ini belum menghubungkan akun. Kirim undangan baru." };
    }
  }

  const { error } = await admin.from("owners").update({ portal_access: access }).eq("id", ownerId);
  if (error) return { error: error.message };

  // Outstanding invites die with the access they were issued under.
  if (access === "revoked") {
    await admin
      .from("owner_invites")
      .update({ revoked_at: new Date().toISOString() })
      .eq("owner_id", ownerId)
      .is("used_at", null)
      .is("revoked_at", null);
  }

  revalidatePath("/admin/owners");
  revalidatePath(`/admin/owners/${ownerId}`);
  return { success: true };
}

const REDEEM_MESSAGES: Record<string, string> = {
  invite_invalid:       "owner.invite.invalid",
  invite_already_used:  "owner.invite.used",
  invite_expired:       "owner.invite.expired",
  invite_revoked:       "owner.invite.invalid",
  owner_revoked:        "owner.access.revoked",
  owner_already_linked: "owner.invite.invalid",
  user_already_owner:   "owner.invite.invalid",
};

/**
 * Redeems an invite for the signed-in user.
 *
 * Every refusal condition lives in the RPC, not here — this only maps the
 * error onto a message. A second caller added later cannot skip checks it
 * never had.
 */
export async function acceptOwnerInvite(token: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "unauthenticated" };

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("redeem_owner_invite", {
    p_token_hash: hash(token),
    p_user_id: user.id,
  });

  if (error) {
    const key = Object.keys(REDEEM_MESSAGES).find((k) => error.message.includes(k));
    return { error: key ? REDEEM_MESSAGES[key] : "owner.invite.invalid" };
  }

  const row = data?.[0] as { owner_id: string; owner_name: string } | undefined;
  revalidatePath("/owner");
  return { success: true, ownerName: row?.owner_name ?? "" };
}

/** Invite history for the admin owner page. Never returns a token. */
export async function listOwnerInvites(ownerId: string) {
  try { await requireAdmin(); } catch { return []; }

  const admin = createAdminClient();
  const { data } = await admin
    .from("owner_invites")
    .select("id, created_at, expires_at, used_at, revoked_at")
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: false })
    .limit(10);

  return (data ?? []).map((i) => ({
    id: i.id as string,
    createdAt: i.created_at as string,
    expiresAt: i.expires_at as string,
    state: i.used_at ? "used" : i.revoked_at ? "revoked"
         : new Date(i.expires_at as string) < new Date() ? "expired" : "open",
  }));
}
