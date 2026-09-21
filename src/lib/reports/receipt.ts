import { createAdminClient } from "@/lib/supabase/admin";

export interface ReceiptLine {
  label: string;
  labelEn: string;
  amount: number;
  /** Refundable amounts are stated separately — they are not a charge. */
  refundable?: boolean;
}

export interface Receipt {
  kind: "booking" | "consultation" | "viewing";
  number: string;
  issuedAt: string;
  customerName: string;
  customerEmail: string;
  lines: ReceiptLine[];
  totalPaid: number;
  refundableTotal: number;
  paymentMethod: string;
  paidAt: string | null;
  /** Bookings only */
  property?: { name: string; area: string | null } | null;
  checkIn?: string | null;
  checkOut?: string | null;
  nights?: number | null;
  userId: string;
}

const n = (v: unknown) => Math.round(Number(v ?? 0));

const methodLabel = (provider: string | null | undefined) =>
  provider === "xendit" ? "Xendit" : "Transfer bank";

/**
 * Resolves one id against whichever of the three paid things it belongs to.
 * Returns null when nothing matches, which the page turns into a 404 rather
 * than an empty receipt.
 */
export async function getReceipt(id: string): Promise<Receipt | null> {
  const admin = createAdminClient();

  // ── Booking ────────────────────────────────────────────────────────────────
  const { data: booking } = await admin
    .from("bookings")
    .select(`id, booking_code, user_id, total_price, cleaning_fee, security_deposit,
             credit_applied, payment_status, payment_provider, confirmed_at, created_at,
             check_in_date, check_out_date, nights,
             property:properties ( name, area ),
             user:users ( name, email )`)
    .eq("id", id)
    .maybeSingle();

  if (booking) {
    const stay = n(booking.total_price) - n(booking.cleaning_fee);
    const cleaning = n(booking.cleaning_fee);
    const deposit = n(booking.security_deposit);
    const credit = n(booking.credit_applied);
    const u = booking.user as { name?: string; email?: string } | null;

    const lines: ReceiptLine[] = [
      { label: "Biaya sewa", labelEn: "Accommodation", amount: stay },
    ];
    if (cleaning > 0) lines.push({ label: "Biaya kebersihan", labelEn: "Cleaning fee", amount: cleaning });
    if (credit > 0) lines.push({ label: "Kredit digunakan", labelEn: "Credit applied", amount: -credit });
    if (deposit > 0) {
      lines.push({ label: "Jaminan keamanan", labelEn: "Security deposit", amount: deposit, refundable: true });
    }

    const nights = booking.nights
      ? n(booking.nights)
      : Math.max(0, Math.round(
          (+new Date(String(booking.check_out_date)) - +new Date(String(booking.check_in_date))) / 86_400_000));

    return {
      kind: "booking",
      number: booking.booking_code,
      issuedAt: new Date().toISOString().slice(0, 10),
      customerName: u?.name ?? "—",
      customerEmail: u?.email ?? "—",
      lines,
      totalPaid: stay + cleaning - credit + deposit,
      refundableTotal: deposit,
      paymentMethod: methodLabel(booking.payment_provider),
      paidAt: booking.payment_status === "paid" ? (booking.confirmed_at ?? booking.created_at) : null,
      property: booking.property as unknown as { name: string; area: string | null } | null,
      checkIn: booking.check_in_date,
      checkOut: booking.check_out_date,
      nights,
      userId: booking.user_id,
    };
  }

  // ── Consultation ───────────────────────────────────────────────────────────
  const { data: consult } = await admin
    .from("consultations")
    .select(`id, user_id, package_type, price, final_price, credit_applied, status,
             payment_provider, created_at, user:users ( name, email )`)
    .eq("id", id)
    .maybeSingle();

  if (consult) {
    const gross = n(consult.final_price ?? consult.price);
    const credit = n(consult.credit_applied);
    const u = consult.user as { name?: string; email?: string } | null;
    const pkg = consult.package_type === "premium" ? "Konsultasi Premium (60 menit)" : "Konsultasi Basic (30 menit)";

    const lines: ReceiptLine[] = [{ label: pkg, labelEn: "Consultation session", amount: gross }];
    if (credit > 0) lines.push({ label: "Kredit digunakan", labelEn: "Credit applied", amount: -credit });

    return {
      kind: "consultation",
      number: `KON-${String(consult.id).slice(0, 8).toUpperCase()}`,
      issuedAt: new Date().toISOString().slice(0, 10),
      customerName: u?.name ?? "—",
      customerEmail: u?.email ?? "—",
      lines,
      totalPaid: gross - credit,
      refundableTotal: 0,
      paymentMethod: methodLabel(consult.payment_provider),
      paidAt: ["paid", "completed"].includes(consult.status ?? "") ? consult.created_at : null,
      userId: consult.user_id,
    };
  }

  // ── Viewing deposit ────────────────────────────────────────────────────────
  const { data: viewing } = await admin
    .from("viewings")
    .select(`id, user_id, deposit_amount, deposit_paid, deposit_paid_at, deposit_refunded,
             credit_issued, payment_provider, created_at,
             property:properties ( name, area ), user:users ( name, email )`)
    .eq("id", id)
    .maybeSingle();

  if (viewing) {
    const amt = n(viewing.deposit_amount);
    const u = viewing.user as { name?: string; email?: string } | null;

    return {
      kind: "viewing",
      number: `TJN-${String(viewing.id).slice(0, 8).toUpperCase()}`,
      issuedAt: new Date().toISOString().slice(0, 10),
      customerName: u?.name ?? "—",
      customerEmail: u?.email ?? "—",
      // Once the deposit has become credit it is no longer refundable money —
      // printing it under "Dapat dikembalikan" would restate the promise this
      // release exists to correct. Credit is claimed back through the 14-day
      // cash-out, not through this receipt.
      lines: [{
        label: viewing.credit_issued ? "Titipan kunjungan — sudah menjadi kredit" : "Titipan jaminan kunjungan",
        labelEn: viewing.credit_issued ? "Viewing deposit — converted to credit" : "Viewing deposit",
        amount: amt, refundable: !viewing.deposit_refunded && !viewing.credit_issued,
      }],
      totalPaid: amt,
      refundableTotal: viewing.deposit_refunded || viewing.credit_issued ? 0 : amt,
      paymentMethod: methodLabel(viewing.payment_provider),
      paidAt: viewing.deposit_paid ? (viewing.deposit_paid_at ?? viewing.created_at) : null,
      property: viewing.property as unknown as { name: string; area: string | null } | null,
      userId: viewing.user_id,
    };
  }

  return null;
}
