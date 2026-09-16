import { createAdminClient } from "@/lib/supabase/admin";

const n = (v: unknown) => Math.round(Number(v ?? 0));

export interface StatementLine {
  date: string;
  description: string;
  type: string;
  amount: number;
  /** Money leaving the guest (a charge) vs coming back (refund/credit). */
  outgoing: boolean;
  status: string;
  receiptId: string | null;
}

export interface AccountStatement {
  totalSpent: number;
  depositsHeld: number;
  creditBalance: number;
  expiringSoon: { amount: number; expiresAt: string }[];
  lines: StatementLine[];
}

// How each ledger event reads from the guest's side of the table. The ledger
// records VeriHome's books; a statement has to be phrased from the customer's.
const EVENT_LABEL: Record<string, { label: string; type: string; outgoing: boolean }> = {
  booking_payment_received:            { label: "Pembayaran pemesanan",       type: "Pemesanan",  outgoing: true },
  booking_refund_issued:               { label: "Pengembalian dana",          type: "Refund",     outgoing: false },
  security_deposit_refunded:           { label: "Jaminan dikembalikan",       type: "Jaminan",    outgoing: false },
  security_deposit_claimed:            { label: "Jaminan dipotong (kerusakan)", type: "Jaminan",  outgoing: true },
  consultation_payment_received:       { label: "Pembayaran konsultasi",      type: "Konsultasi", outgoing: true },
  viewing_deposit_received:            { label: "Titipan jaminan kunjungan",  type: "Kunjungan",  outgoing: true },
  viewing_deposit_refunded:            { label: "Titipan dikembalikan",       type: "Kunjungan",  outgoing: false },
  viewing_deposit_forfeited:           { label: "Titipan hangus (tidak hadir)", type: "Kunjungan", outgoing: true },
  viewing_deposit_converted_to_credit: { label: "Titipan menjadi kredit",     type: "Kredit",     outgoing: false },
  credit_redeemed:                     { label: "Kredit digunakan",           type: "Kredit",     outgoing: false },
  credit_expired:                      { label: "Kredit kedaluwarsa",         type: "Kredit",     outgoing: true },
};

export async function getAccountStatement(
  userId: string,
  from: Date,
  to: Date
): Promise<AccountStatement> {
  const admin = createAdminClient();

  const [{ data: entries }, { data: credits }, { data: bookings }, { data: viewings }] =
    await Promise.all([
      // One entry per event: the cash side for money events, the liability side
      // for credit movements, so nothing is double-counted in the history.
      admin
        .from("ledger_entries")
        .select("id, entry_date, event_type, account, direction, amount, booking_id, viewing_id, consultation_id")
        .eq("user_id", userId)
        .gte("entry_date", from.toISOString())
        .lt("entry_date", to.toISOString())
        .order("entry_date", { ascending: false }),
      admin
        .from("user_credits")
        .select("id, amount, expires_at, redeemed_at")
        .eq("user_id", userId),
      admin
        .from("bookings")
        .select("id, security_deposit, status, payment_status")
        .eq("user_id", userId),
      admin
        .from("viewings")
        .select("id, deposit_amount, deposit_paid, deposit_refunded, credit_issued, status")
        .eq("user_id", userId),
    ]);

  // Deposits still held: paid, not returned, not converted, not forfeited.
  const bookingDeposits = (bookings ?? [])
    .filter((b) => b.payment_status === "paid" && !["cancelled", "expired"].includes(b.status ?? ""))
    .reduce((s, b) => s + n(b.security_deposit), 0);

  const viewingDeposits = (viewings ?? [])
    .filter((v) => v.deposit_paid && !v.deposit_refunded && !v.credit_issued && v.status !== "no_show")
    .reduce((s, v) => s + n(v.deposit_amount), 0);

  const now = new Date();
  const available = (credits ?? []).filter(
    (c) => !c.redeemed_at && (!c.expires_at || new Date(c.expires_at) > now)
  );
  const creditBalance = available.reduce((s, c) => s + n(c.amount), 0);

  const in60 = new Date(now.getTime() + 60 * 86_400_000);
  const expiringSoon = available
    .filter((c) => c.expires_at && new Date(c.expires_at) <= in60)
    .map((c) => ({ amount: n(c.amount), expiresAt: String(c.expires_at).slice(0, 10) }))
    .sort((a, b) => a.expiresAt.localeCompare(b.expiresAt));

  const lines: StatementLine[] = [];
  let totalSpent = 0;

  for (const e of entries ?? []) {
    const meta = EVENT_LABEL[e.event_type];
    if (!meta) continue;

    // Take the cash leg for real money movements; for credit-only events take
    // the credits_outstanding leg, since no cash changes hands.
    const isCredit = ["credit_redeemed", "credit_expired", "viewing_deposit_converted_to_credit"].includes(e.event_type);
    const wanted = isCredit ? "credits_outstanding" : "cash";
    if (e.account !== wanted) continue;

    const amount = n(e.amount);
    if (meta.outgoing && !isCredit) totalSpent += amount;

    lines.push({
      date: String(e.entry_date).slice(0, 10),
      description: meta.label,
      type: meta.type,
      amount,
      outgoing: meta.outgoing,
      status: "Selesai",
      receiptId: e.booking_id ?? e.viewing_id ?? e.consultation_id ?? null,
    });
  }

  return {
    totalSpent,
    depositsHeld: bookingDeposits + viewingDeposits,
    creditBalance,
    expiringSoon,
    lines,
  };
}
