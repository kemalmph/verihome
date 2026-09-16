import { createAdminClient } from "@/lib/supabase/admin";
import { getLedgerBalances, balanceOf } from "@/lib/ledger/post";
import type { Period } from "./period";

// Every figure here derives from ledger_entries. Nothing sums booking rows
// directly — that is how GBV and revenue get confused for each other.

export const REVENUE_STREAMS = [
  { account: "revenue_booking_margin",    label: "Margin pemesanan",   color: "#0d8f66" },
  { account: "revenue_consultation",      label: "Biaya konsultasi",   color: "#1f6fd0" },
  { account: "revenue_cleaning",          label: "Biaya kebersihan",   color: "#c27c00" },
  { account: "revenue_commission",        label: "Komisi penempatan",  color: "#7d3cc0" },
  { account: "revenue_forfeited_deposit", label: "Deposit hangus",     color: "#cf2f52" },
] as const;

const iso = (d: Date) => d.toISOString();
const num = (v: unknown) => Number(v ?? 0);

export interface StreamRow {
  account: string; label: string; color: string;
  amount: number; count: number; share: number;
  prevAmount: number; change: number | null;
}

export interface SalesReport {
  gbv: number;
  netRevenue: number;
  takeRate: number | null;
  cashPosition: number;
  streams: StreamRow[];
  monthly: { month: string; byAccount: Record<string, number>; total: number }[];
  volume: {
    bookings: { count: number; gbv: number; avgValue: number; avgNights: number };
    consultations: { byPackage: { package: string; count: number; revenue: number }[]; total: number };
    viewings: { requested: number; attended: number; noShow: number; rate: number | null };
    placements: { count: number; total: number; avg: number };
  };
  topProperties: {
    id: string; name: string; area: string | null;
    bookings: number; gbv: number; revenue: number; ownerPayout: number; nights: number;
  }[];
  attention: {
    awaitingVerification: { count: number; amount: number };
    ownerPayoutsDue: { amount: number };
    refundsPending: { count: number; amount: number };
    missingCommission: { count: number };
    placementsUninvoiced: { count: number; amount: number };
  };
}

