"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { maskAccount } from "@/lib/owner/queries";

export interface PendingRequest {
  id: string;
  kind: "rate_change" | "payout_account";
  ownerId: string;
  ownerName: string;
  ownerPhone: string | null;
  propertyId: string | null;
  propertyName: string | null;
  proposed: Record<string, unknown>;
  previous: Record<string, unknown> | null;
  createdAt: string;
  ageDays: number;
}

export async function listPendingOwnerRequests(): Promise<PendingRequest[]> {
  try { await requireAdmin(); } catch { return []; }

  const admin = createAdminClient();
  const { data } = await admin
    .from("owner_change_requests")
    .select(`id, kind, owner_id, property_id, proposed, previous, created_at,
             owner:owners ( name, phone_whatsapp ),
             property:properties ( name )`)
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  return (data ?? []).map((r) => {
    const o = r.owner as unknown as { name?: string; phone_whatsapp?: string } | null;
    const p = r.property as unknown as { name?: string } | null;
    return {
      id: r.id as string,
      kind: r.kind as "rate_change" | "payout_account",
      ownerId: r.owner_id as string,
      ownerName: o?.name ?? "—",
      ownerPhone: o?.phone_whatsapp ?? null,
      propertyId: (r.property_id as string) ?? null,
      propertyName: p?.name ?? null,
      proposed: (r.proposed as Record<string, unknown>) ?? {},
      previous: (r.previous as Record<string, unknown>) ?? null,
      createdAt: r.created_at as string,
      ageDays: Math.floor((Date.now() - new Date(r.created_at as string).getTime()) / 86_400_000),
    };
  });
}

/**
 * Approves one request and applies it.
 *
 * Two different applications behind one verb:
 *
 *   rate_change     writes the new rates onto short_stay_rates. Bookings
 *                   already sold are untouched — their commission and cleaning
 *                   terms were frozen onto the booking row when it was taken
 *                   (migrations 028 and 036), so a rate change cannot reach
 *                   backwards into a stay someone has already paid for.
 *
 *   payout_account  writes the new account AND stamps who verified it and
 *                   when. Until this runs, payouts keep going to the previously
 *                   verified account — which is the entire point: an attacker
 *                   who takes over an owner's login gets a pending request, not
 *                   a redirected payment.
 */
export async function approveOwnerRequest(requestId: string, note?: string) {
  let caller;
  try { caller = await requireAdmin(); } catch (e) { return { error: (e as Error).message }; }

  const admin = createAdminClient();

  // Claim it first: the status check and the claim are one statement, so two
  // admins clicking at once cannot both apply the same change.
  const { data: claimed, error: claimError } = await admin
    .from("owner_change_requests")
    .update({
      status: "approved",
      reviewed_by: caller.id,
      reviewed_at: new Date().toISOString(),
      review_note: note ?? null,
    })
    .eq("id", requestId)
    .eq("status", "pending")
    .select("id, kind, owner_id, property_id, proposed")
    .maybeSingle();

  if (claimError) return { error: claimError.message };
  if (!claimed) return { error: "Permintaan sudah diproses." };

  const proposed = (claimed.proposed as Record<string, unknown>) ?? {};

  try {
    if (claimed.kind === "rate_change" && claimed.property_id) {
      const patch: Record<string, unknown> = {};
      for (const k of ["price_per_night", "price_per_week", "price_per_month", "cleaning_fee", "min_nights"]) {
        if (proposed[k] != null) patch[k] = proposed[k];
      }
      if (Object.keys(patch).length > 0) {
        const { error } = await admin
          .from("short_stay_rates")
          .update(patch)
          .eq("property_id", claimed.property_id);
        if (error) throw new Error(error.message);
      }
      revalidatePath(`/owner/properties/${claimed.property_id}`);
    }

    if (claimed.kind === "payout_account") {
      const { error } = await admin
        .from("owners")
        .update({
          payout_bank: proposed.bank ?? null,
          payout_account_number: proposed.account_number ?? null,
          payout_account_holder: proposed.account_holder ?? null,
          payout_verified_at: new Date().toISOString(),
          payout_verified_by: caller.id,
        })
        .eq("id", claimed.owner_id);
      if (error) throw new Error(error.message);
      revalidatePath("/owner/profile");
    }
  } catch (err) {
    // The request is already marked approved. Say so rather than pretending the
    // apply succeeded — an admin who sees this needs to finish it by hand.
    return {
      error: `Permintaan ditandai disetujui tetapi perubahan gagal diterapkan: ${(err as Error).message}`,
    };
  }

  revalidatePath("/admin/owner-requests");
  revalidatePath("/admin");
  return { success: true };
}

export async function rejectOwnerRequest(requestId: string, note?: string) {
  let caller;
  try { caller = await requireAdmin(); } catch (e) { return { error: (e as Error).message }; }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("owner_change_requests")
    .update({
      status: "rejected",
      reviewed_by: caller.id,
      reviewed_at: new Date().toISOString(),
      review_note: note ?? null,
    })
    .eq("id", requestId)
    .eq("status", "pending")
    .select("id");

  if (error) return { error: error.message };
  if (!data?.length) return { error: "Permintaan sudah diproses." };

  revalidatePath("/admin/owner-requests");
  revalidatePath("/admin");
  return { success: true };
}

/** Count for the admin needs-attention list. */
export async function countPendingOwnerRequests(): Promise<number> {
  const admin = createAdminClient();
  const { count } = await admin
    .from("owner_change_requests")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");
  return count ?? 0;
}

export { maskAccount };
