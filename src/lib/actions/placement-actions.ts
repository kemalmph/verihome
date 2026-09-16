"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/guards";
import {
  postPlacementCommissionEarned,
  postPlacementCommissionReceived,
} from "@/lib/ledger/events";

const num = (v: FormDataEntryValue | null) => {
  const n = Number(String(v ?? "").replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

/**
 * Records a long-term placement after a deal closes.
 *
 * Commission is earned when the placement is recorded, not when the owner pays:
 * the work is done and the money is owed. That is what commission_receivable
 * represents — revenue recognised against a debt rather than cash.
 */
export async function recordPlacement(formData: FormData) {
  let caller;
  try { caller = await requireAdmin(); } catch (e) { return { error: (e as Error).message }; }

  const propertyId  = (formData.get("property_id") as string) || null;
  const userId      = (formData.get("user_id") as string) || null;
  const monthlyRent = Math.round(num(formData.get("monthly_rent")));
  const pct         = num(formData.get("commission_pct"));

  if (!propertyId)      return { error: "Pilih properti." };
  if (monthlyRent <= 0) return { error: "Sewa bulanan harus lebih dari nol." };
  if (pct <= 0 || pct > 100) return { error: "Komisi harus antara 0 dan 100 persen." };

  const commissionAmount = Math.round((monthlyRent * pct) / 100);

  const admin = createAdminClient();

  const { data: property } = await admin
    .from("properties").select("owner_id").eq("id", propertyId).single();

  const { data: placement, error } = await admin
    .from("placements")
    .insert({
      property_id:       propertyId,
      user_id:           userId,
      viewing_id:        (formData.get("viewing_id") as string) || null,
      monthly_rent:      monthlyRent,
      commission_pct:    pct,
      commission_amount: commissionAmount,
      lease_start_date:  (formData.get("lease_start_date") as string) || null,
      reported_by:       (formData.get("reported_by") as string) || null,
      notes:             (formData.get("notes") as string)?.trim() || null,
      status:            "reported",
    })
    .select("id")
    .single();

  if (error || !placement) return { error: error?.message ?? "Gagal menyimpan penempatan." };

  let ledgerError: string | null = null;
  try {
    await postPlacementCommissionEarned(
      { property_id: propertyId, owner_id: property?.owner_id ?? null,
        user_id: userId, amount: commissionAmount },
      { createdBy: caller.id }
    );
  } catch (err) {
    ledgerError = (err as Error).message;
    console.error("[recordPlacement] ledger:", ledgerError);
  }

  revalidatePath("/admin/placements");
  return { success: true, placementId: placement.id, commissionAmount, ledgerError };
}

/** Owner has paid the commission: the receivable becomes cash. */
export async function markPlacementPaid(placementId: string) {
  let caller;
  try { caller = await requireAdmin(); } catch (e) { return { error: (e as Error).message }; }

  const admin = createAdminClient();

  const { data: before } = await admin
    .from("placements")
    .select("id, status, commission_amount, property_id")
    .eq("id", placementId)
    .single();

  if (!before) return { error: "Penempatan tidak ditemukan." };
  if (before.status === "paid") return { error: "Sudah ditandai lunas." };

  const { data: property } = await admin
    .from("properties").select("owner_id").eq("id", before.property_id).single();

  const { error } = await admin
    .from("placements").update({ status: "paid" }).eq("id", placementId);
  if (error) return { error: error.message };

  let ledgerError: string | null = null;
  try {
    await postPlacementCommissionReceived(
      { property_id: before.property_id, owner_id: property?.owner_id ?? null,
        amount: Number(before.commission_amount) },
      { createdBy: caller.id }
    );
  } catch (err) {
    ledgerError = (err as Error).message;
    console.error("[markPlacementPaid] ledger:", ledgerError);
  }

  revalidatePath("/admin/placements");
  return { success: true, ledgerError };
}

/** Status changes that move no money — invoiced, disputed, written off. */
export async function updatePlacementStatus(placementId: string, status: string) {
  try { await requireAdmin(); } catch (e) { return { error: (e as Error).message }; }

  if (status === "paid") {
    return { error: "Gunakan markPlacementPaid agar pembayaran tercatat di buku besar." };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("placements").update({ status }).eq("id", placementId);
  if (error) return { error: error.message };

  revalidatePath("/admin/placements");
  return { success: true };
}
