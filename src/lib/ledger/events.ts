import { createAdminClient } from "@/lib/supabase/admin";
import { postLedgerEntries } from "./post";
import type { LedgerEntry } from "./types";

type AdminClient = ReturnType<typeof createAdminClient>;

// One function per money event. Callers describe what happened; the balanced
// entry pair is assembled here so no route hand-writes debits and credits.

const n = (v: unknown) => Math.round(Number(v ?? 0));

/**
 * Guest payment verified by an admin.
 *
 * Cash arrives as one figure covering two economically different things: the
 * stay (which becomes revenue at checkout) and the refundable deposit (which
 * does not). They are separated here so unearned_revenue is never overstated
 * by the deposits the platform is merely holding.
 */
export async function postBookingPaymentReceived(
  booking: {
    id: string; property_id: string; user_id: string;
    total_price: unknown; security_deposit: unknown; credit_applied: unknown;
  },
  opts: { createdBy?: string | null; client?: AdminClient } = {}
) {
  const stayDue = n(booking.total_price) - n(booking.credit_applied);
  const deposit = n(booking.security_deposit);
  const cash    = stayDue + deposit;

  if (cash <= 0) return; // fully covered by credit and no deposit — no cash moved

  const base = {
    event_type: "booking_payment_received" as const,
    booking_id: booking.id,
    property_id: booking.property_id,
    user_id: booking.user_id,
    created_by: opts.createdBy ?? null,
  };

  const entries: LedgerEntry[] = [
    { ...base, account: "cash", direction: "debit", amount: cash,
      description: "Guest payment received" },
  ];
  if (stayDue > 0) {
    entries.push({ ...base, account: "unearned_revenue", direction: "credit", amount: stayDue,
      description: "Stay not yet delivered" });
  }
  if (deposit > 0) {
    entries.push({ ...base, account: "deposits_held", direction: "credit", amount: deposit,
      description: "Refundable security deposit" });
  }

  await postLedgerEntries(entries, opts.client);
}

/**
 * Checkout completed — the service has now been delivered, so the stay stops
 * being a liability and becomes income split between platform and owner.
 *
 * Returns whether the split could be made. With no commission rate configured
 * the whole amount goes to the owner rather than guessing a rate: under-paying
 * VeriHome is recoverable, silently under-paying an owner is not.
 */
export async function postBookingRevenueEarned(
  booking: {
    id: string; property_id: string; user_id: string;
    total_price: unknown; cleaning_fee: unknown; credit_applied: unknown;
    /** Rate frozen when the booking was taken. See migration 028. */
    commission_pct?: unknown;
  },
  property: {
    owner_id?: string | null;
    platform_commission_pct?: unknown;
    cleaning_fee_goes_to?: string | null;
  },
  opts: { createdBy?: string | null; client?: AdminClient } = {}
): Promise<{ split: boolean; reason?: string }> {
  const stayValue = n(booking.total_price) - n(booking.credit_applied);
  if (stayValue <= 0) return { split: true };

  const cleaning = Math.min(n(booking.cleaning_fee), stayValue);
  const rent     = stayValue - cleaning;

  const base = {
    event_type: "booking_revenue_earned" as const,
    booking_id: booking.id,
    property_id: booking.property_id,
    user_id: booking.user_id,
    owner_id: property.owner_id ?? null,
    created_by: opts.createdBy ?? null,
  };

  const entries: LedgerEntry[] = [
    { ...base, account: "unearned_revenue", direction: "debit", amount: stayValue,
      description: "Stay delivered" },
  ];

  // Cleaning is billed to the guest but may be the owner's to keep.
  if (cleaning > 0) {
    entries.push(
      property.cleaning_fee_goes_to === "owner"
        ? { ...base, account: "owner_payable", direction: "credit", amount: cleaning,
            description: "Cleaning fee due to owner" }
        : { ...base, account: "revenue_cleaning", direction: "credit", amount: cleaning,
            description: "Cleaning fee" }
    );
  }

  // The rate frozen onto the booking wins. It is what was agreed when the stay
  // was sold, and a stay sold under one rate must not settle under another
  // because the property or the platform default changed in between. The
  // property is read only for bookings taken before migration 028 added the
  // snapshot.
  const usable = (v: unknown) => v !== null && v !== undefined && Number.isFinite(Number(v));
  const pct = usable(booking.commission_pct)
    ? booking.commission_pct
    : property.platform_commission_pct;
  const hasRate = usable(pct);

  if (rent > 0 && !hasRate) {
    entries.push({ ...base, account: "owner_payable", direction: "credit", amount: rent,
      description: "No commission rate configured — full rent to owner pending split" });
    await postLedgerEntries(entries, opts.client);
    return { split: false, reason: "no commission rate on the booking, the property or the platform default" };
  }

  if (rent > 0) {
    const margin = Math.round((rent * Number(pct)) / 100);
    const owner  = rent - margin;
    if (margin > 0) {
      entries.push({ ...base, account: "revenue_booking_margin", direction: "credit", amount: margin,
        description: `Platform margin at ${Number(pct)}%` });
    }
    if (owner > 0) {
      entries.push({ ...base, account: "owner_payable", direction: "credit", amount: owner,
        description: "Owner share of rent" });
    }
  }

  await postLedgerEntries(entries, opts.client);
  return { split: true };
}

