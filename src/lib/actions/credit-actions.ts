"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/guards";
import { CREDIT_CASHBACK_DAYS } from "@/lib/viewings/policy";

export interface RefundableCredit {
  id: string;
  amount: number;
  created_at: string;
  expires_at: string | null;
  /** Days left in the cash-back window; never negative. */
  daysLeft: number;
  status: string;
}

function daysLeft(createdAt: string): number {
  const deadline = new Date(createdAt).getTime() + CREDIT_CASHBACK_DAYS * 86_400_000;
  return Math.max(0, Math.ceil((deadline - Date.now()) / 86_400_000));
}

/**
 * Credit the signed-in guest could still exchange for cash.
 *
 * Eligibility is decided here and in the RPC. The UI uses this to decide what
 * to show; the RPC decides what is allowed. A button that is merely hidden is
 * not a rule.
 */
export async function listRefundableCredits(): Promise<RefundableCredit[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const admin = createAdminClient();
  const cutoff = new Date(Date.now() - CREDIT_CASHBACK_DAYS * 86_400_000).toISOString();

  const { data } = await admin
    .from("user_credits")
    .select("id, amount, created_at, expires_at, status")
    .eq("user_id", user.id)
    .not("viewing_id", "is", null)   // only the guest's own deposit money
    .is("redeemed_at", null)
    .in("status", ["active", "refund_requested"])
    .gte("created_at", cutoff)
    .order("created_at", { ascending: true });

  return (data ?? []).map((c) => ({
    id: c.id,
    amount: Number(c.amount ?? 0),
    created_at: c.created_at as string,
    expires_at: (c.expires_at as string) ?? null,
    daysLeft: daysLeft(c.created_at as string),
    status: c.status as string,
  }));
}

const MESSAGES: Record<string, string> = {
  credit_not_found:         "Kredit tidak ditemukan.",
  not_your_credit:          "Kredit ini bukan milik Anda.",
  already_spent:            "Kredit sudah terpakai dan tidak dapat ditukar.",
  not_refundable_status:    "Kredit ini sedang diproses atau sudah ditukar.",
  not_from_viewing_deposit: "Hanya kredit dari titipan viewing yang dapat ditukar menjadi uang.",
  refund_window_closed:     `Batas ${CREDIT_CASHBACK_DAYS} hari untuk menukar kredit ini sudah lewat.`,
  no_refund_request:        "Tidak ada permintaan penukaran untuk kredit ini.",
};

function friendly(message: string): string {
  const key = Object.keys(MESSAGES).find((k) => message.includes(k));
  return key ? MESSAGES[key] : message;
}

/** Stage 1 — the guest asks. Freezes the credit; no money moves yet. */
export async function requestCreditRefund(creditId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Silakan masuk terlebih dahulu." };

  const admin = createAdminClient();
  const { error } = await admin.rpc("request_credit_refund", {
    p_credit_id: creditId,
    p_user_id: user.id,
  });

  if (error) return { error: friendly(error.message) };

  revalidatePath("/dashboard/statement");
  revalidatePath("/dashboard/viewings");
  return { success: true };
}

/** Stage 2 — an admin confirms the transfer actually went out. */
export async function confirmCreditRefund(creditId: string) {
  let caller;
  try { caller = await requireAdmin(); } catch (e) { return { error: (e as Error).message }; }

  const admin = createAdminClient();
  const { error } = await admin.rpc("confirm_credit_refund", {
    p_credit_id: creditId,
    p_admin_id: caller.id,
  });

  if (error) return { error: friendly(error.message) };

  revalidatePath("/admin");
  revalidatePath("/admin/viewings");
  return { success: true };
}

/** Pending credit refunds, for the admin needs-attention list. */
export async function listPendingCreditRefunds() {
  const admin = createAdminClient();
  const { data } = await admin
    .from("user_credits")
    .select("id, amount, refund_requested_at, user:users ( name, email ), viewing_id")
    .eq("status", "refund_requested")
    .order("refund_requested_at", { ascending: true });

  return (data ?? []).map((c) => {
    const u = c.user as unknown as { name?: string; email?: string } | null;
    return {
      id: c.id as string,
      amount: Number(c.amount ?? 0),
      requestedAt: (c.refund_requested_at as string) ?? null,
      who: u?.name ?? u?.email ?? "—",
      viewingId: (c.viewing_id as string) ?? null,
    };
  });
}