export async function getSalesReport(period: Period): Promise<SalesReport> {
  const admin = createAdminClient();

  const [
    gbvRes, prevGbvRes, streamRes, prevStreamRes, monthlyRes, propPerfRes, balances,
  ] = await Promise.all([
    admin.rpc("ledger_gbv", { p_from: iso(period.from), p_to: iso(period.to) }),
    admin.rpc("ledger_gbv", { p_from: iso(period.prevFrom), p_to: iso(period.prevTo) }),
    admin.rpc("ledger_revenue_by_stream", { p_from: iso(period.from), p_to: iso(period.to) }),
    admin.rpc("ledger_revenue_by_stream", { p_from: iso(period.prevFrom), p_to: iso(period.prevTo) }),
    admin.rpc("ledger_monthly_revenue", { p_months: 12 }),
    admin.rpc("ledger_property_performance", { p_from: iso(period.from), p_to: iso(period.to) }),
    // Cash is deliberately all-time: a period-bounded cash figure is not a
    // balance, and this card answers "what is in the account right now".
    getLedgerBalances({ client: admin }),
  ]);

  const gbv = num(gbvRes.data);
  const cashPosition = balanceOf(balances, "cash");

  const streamMap = new Map<string, { amount: number; count: number }>();
  for (const r of (streamRes.data ?? []) as Record<string, unknown>[]) {
    streamMap.set(String(r.account), { amount: num(r.amount), count: num(r.entry_count) });
  }
  const prevMap = new Map<string, number>();
  for (const r of (prevStreamRes.data ?? []) as Record<string, unknown>[]) {
    prevMap.set(String(r.account), num(r.amount));
  }

  const netRevenue = [...streamMap.values()].reduce((s, v) => s + v.amount, 0);

  const streams: StreamRow[] = REVENUE_STREAMS.map((s) => {
    const cur = streamMap.get(s.account) ?? { amount: 0, count: 0 };
    const prev = prevMap.get(s.account) ?? 0;
    return {
      account: s.account, label: s.label, color: s.color,
      amount: cur.amount, count: cur.count,
      share: netRevenue > 0 ? (cur.amount / netRevenue) * 100 : 0,
      prevAmount: prev,
      // No previous figure means no meaningful percentage — showing +100%
      // against zero would imply growth that cannot be computed.
      change: prev > 0 ? ((cur.amount - prev) / prev) * 100 : null,
    };
  });

  // ── Monthly trend ──────────────────────────────────────────────────────────
  const monthBuckets = new Map<string, Record<string, number>>();
  for (const r of (monthlyRes.data ?? []) as Record<string, unknown>[]) {
    const m = String(r.month).slice(0, 7);
    if (!monthBuckets.has(m)) monthBuckets.set(m, {});
    monthBuckets.get(m)![String(r.account)] = num(r.amount);
  }
  // Fill gaps so a quiet month reads as zero rather than vanishing from the axis.
  const monthly: SalesReport["monthly"] = [];
  const cursor = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() - 11, 1));
  for (let i = 0; i < 12; i++) {
    const key = cursor.toISOString().slice(0, 7);
    const byAccount = monthBuckets.get(key) ?? {};
    monthly.push({
      month: key,
      byAccount,
      total: Object.values(byAccount).reduce((s, v) => s + v, 0),
    });
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }

  // ── Volume ─────────────────────────────────────────────────────────────────
  const [bookingsRes, consultsRes, viewingsRes, placementsRes, propsRes, pendingPayRes, refundRes] =
    await Promise.all([
      admin.from("bookings")
        .select("id, total_price, nights, check_in_date, check_out_date, property_id, payment_status")
        .gte("created_at", iso(period.from)).lt("created_at", iso(period.to)),
      admin.from("consultations")
        .select("id, package_type, price, final_price, credit_applied, status")
        .gte("created_at", iso(period.from)).lt("created_at", iso(period.to)),
      admin.from("viewings")
        .select("id, status, attended, deposit_paid")
        .gte("created_at", iso(period.from)).lt("created_at", iso(period.to)),
      admin.from("placements")
        .select("id, commission_amount, status")
        .gte("created_at", iso(period.from)).lt("created_at", iso(period.to)),
      admin.from("properties").select("id, name, area, rental_mode, platform_commission_pct"),
      admin.from("bookings")
        .select("id, total_price, security_deposit, credit_applied")
        .eq("payment_status", "pending_verification"),
      admin.from("viewings")
        .select("id, deposit_amount")
        .not("deposit_refund_requested_at", "is", null)
        .eq("deposit_refunded", false),
    ]);

  const bookings = bookingsRes.data ?? [];
  const nightsOf = (b: Record<string, unknown>) => {
    if (b.nights) return num(b.nights);
    const ci = new Date(String(b.check_in_date)), co = new Date(String(b.check_out_date));
    return Math.max(0, Math.round((+co - +ci) / 86_400_000));
  };
  const bookingGbv = bookings.reduce((s, b) => s + num(b.total_price), 0);
  const totalNights = bookings.reduce((s, b) => s + nightsOf(b), 0);

  const consults = consultsRes.data ?? [];
  const pkgMap = new Map<string, { count: number; revenue: number }>();
  for (const c of consults) {
    const k = String(c.package_type ?? "—");
    const amt = num(c.final_price ?? c.price) - num(c.credit_applied);
    const e = pkgMap.get(k) ?? { count: 0, revenue: 0 };
    pkgMap.set(k, { count: e.count + 1, revenue: e.revenue + (c.status === "completed" ? amt : 0) });
  }

  const viewings = viewingsRes.data ?? [];
  const attended = viewings.filter((v) => v.attended === true).length;
  const noShow = viewings.filter((v) => v.status === "no_show").length;
  const decided = attended + noShow;

  const placements = placementsRes.data ?? [];
  const placementTotal = placements.reduce((s, p) => s + num(p.commission_amount), 0);

  // ── Top properties ─────────────────────────────────────────────────────────
  const propsById = new Map((propsRes.data ?? []).map((p) => [p.id, p]));
  const nightsByProperty = new Map<string, number>();
  for (const b of bookings) {
    const pid = String(b.property_id);
    nightsByProperty.set(pid, (nightsByProperty.get(pid) ?? 0) + nightsOf(b));
  }

  const topProperties = ((propPerfRes.data ?? []) as Record<string, unknown>[])
    .map((r) => {
      const p = propsById.get(String(r.property_id));
      return {
        id: String(r.property_id),
        name: p?.name ?? "—",
        area: p?.area ?? null,
        bookings: num(r.booking_count),
        gbv: num(r.gbv),
        revenue: num(r.revenue),
        ownerPayout: num(r.owner_payable),
        nights: nightsByProperty.get(String(r.property_id)) ?? 0,
      };
    })
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  const pendingPay = pendingPayRes.data ?? [];
  const refunds = refundRes.data ?? [];

  return {
    gbv,
    netRevenue,
    takeRate: gbv > 0 ? (netRevenue / gbv) * 100 : null,
    cashPosition,
    streams,
    monthly,
    volume: {
      bookings: {
        count: bookings.length,
        gbv: bookingGbv,
        avgValue: bookings.length ? Math.round(bookingGbv / bookings.length) : 0,
        avgNights: bookings.length ? totalNights / bookings.length : 0,
      },
      consultations: {
        byPackage: [...pkgMap.entries()].map(([p, v]) => ({ package: p, ...v })),
        total: consults.length,
      },
      viewings: {
        requested: viewings.length, attended, noShow,
        rate: decided > 0 ? (attended / decided) * 100 : null,
      },
      placements: {
        count: placements.length,
        total: placementTotal,
        avg: placements.length ? Math.round(placementTotal / placements.length) : 0,
      },
    },
    topProperties,
    attention: {
      awaitingVerification: {
        count: pendingPay.length,
        amount: pendingPay.reduce(
          (s, b) => s + (num(b.total_price) - num(b.credit_applied) + num(b.security_deposit)), 0),
      },
      ownerPayoutsDue: { amount: balanceOf(balances, "owner_payable") },
      refundsPending: {
        count: refunds.length,
        amount: refunds.reduce((s, v) => s + num(v.deposit_amount), 0),
      },
      missingCommission: {
        count: (propsRes.data ?? []).filter(
          (p) => ["short_stay", "both"].includes(p.rental_mode ?? "") &&
                 p.platform_commission_pct == null).length,
      },
      placementsUninvoiced: {
        count: placements.filter((p) => p.status === "reported").length,
        amount: placements.filter((p) => p.status === "reported")
                          .reduce((s, p) => s + num(p.commission_amount), 0),
      },
    },
  };
}