/** Security deposit returned to the guest at the end of a stay. */
export async function postSecurityDepositRefunded(
  booking: { id: string; property_id: string; user_id: string },
  amount: number,
  opts: { createdBy?: string | null; client?: AdminClient } = {}
) {
  const amt = n(amount);
  if (amt <= 0) return;
  const base = {
    event_type: "security_deposit_refunded" as const,
    booking_id: booking.id, property_id: booking.property_id,
    user_id: booking.user_id, created_by: opts.createdBy ?? null,
  };
  await postLedgerEntries([
    { ...base, account: "deposits_held", direction: "debit",  amount: amt, description: "Deposit returned" },
    { ...base, account: "cash",          direction: "credit", amount: amt, description: "Deposit returned" },
  ], opts.client);
}

/** Deposit withheld for damage and paid across to the owner. */
export async function postSecurityDepositClaimed(
  booking: { id: string; property_id: string; user_id: string },
  amount: number,
  ownerId: string | null,
  opts: { createdBy?: string | null; client?: AdminClient } = {}
) {
  const amt = n(amount);
  if (amt <= 0) return;
  const base = {
    event_type: "security_deposit_claimed" as const,
    booking_id: booking.id, property_id: booking.property_id,
    user_id: booking.user_id, owner_id: ownerId, created_by: opts.createdBy ?? null,
  };
  await postLedgerEntries([
    { ...base, account: "deposits_held", direction: "debit",  amount: amt, description: "Deposit claimed for damage" },
    { ...base, account: "owner_payable", direction: "credit", amount: amt, description: "Damage claim due to owner" },
  ], opts.client);
}

/** Booking cancelled after payment — cash goes back out. */
export async function postBookingRefundIssued(
  booking: { id: string; property_id: string; user_id: string },
  parts: { stayRefund: number; depositRefund: number },
  opts: { createdBy?: string | null; client?: AdminClient } = {}
) {
  const stay    = n(parts.stayRefund);
  const deposit = n(parts.depositRefund);
  const total   = stay + deposit;
  if (total <= 0) return;

  const base = {
    event_type: "booking_refund_issued" as const,
    booking_id: booking.id, property_id: booking.property_id,
    user_id: booking.user_id, created_by: opts.createdBy ?? null,
  };
  const entries: LedgerEntry[] = [];
  if (stay > 0)    entries.push({ ...base, account: "unearned_revenue", direction: "debit", amount: stay,    description: "Stay refunded" });
  if (deposit > 0) entries.push({ ...base, account: "deposits_held",    direction: "debit", amount: deposit, description: "Deposit refunded" });
  entries.push({ ...base, account: "cash", direction: "credit", amount: total, description: "Refund paid out" });

  await postLedgerEntries(entries, opts.client);
}

// ── Consultations ────────────────────────────────────────────────────────────

export async function postConsultationPaymentReceived(
  consultation: { id: string; user_id: string; amount: number },
  opts: { createdBy?: string | null; client?: AdminClient } = {}
) {
  const amt = n(consultation.amount);
  if (amt <= 0) return;
  const base = {
    event_type: "consultation_payment_received" as const,
    consultation_id: consultation.id, user_id: consultation.user_id,
    created_by: opts.createdBy ?? null,
  };
  await postLedgerEntries([
    { ...base, account: "cash",             direction: "debit",  amount: amt, description: "Consultation payment received" },
    { ...base, account: "unearned_revenue", direction: "credit", amount: amt, description: "Session not yet delivered" },
  ], opts.client);
}

