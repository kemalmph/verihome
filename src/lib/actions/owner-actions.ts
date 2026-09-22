"use server";

import { revalidatePath } from "next/cache";
import { requireOwner, ownedProperty, NotFoundError } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Everything an owner can write.
 *
 * Every function calls requireOwner() first and uses the owner id it returns.
 * None takes an owner id as an argument: a parameter is something a caller can
 * set, and these are server actions — separately addressable endpoints any
 * signed-in client can invoke directly, whatever page they are on (§18.6).
 */

const BLOCK_ERRORS: Record<string, string> = {
  invalid_range:    "Tanggal selesai harus setelah tanggal mulai.",
  not_found:        "Properti tidak ditemukan.",
  overlaps_booking: "Tanggal ini sudah dipesan tamu dan tidak bisa diblokir.",
  overlaps_block:   "Tanggal ini sudah diblokir.",
};

function friendly(message: string, table: Record<string, string>): string {
  const key = Object.keys(table).find((k) => message.includes(k));
  return key ? table[key] : message;
}

// ── Calendar ────────────────────────────────────────────────────────────────

export async function blockDates(propertyId: string, start: string, end: string, note?: string) {
  let owner;
  try { owner = await requireOwner(); } catch { return { error: "Tidak ditemukan." }; }

  const admin = createAdminClient();
  // The RPC re-checks ownership under the advisory lock; this is the early
  // refusal so a foreign property never even reaches it.
  try { await ownedProperty(owner.ownerId, propertyId); }
  catch { return { error: "Tidak ditemukan." }; }

  const { error } = await admin.rpc("owner_block_dates", {
    p_property_id: propertyId,
    p_owner_id: owner.ownerId,
    p_start: start,
    p_end: end,
    p_note: note ?? null,
  });

  if (error) return { error: friendly(error.message, BLOCK_ERRORS) };

  revalidatePath(`/owner/properties/${propertyId}/calendar`);
  return { success: true };
}

export async function removeBlock(propertyId: string, blockId: string) {
  let owner;
  try { owner = await requireOwner(); } catch { return { error: "Tidak ditemukan." }; }

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("owner_remove_block", {
    p_block_id: blockId,
    p_owner_id: owner.ownerId,
  });

  if (error) return { error: error.message };
  // The RPC filters by owner id, so a false here means "not yours or not a
  // removable block" — reported as not-found, revealing nothing either way.
  if (data !== true) return { error: "Tidak ditemukan." };

  revalidatePath(`/owner/properties/${propertyId}/calendar`);
  return { success: true };
}

// ── Change requests ─────────────────────────────────────────────────────────

export async function proposeRateChange(propertyId: string, formData: FormData) {
  let owner;
  try { owner = await requireOwner(); } catch { return { error: "Tidak ditemukan." }; }

  let property;
  try { property = await ownedProperty(owner.ownerId, propertyId); }
  catch { return { error: "Tidak ditemukan." }; }

  const num = (k: string) => {
    const raw = String(formData.get(k) ?? "").replace(/[^\d]/g, "");
    return raw === "" ? null : Number(raw);
  };

  const proposed = {
    price_per_night: num("price_per_night"),
    price_per_week:  num("price_per_week"),
    price_per_month: num("price_per_month"),
    cleaning_fee:    num("cleaning_fee"),
    min_nights:      num("min_nights"),
    note: String(formData.get("note") ?? "").trim() || null,
  };

  if (Object.values(proposed).every((v) => v === null)) {
    return { error: "Isi setidaknya satu tarif." };
  }

  const admin = createAdminClient();
  const { data: current } = await admin
    .from("short_stay_rates")
    .select("price_per_night, price_per_week, price_per_month, cleaning_fee, min_nights")
    .eq("property_id", propertyId)
    .maybeSingle();

  const { error } = await admin.from("owner_change_requests").insert({
    owner_id: owner.ownerId,
    property_id: property.id,
    kind: "rate_change",
    proposed,
    previous: current ?? null,
  });

  if (error) return { error: error.message };

  revalidatePath(`/owner/properties/${propertyId}`);
  revalidatePath("/admin/owner-requests");
  return { success: true };
}

