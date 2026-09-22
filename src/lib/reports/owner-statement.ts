import { createAdminClient } from "@/lib/supabase/admin";

/**
 * The owner statement figures, extracted from the admin statement page so the
 * owner portal renders the SAME numbers rather than a second calculation.
 *
 * This function takes an ownerId and trusts it. That is deliberate and it is
 * why it is not exported to any route directly: the two callers each establish
 * the id their own way — the admin page from the URL behind requireAdmin(), the
 * owner page from requireOwner(), which ignores the URL entirely. Putting the
 * authorization inside here would force one of them to lie about who is asking.
 *
 * Every figure comes from the ledger. A second calculation over bookings would
 * be a second opinion, and the two would eventually disagree with nothing to
 * say which was right.
 */

const n = (v: unknown) => Math.round(Number(v ?? 0));

export interface OwnerStatementLine {
  code: string;
  guest: string;
  property: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  gross: number;
  commission: number;
  ownerShare: number;
  settled: boolean;
}

export interface OwnerStatement {
  owner: { id: string; name: string; email: string | null; phone: string | null } | null;
  from: Date;
  to: Date;
  detail: OwnerStatementLine[];
  payouts: { date: string; amount: number; description: string }[];
  grossTotal: number;
  commissionTotal: number;
  depositClaims: number;
  earned: number;
  paidOut: number;
  outstanding: number;
}

export async function getOwnerStatement(
  ownerId: string,
  from: Date,
  to: Date
): Promise<OwnerStatement> {
  const admin = createAdminClient();

  const { data: owner } = await admin
    .from("owners").select("id, name, email, phone_whatsapp").eq("id", ownerId).maybeSingle();

  const { data: properties } = await admin
    .from("properties").select("id, name, area").eq("owner_id", ownerId);
  const propertyIds = (properties ?? []).map((p) => p.id);

  const { data: entries } = propertyIds.length
    ? await admin
        .from("ledger_entries")
        .select("entry_date, event_type, account, direction, amount, booking_id, property_id")
        .in("property_id", propertyIds)
        .gte("entry_date", from.toISOString())
        .lt("entry_date", to.toISOString())
    : { data: [] };

  const { data: payouts } = await admin
    .from("ledger_entries")
    .select("entry_date, amount, description")
    .eq("owner_id", ownerId)
    .eq("event_type", "owner_payout_paid")
    .eq("account", "owner_payable")
    .eq("direction", "debit")
    .order("entry_date", { ascending: false });

  const rows = entries ?? [];
  const bookingIds = [...new Set(rows.filter((e) => e.booking_id).map((e) => e.booking_id as string))];

  const { data: bookings } = bookingIds.length
    ? await admin
        .from("bookings")
        .select("id, booking_code, check_in_date, check_out_date, nights, total_price, property_id, status, user:users(name)")
        .in("id", bookingIds)
    : { data: [] };

  const propsById = new Map((properties ?? []).map((p) => [p.id, p]));

  const detail: OwnerStatementLine[] = (bookings ?? []).map((b) => {
    const forBooking = rows.filter((e) => e.booking_id === b.id);
    const sumOf = (acct: string, dir: "debit" | "credit") =>
      forBooking.filter((e) => e.account === acct && e.direction === dir)
                .reduce((s, e) => s + n(e.amount), 0);

    const gross = sumOf("cash", "debit");
    const ownerShare = sumOf("owner_payable", "credit") - sumOf("owner_payable", "debit");
    const commission =
      sumOf("revenue_booking_margin", "credit") + sumOf("revenue_cleaning", "credit");

    return {
      code: b.booking_code as string,
      // First name only, on the owner's statement as everywhere else.
      guest: ((b.user as unknown as { name?: string } | null)?.name ?? "—").split(" ")[0],
      property: (propsById.get(b.property_id as string)?.name as string) ?? "—",
      checkIn: b.check_in_date as string,
      checkOut: b.check_out_date as string,
      nights: n(b.nights) || Math.max(0, Math.round(
        (+new Date(String(b.check_out_date)) - +new Date(String(b.check_in_date))) / 86_400_000)),
      gross, commission, ownerShare,
      settled: b.status === "completed",
    };
  });

  const depositClaims = rows
    .filter((e) => e.event_type === "security_deposit_claimed" && e.account === "owner_payable" && e.direction === "credit")
    .reduce((s, e) => s + n(e.amount), 0);

  const grossTotal = detail.reduce((s, d) => s + d.gross, 0);
  const commissionTotal = detail.reduce((s, d) => s + d.commission, 0);
  const earned = detail.reduce((s, d) => s + d.ownerShare, 0) + depositClaims;
  const paidOut = (payouts ?? []).reduce((s, p) => s + n(p.amount), 0);

  return {
    owner: owner
      ? {
          id: owner.id as string,
          name: owner.name as string,
          email: (owner.email as string) ?? null,
          phone: (owner.phone_whatsapp as string) ?? null,
        }
      : null,
    from, to, detail,
    payouts: (payouts ?? []).map((p) => ({
      date: String(p.entry_date).slice(0, 10),
      amount: n(p.amount),
      description: (p.description as string) ?? "",
    })),
    grossTotal, commissionTotal, depositClaims,
    earned, paidOut, outstanding: earned - paidOut,
  };
}