export async function postConsultationRevenueEarned(
  consultation: { id: string; user_id: string; amount: number },
  opts: { createdBy?: string | null; client?: AdminClient } = {}
) {
  const amt = n(consultation.amount);
  if (amt <= 0) return;
  const base = {
    event_type: "consultation_revenue_earned" as const,
    consultation_id: consultation.id, user_id: consultation.user_id,
    created_by: opts.createdBy ?? null,
  };
  await postLedgerEntries([
    { ...base, account: "unearned_revenue",     direction: "debit",  amount: amt, description: "Session delivered" },
    { ...base, account: "revenue_consultation", direction: "credit", amount: amt, description: "Consultation fee earned" },
  ], opts.client);
}

// ── Viewing deposits ─────────────────────────────────────────────────────────

export async function postViewingDepositReceived(
  viewing: { id: string; property_id: string; user_id: string; amount: number },
  opts: { createdBy?: string | null; client?: AdminClient } = {}
) {
  const amt = n(viewing.amount);
  if (amt <= 0) return;
  const base = {
    event_type: "viewing_deposit_received" as const,
    viewing_id: viewing.id, property_id: viewing.property_id,
    user_id: viewing.user_id, created_by: opts.createdBy ?? null,
  };
  await postLedgerEntries([
    { ...base, account: "cash",          direction: "debit",  amount: amt, description: "Viewing deposit received" },
    { ...base, account: "deposits_held", direction: "credit", amount: amt, description: "Refundable viewing deposit" },
  ], opts.client);
}

/** Guest attended — the deposit becomes spendable credit, still a liability. */
export async function postViewingDepositConvertedToCredit(
  viewing: { id: string; property_id: string; user_id: string; amount: number },
  opts: { createdBy?: string | null; client?: AdminClient } = {}
) {
  const amt = n(viewing.amount);
  if (amt <= 0) return;
  const base = {
    event_type: "viewing_deposit_converted_to_credit" as const,
    viewing_id: viewing.id, property_id: viewing.property_id,
    user_id: viewing.user_id, created_by: opts.createdBy ?? null,
  };
  await postLedgerEntries([
    { ...base, account: "deposits_held",       direction: "debit",  amount: amt, description: "Deposit converted on attendance" },
    { ...base, account: "credits_outstanding", direction: "credit", amount: amt, description: "Credit issued to guest" },
  ], opts.client);
}

/** No-show — the deposit is forfeited and becomes income. */
export async function postViewingDepositForfeited(
  viewing: { id: string; property_id: string; user_id: string; amount: number },
  opts: { createdBy?: string | null; client?: AdminClient } = {}
) {
  const amt = n(viewing.amount);
  if (amt <= 0) return;
  const base = {
    event_type: "viewing_deposit_forfeited" as const,
    viewing_id: viewing.id, property_id: viewing.property_id,
    user_id: viewing.user_id, created_by: opts.createdBy ?? null,
  };
  await postLedgerEntries([
    { ...base, account: "deposits_held",             direction: "debit",  amount: amt, description: "Deposit forfeited on no-show" },
    { ...base, account: "revenue_forfeited_deposit", direction: "credit", amount: amt, description: "Forfeited viewing deposit" },
  ], opts.client);
}

export async function postViewingDepositRefunded(
  viewing: { id: string; property_id: string; user_id: string; amount: number },
  opts: { createdBy?: string | null; client?: AdminClient } = {}
) {
  const amt = n(viewing.amount);
  if (amt <= 0) return;
  const base = {
    event_type: "viewing_deposit_refunded" as const,
    viewing_id: viewing.id, property_id: viewing.property_id,
    user_id: viewing.user_id, created_by: opts.createdBy ?? null,
  };
  await postLedgerEntries([
    { ...base, account: "deposits_held", direction: "debit",  amount: amt, description: "Viewing deposit refunded" },
    { ...base, account: "cash",          direction: "credit", amount: amt, description: "Refund paid out" },
  ], opts.client);
}

// ── Credits ──────────────────────────────────────────────────────────────────

/** Credit spent on a booking: a liability to the guest becomes one to deliver a stay. */
export async function postCreditRedeemed(
  ref: { booking_id: string; user_id: string; property_id?: string | null; amount: number },
  opts: { createdBy?: string | null; client?: AdminClient } = {}
) {
  const amt = n(ref.amount);
  if (amt <= 0) return;
  const base = {
    event_type: "credit_redeemed" as const,
    booking_id: ref.booking_id, user_id: ref.user_id,
    property_id: ref.property_id ?? null, created_by: opts.createdBy ?? null,
  };
  await postLedgerEntries([
    { ...base, account: "credits_outstanding", direction: "debit",  amount: amt, description: "Credit redeemed" },
    { ...base, account: "unearned_revenue",    direction: "credit", amount: amt, description: "Applied to stay not yet delivered" },
  ], opts.client);
}

