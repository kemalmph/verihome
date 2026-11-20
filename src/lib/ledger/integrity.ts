import { createAdminClient } from "@/lib/supabase/admin";
import { getLedgerBalances, balanceOf } from "./post";

type AdminClient = ReturnType<typeof createAdminClient>;
const n = (v: unknown) => Math.round(Number(v ?? 0));

export interface IntegrityCheck {
  id: string;
  label: string;
  passed: boolean;
  /** What the ledger says. */
  ledger: number | null;
  /** What the business tables say it should be. */
  expected: number | null;
  difference: number | null;
  /** Specific records involved when the check fails — a total alone is not actionable. */
  offenders: { id: string; label: string; detail: string }[];
  explanation: string;
}

/**
 * Cross-checks the ledger against the business tables it is supposed to
 * describe. These exist because posting happens after the state change rather
 * than inside the same transaction: if a post is ever lost, this is what
 * notices. A mismatch names the records involved, because a bare total tells
 * nobody where to look.
 */
export async function runIntegrityChecks(client?: AdminClient): Promise<{
  checks: IntegrityCheck[];
  allPassed: boolean;
  failedCount: number;
}> {
  const admin = client ?? createAdminClient();
  const balances = await getLedgerBalances({ client: admin });

  const [
    { data: totals }, { data: bookings }, { data: viewings },
    { data: credits }, { data: consultations }, { data: ledgerEvents },
  ] = await Promise.all([
    admin.from("ledger_entries").select("direction, amount"),
    admin.from("bookings").select("id, booking_code, status, payment_status, total_price, security_deposit, credit_applied, property_id"),
    admin.from("viewings").select("id, deposit_amount, deposit_paid, deposit_refunded, credit_issued, status"),
    admin.from("user_credits").select("id, amount, redeemed_at, expires_at"),
    admin.from("consultations").select("id, status, payment_status, price, final_price, credit_applied"),
    admin.from("ledger_entries").select("event_type, account, direction, amount, booking_id"),
  ]);

  const checks: IntegrityCheck[] = [];
  const evt = ledgerEvents ?? [];

  // ── 1. Does the ledger balance at all ──────────────────────────────────────
  const debits = (totals ?? []).filter((e) => e.direction === "debit").reduce((s, e) => s + n(e.amount), 0);
  const credits_ = (totals ?? []).filter((e) => e.direction === "credit").reduce((s, e) => s + n(e.amount), 0);
  checks.push({
    id: "balance",
    label: "Seluruh jurnal seimbang",
    passed: debits === credits_,
    ledger: debits, expected: credits_, difference: debits - credits_,
    offenders: [],
    explanation: "Total debit harus sama dengan total kredit. Jika tidak, ada entri yang tertulis sebagian.",
  });

  // ── 2. deposits_held vs deposits actually still held ───────────────────────
  const bookingDepositsCollected = (bookings ?? [])
    .filter((b) => b.payment_status === "paid")
    .reduce((s, b) => s + n(b.security_deposit), 0);
  const viewingDepositsCollected = (viewings ?? [])
    .filter((v) => v.deposit_paid)
    .reduce((s, v) => s + n(v.deposit_amount), 0);

  // What has since left the deposits pool, per the ledger.
  const depositsReleased = evt
    .filter((e) => e.account === "deposits_held" && e.direction === "debit")
    .reduce((s, e) => s + n(e.amount), 0);

  const expectedDeposits = bookingDepositsCollected + viewingDepositsCollected - depositsReleased;
  const ledgerDeposits = balanceOf(balances, "deposits_held");

  checks.push({
    id: "deposits",
    label: "Titipan jaminan sesuai catatan",
    passed: ledgerDeposits === expectedDeposits,
    ledger: ledgerDeposits, expected: expectedDeposits,
    difference: ledgerDeposits - expectedDeposits,
    offenders: ledgerDeposits === expectedDeposits ? [] :
      (bookings ?? [])
        .filter((b) => b.payment_status === "paid" && n(b.security_deposit) > 0 &&
          !evt.some((e) => e.booking_id === b.id && e.account === "deposits_held"))
        .map((b) => ({
          id: b.id, label: b.booking_code,
          detail: `jaminan ${n(b.security_deposit)} tercatat dibayar tetapi tidak ada entri deposits_held`,
        })),
    explanation: "Saldo titipan harus sama dengan jaminan yang sudah diterima dikurangi yang sudah dilepas.",
  });

  // ── 3. owner_payable — is every delivered stay actually booked ─────────────
  const unrecognised = (bookings ?? []).filter(
    (b) => b.status === "completed" && b.payment_status === "paid" &&
      !evt.some((e) => e.booking_id === b.id && e.event_type === "booking_revenue_earned")
  );
  checks.push({
    id: "owner_payable",
    label: "Hutang pemilik mencakup semua menginap selesai",
    passed: unrecognised.length === 0,
    ledger: balanceOf(balances, "owner_payable"), expected: null, difference: null,
    offenders: unrecognised.map((b) => ({
      id: b.id, label: b.booking_code,
      detail: "menginap selesai dan dibayar, tetapi pendapatan belum diakui — hak pemilik belum tercatat",
    })),
    explanation: "Setiap menginap yang selesai dan lunas harus sudah dibagi antara VeriHome dan pemilik.",
  });

  // ── 4. credits_outstanding vs unredeemed, unexpired credits ────────────────
  const now = new Date();
  const liveCredits = (credits ?? []).filter(
    (c) => !c.redeemed_at && (!c.expires_at || new Date(c.expires_at) > now)
  );
  const expectedCredits = liveCredits.reduce((s, c) => s + n(c.amount), 0);
  const ledgerCredits = balanceOf(balances, "credits_outstanding");

  checks.push({
    id: "credits",
    label: "Kredit pengguna sesuai catatan",
    passed: ledgerCredits === expectedCredits,
    ledger: ledgerCredits, expected: expectedCredits,
    difference: ledgerCredits - expectedCredits,
    offenders: ledgerCredits === expectedCredits ? [] :
      liveCredits.slice(0, 10).map((c) => ({
        id: c.id, label: `kredit ${String(c.id).slice(0, 8)}`,
        detail: `${n(c.amount)} belum ditukar${c.expires_at ? `, berlaku sampai ${String(c.expires_at).slice(0, 10)}` : ""}`,
      })),
    explanation: "Saldo kredit harus sama dengan jumlah kredit yang belum ditukar dan belum kedaluwarsa.",
  });

  // ── 5. unearned_revenue vs services paid for but not delivered ─────────────
  const openBookings = (bookings ?? []).filter(
    (b) => b.payment_status === "paid" && !["completed", "cancelled", "expired"].includes(b.status ?? "")
  );
  const openConsults = (consultations ?? []).filter(
    (c) => (c.payment_status === "paid" || c.status === "paid") && c.status !== "completed"
  );
  // Credit ADDS to unearned revenue, it does not reduce it. Applying credit
  // debits credits_outstanding and credits unearned_revenue, so a service paid
  // partly in cash and partly in credit sits in unearned at its full value.
  // Subtracting credit here understated the expectation by exactly the credit
  // applied, and would have reported a false mismatch the first time anyone
  // spent any. bookings.total_price and consultations.final_price are both
  // already net of credit, so the credit has to be added back.
  const expectedUnearned =
    openBookings.reduce((s, b) => s + n(b.total_price) + n(b.credit_applied), 0) +
    openConsults.reduce((s, c) => s + n(c.final_price ?? c.price) + n(c.credit_applied), 0);
  const ledgerUnearned = balanceOf(balances, "unearned_revenue");

  checks.push({
    id: "unearned",
    label: "Pendapatan diterima di muka sesuai layanan belum diberikan",
    passed: ledgerUnearned === expectedUnearned,
    ledger: ledgerUnearned, expected: expectedUnearned,
    difference: ledgerUnearned - expectedUnearned,
    offenders: ledgerUnearned === expectedUnearned ? [] :
      openBookings.slice(0, 10).map((b) => ({
        id: b.id, label: b.booking_code,
        detail: `lunas, status ${b.status} — ${n(b.total_price) - n(b.credit_applied)} belum diakui sebagai pendapatan`,
      })),
    explanation: "Saldo ini harus sama dengan uang yang sudah diterima untuk menginap atau sesi yang belum terjadi.",
  });

  const failedCount = checks.filter((c) => !c.passed).length;
  return { checks, allPassed: failedCount === 0, failedCount };
}