export async function proposePayoutAccount(formData: FormData) {
  let owner;
  try { owner = await requireOwner(); } catch { return { error: "Tidak ditemukan." }; }

  const bank   = String(formData.get("bank") ?? "").trim();
  const number = String(formData.get("account_number") ?? "").replace(/\s/g, "");
  const holder = String(formData.get("account_holder") ?? "").trim();

  if (!bank || !number || !holder) {
    return { error: "Bank, nomor rekening, dan nama pemilik rekening wajib diisi." };
  }
  if (!/^\d{6,20}$/.test(number)) {
    return { error: "Nomor rekening harus 6–20 digit angka." };
  }

  const admin = createAdminClient();
  const { data: current } = await admin
    .from("owners")
    .select("payout_bank, payout_account_number, payout_account_holder")
    .eq("id", owner.ownerId)
    .single();

  // Changing where money is sent is a classic account-takeover payoff, so the
  // new account is only ever a PROPOSAL. Payouts keep going to the verified
  // account until an admin confirms this one by phone.
  const { error } = await admin.from("owner_change_requests").insert({
    owner_id: owner.ownerId,
    kind: "payout_account",
    proposed: { bank, account_number: number, account_holder: holder },
    previous: current ?? null,
  });

  if (error) {
    if (error.message.includes("idx_ocr_one_pending_payout")) {
      return { error: "Sudah ada perubahan rekening yang menunggu verifikasi." };
    }
    return { error: error.message };
  }

  revalidatePath("/owner/profile");
  revalidatePath("/admin/owner-requests");
  return { success: true };
}

export async function cancelChangeRequest(requestId: string) {
  let owner;
  try { owner = await requireOwner(); } catch { return { error: "Tidak ditemukan." }; }

  const admin = createAdminClient();
  // Filtered by request id AND owner id AND still-pending, in one statement.
  const { data, error } = await admin
    .from("owner_change_requests")
    .update({ status: "cancelled" })
    .eq("id", requestId)
    .eq("owner_id", owner.ownerId)
    .eq("status", "pending")
    .select("id");

  if (error) return { error: error.message };
  if (!data?.length) return { error: "Tidak ditemukan." };

  revalidatePath("/owner/profile");
  return { success: true };
}

// ── Placements ──────────────────────────────────────────────────────────────

/**
 * The owner reports a long-term letting themselves.
 *
 * Recorded as reported_by = 'owner' with status 'reported' for the team to
 * confirm — it is a claim, not a confirmed deal. Giving honest owners an easy
 * way to report is part of the answer to commission leakage: the alternative is
 * that a deal closes and nobody tells VeriHome at all.
 */
export async function reportPlacement(formData: FormData) {
  let owner;
  try { owner = await requireOwner(); } catch { return { error: "Tidak ditemukan." }; }

  const propertyId = String(formData.get("property_id") ?? "");
  const tenant     = String(formData.get("tenant_first_name") ?? "").trim();
  const rent       = Number(String(formData.get("monthly_rent") ?? "").replace(/[^\d]/g, ""));
  const leaseStart = String(formData.get("lease_start") ?? "").trim();

  if (!propertyId) return { error: "Pilih properti." };
  if (!tenant)     return { error: "Nama depan penyewa wajib diisi." };
  if (!Number.isFinite(rent) || rent <= 0) return { error: "Sewa per bulan tidak valid." };

  try { await ownedProperty(owner.ownerId, propertyId); }
  catch { return { error: "Tidak ditemukan." }; }

  const admin = createAdminClient();
  const { data: settings } = await admin
    .from("platform_settings").select("default_commission_pct").eq("id", 1).maybeSingle();

  // A reported placement carries an indicative commission only. The team sets
  // the real figure when they confirm, so nothing here posts to the ledger.
  const pct = Number(settings?.default_commission_pct ?? 0);
  const amount = Math.round((rent * pct) / 100);

  const { error } = await admin.from("placements").insert({
    property_id: propertyId,
    monthly_rent: rent,
    commission_pct: pct,
    commission_amount: amount,
    status: "reported",
    reported_by: "owner",
    lease_start_date: leaseStart || null,
    notes: `Dilaporkan pemilik. Penyewa: ${tenant}.`,
  });

  if (error) return { error: error.message };

  revalidatePath("/owner/placements");
  revalidatePath("/admin/placements");
  return { success: true };
}

export { NotFoundError };