/** Credit lapsed unspent — the obligation ends and the value is kept. */
export async function postCreditExpired(
  ref: { user_id: string; amount: number },
  opts: { createdBy?: string | null; client?: AdminClient } = {}
) {
  const amt = n(ref.amount);
  if (amt <= 0) return;
  const base = {
    event_type: "credit_expired" as const,
    user_id: ref.user_id, created_by: opts.createdBy ?? null,
  };
  await postLedgerEntries([
    { ...base, account: "credits_outstanding",       direction: "debit",  amount: amt, description: "Credit expired" },
    { ...base, account: "revenue_forfeited_deposit", direction: "credit", amount: amt, description: "Expired credit recognised" },
  ], opts.client);
}

// ── Owner payouts and placements ─────────────────────────────────────────────

export async function postOwnerPayoutPaid(
  ref: { owner_id: string; amount: number; reference?: string | null },
  opts: { createdBy?: string | null; client?: AdminClient } = {}
) {
  const amt = n(ref.amount);
  if (amt <= 0) return;
  const base = {
    event_type: "owner_payout_paid" as const,
    owner_id: ref.owner_id, created_by: opts.createdBy ?? null,
  };
  await postLedgerEntries([
    { ...base, account: "owner_payable", direction: "debit",  amount: amt, description: ref.reference ?? "Owner payout" },
    { ...base, account: "cash",          direction: "credit", amount: amt, description: ref.reference ?? "Owner payout" },
  ], opts.client);
}

export async function postPlacementCommissionEarned(
  ref: { property_id: string | null; owner_id: string | null; user_id: string | null; amount: number },
  opts: { createdBy?: string | null; client?: AdminClient } = {}
) {
  const amt = n(ref.amount);
  if (amt <= 0) return;
  const base = {
    event_type: "placement_commission_earned" as const,
    property_id: ref.property_id, owner_id: ref.owner_id,
    user_id: ref.user_id, created_by: opts.createdBy ?? null,
  };
  await postLedgerEntries([
    { ...base, account: "commission_receivable", direction: "debit",  amount: amt, description: "Placement commission invoiced" },
    { ...base, account: "revenue_commission",    direction: "credit", amount: amt, description: "Placement commission earned" },
  ], opts.client);
}

// ── VeriHome's own spending ──────────────────────────────────────────────────
// The only events that reduce spendable cash without reducing a liability.
// Everything else either leaves cash alone or pays down something owed, which
// is why the overdraw warning was unreachable before these existed.

/** Operating cost — salaries, rent, tools, marketing. */
export async function postOperatingExpense(
  ref: { amount: number; description: string; propertyId?: string | null },
  opts: { createdBy?: string | null; client?: AdminClient } = {}
) {
  const amt = n(ref.amount);
  if (amt <= 0) return;
  const base = {
    event_type: "operating_expense_paid" as const,
    property_id: ref.propertyId ?? null,
    created_by: opts.createdBy ?? null,
  };
  await postLedgerEntries([
    { ...base, account: "expense_operating", direction: "debit",  amount: amt, description: ref.description },
    { ...base, account: "cash",              direction: "credit", amount: amt, description: ref.description },
  ], opts.client);
}

/** Money taken out of the business by its owners — not an operating cost. */
export async function postEquityDrawing(
  ref: { amount: number; description: string },
  opts: { createdBy?: string | null; client?: AdminClient } = {}
) {
  const amt = n(ref.amount);
  if (amt <= 0) return;
  const base = {
    event_type: "equity_drawing_paid" as const,
    created_by: opts.createdBy ?? null,
  };
  await postLedgerEntries([
    { ...base, account: "equity_drawings", direction: "debit",  amount: amt, description: ref.description },
    { ...base, account: "cash",            direction: "credit", amount: amt, description: ref.description },
  ], opts.client);
}

export async function postPlacementCommissionReceived(
  ref: { property_id: string | null; owner_id: string | null; amount: number },
  opts: { createdBy?: string | null; client?: AdminClient } = {}
) {
  const amt = n(ref.amount);
  if (amt <= 0) return;
  const base = {
    event_type: "placement_commission_received" as const,
    property_id: ref.property_id, owner_id: ref.owner_id,
    created_by: opts.createdBy ?? null,
  };
  await postLedgerEntries([
    { ...base, account: "cash",                  direction: "debit",  amount: amt, description: "Placement commission paid by owner" },
    { ...base, account: "commission_receivable", direction: "credit", amount: amt, description: "Receivable settled" },
  ], opts.client);
}
