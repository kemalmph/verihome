// Vocabulary of the ledger. Kept separate from post.ts so route handlers and
// report pages can import the types without pulling in the writer.

export type LedgerEventType =
  | "booking_payment_received"
  | "booking_revenue_earned"
  | "booking_refund_issued"
  | "consultation_payment_received"
  | "consultation_revenue_earned"
  | "viewing_deposit_received"
  | "viewing_deposit_refunded"
  | "viewing_deposit_forfeited"
  | "viewing_deposit_converted_to_credit"
  | "security_deposit_received"
  | "security_deposit_refunded"
  | "security_deposit_claimed"
  | "credit_issued"
  | "credit_redeemed"
  | "credit_expired"
  | "owner_payout_due"
  | "owner_payout_paid"
  | "placement_commission_earned"
  | "placement_commission_received"
  | "cleaning_fee_received"
  | "operating_expense_paid"
  | "equity_drawing_paid";

export type LedgerAccount =
  | "cash"
  | "commission_receivable"
  | "owner_payable"
  | "deposits_held"
  | "credits_outstanding"
  | "unearned_revenue"
  | "revenue_booking_margin"
  | "revenue_consultation"
  | "revenue_cleaning"
  | "revenue_commission"
  | "revenue_forfeited_deposit"
  | "expense_operating"
  | "equity_drawings";

export type LedgerDirection = "debit" | "credit";

export const ASSET_ACCOUNTS = ["cash", "commission_receivable"] as const;

export const LIABILITY_ACCOUNTS = [
  "owner_payable",
  "deposits_held",
  "credits_outstanding",
  "unearned_revenue",
] as const;

export const REVENUE_ACCOUNTS = [
  "revenue_booking_margin",
  "revenue_consultation",
  "revenue_cleaning",
  "revenue_commission",
  "revenue_forfeited_deposit",
] as const;

/**
 * Liabilities that are returned to whoever paid them, as distinct from those
 * that become VeriHome revenue. Reports must never merge the two: adding
 * deposits to unearned revenue would overstate future income by the value of
 * every deposit the platform holds.
 */
export const RETURNABLE_LIABILITIES = ["deposits_held", "credits_outstanding"] as const;
export const EARNABLE_LIABILITIES = ["unearned_revenue"] as const;

/** Money VeriHome spends on itself. Rises on the debit side, like an asset. */
export const EXPENSE_ACCOUNTS = ["expense_operating", "equity_drawings"] as const;

export function accountKind(
  account: LedgerAccount
): "asset" | "liability" | "income" | "expense" {
  if ((ASSET_ACCOUNTS as readonly string[]).includes(account)) return "asset";
  if ((LIABILITY_ACCOUNTS as readonly string[]).includes(account)) return "liability";
  if ((EXPENSE_ACCOUNTS as readonly string[]).includes(account)) return "expense";
  return "income";
}

export interface LedgerEntry {
  event_type: LedgerEventType;
  account: LedgerAccount;
  direction: LedgerDirection;
  /** IDR, whole rupiah. Never negative — direction carries the sign. */
  amount: number;

  entry_date?: string;
  booking_id?: string | null;
  viewing_id?: string | null;
  consultation_id?: string | null;
  property_id?: string | null;
  user_id?: string | null;
  owner_id?: string | null;

  description?: string | null;
  created_by?: string | null;
  /** On a correcting entry, the id of the entry being reversed. */
  reversed_by?: string | null;
}

export interface AccountBalance {
  account: LedgerAccount;
  kind: "asset" | "liability" | "income" | "expense";
  debits: number;
  credits: number;
  balance: number;
}
