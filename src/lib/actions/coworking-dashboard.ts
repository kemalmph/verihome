"use server";

import { requireAnyPermission } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * The operator dashboard's reads.
 *
 * One rule runs through all of it: occupancy is a question about *now*, and
 * `now` is a moment, not a status column. A unit is occupied when a holding
 * reservation covers this instant — the same test the exclusion constraint
 * makes, so the dashboard and the database cannot disagree about whether a
 * room is free.
 *
 * `lettable_units.status` is lettability, not occupancy (§ the coworking
 * migration). A unit that is let is still `available`; it is simply held.
 * Reading that column as "is it free" is the single most tempting mistake
 * here, and it would report every let unit as empty.
 */

/** The statuses that hold a unit. Must match unit_reservations_no_overlap. */
const HOLDING = ["pending", "confirmed"] as const;

export interface DashboardUnit {
  id: string;
  name: string;
  unit_type: string;
  letting_mode: string;
  status: string;
  capacity: number;
  size_sqm: number | null;
  price: number | null;
  exclusive_use: boolean;
  /** The reservation covering now, if any. */
  occupied_by: {
    reservation_id: string;
    tenant: string;
    contract_ref: string | null;
    ends_at: string;
    payment_status: string;
  } | null;
  /** The next reservation that starts after now, if any. */
  next_up: { tenant: string; starts_at: string } | null;
}

export interface DashboardInstalment {
  id: string;
  reservation_id: string;
  seq: number;
  due_date: string;
  amount: number;
  status: string;
  paid_at: string | null;
  tenant: string;
  unit_name: string;
  contract_ref: string | null;
  /** Negative = overdue by that many days. */
  days_until_due: number;
}

export interface DashboardEnding {
  reservation_id: string;
  tenant: string;
  unit_name: string;
  ends_at: string;
  days_left: number;
  contract_ref: string | null;
}

export interface SiteDashboard {
  site: { id: string; name: string; slug: string; site_type: string; status: string; address: string | null };
  units: DashboardUnit[];
  totals: {
    units: number;
    lettable: number;
    occupied: number;
    vacant: number;
    unpriced: number;
    /** Area, not seats: these are offices let by the square metre. */
    sqm_total: number;
    sqm_occupied: number;
    /**
     * Rent per month already committed, from the CONTRACTS — not from the
     * units' asking prices. A let room earns what its tenant agreed to, which
     * may be below list; summing the price list would report revenue nobody
     * promised.
     */
    committed_monthly: number;
  };
  instalments: {
    overdue: DashboardInstalment[];
    upcoming: DashboardInstalment[];
    paid_total: number;
    outstanding_total: number;
  };
  ending_soon: DashboardEnding[];
}

const DAY = 1000 * 60 * 60 * 24;

/**
 * Whole days between today and a date, counted as calendar days in Jakarta.
 *
 * Not instant arithmetic. An instalment due five days ago is "lewat 5 hari"
 * all day, every hour of today — subtracting timestamps makes it 5.6 days and
 * rounds to 6 by mid-afternoon, so the same invoice ages a day while nobody
 * is looking. It did exactly that.
 *
 * Both sides are reduced to a Jakarta calendar date first, then subtracted, so
 * the answer only changes at Jakarta midnight.
 */
const jakartaDate = (d: Date) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(d); // en-CA gives YYYY-MM-DD

const daysFromNow = (when: string | Date) => {
  const target = typeof when === "string" && /^\d{4}-\d{2}-\d{2}$/.test(when)
    ? when                                   // already a plain date
    : jakartaDate(new Date(when));
  const today = jakartaDate(new Date());
  return Math.round((Date.parse(`${target}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / DAY);
};

export async function getSiteDashboard(siteId: string): Promise<SiteDashboard | null> {
  await requireAnyPermission(["sites.operate_all","sites.finance_all"]);
  const admin = createAdminClient();
  const nowIso = new Date().toISOString();

  const { data: site } = await admin
    .from("sites")
    .select("id, name, slug, site_type, status, address")
    .eq("id", siteId)
    .maybeSingle();
  if (!site) return null;

  const { data: unitRows } = await admin
    .from("lettable_units")
    .select("id, name, unit_type, letting_mode, status, capacity, size_sqm, price, exclusive_use")
    .eq("site_id", siteId);

  /**
   * Natural order, not string order.
   *
   * Postgres sorts RO10, RO11, RO12, RO13, RO1A, RO1B, RO2 … because "1" sorts
   * before "2" character by character. An operator reading a floor plan
   * expects RO1A, RO1B, RO2 … RO13, and a list they cannot scan is a list they
   * will not trust.
   */
  const naturally = (a: string, b: string) =>
    a.localeCompare(b, "id", { numeric: true, sensitivity: "base" });

  const units = (unitRows ?? []).slice().sort((a, b) => naturally(a.name, b.name));
  const unitIds = units.map((u) => u.id);

  // Every holding reservation for this site's units, in one read. Filtering
  // by time in SQL would need two queries (covering now / starting later);
  // one read and a partition here keeps the two consistent with each other,
  // which matters when a reservation ends between them.
  const { data: resRows } = unitIds.length
    ? await admin
        .from("unit_reservations")
        .select("id, unit_id, tenant_name, user_id, contract_ref, starts_at, ends_at, status, payment_status, total_price, unit_price")
        .in("unit_id", unitIds)
        .in("status", HOLDING as unknown as string[])
        .order("starts_at")
    : { data: [] };

  const reservations = resRows ?? [];
  const nameOf = (r: { tenant_name: string | null; user_id: string | null }) =>
    r.tenant_name ?? (r.user_id ? "Akun terdaftar" : "—");

  const unitNameById = new Map(units.map((u) => [u.id, u.name]));

  const dashUnits: DashboardUnit[] = units.map((u) => {
    const mine = reservations.filter((r) => r.unit_id === u.id);
    const current = mine.find((r) => r.starts_at <= nowIso && r.ends_at > nowIso) ?? null;
    const next = mine.find((r) => r.starts_at > nowIso) ?? null;
    return {
      id: u.id,
      name: u.name,
      unit_type: u.unit_type,
      letting_mode: u.letting_mode,
      status: u.status,
      capacity: Number(u.capacity ?? 0),
      size_sqm: u.size_sqm === null ? null : Number(u.size_sqm),
      price: u.price === null ? null : Number(u.price),
      exclusive_use: Boolean(u.exclusive_use),
      occupied_by: current
        ? {
            reservation_id: current.id,
            tenant: nameOf(current),
            contract_ref: current.contract_ref,
            ends_at: current.ends_at,
            payment_status: current.payment_status,
          }
        : null,
      next_up: next ? { tenant: nameOf(next), starts_at: next.starts_at } : null,
    };
  });

  const lettable = dashUnits.filter((u) => u.status === "available");
  const occupied = dashUnits.filter((u) => u.occupied_by !== null);

  // ── instalments ───────────────────────────────────────────────────────────
  const resIds = reservations.map((r) => r.id);
  const { data: instRows } = resIds.length
    ? await admin
        .from("reservation_instalments")
        .select("id, reservation_id, seq, due_date, amount, status, paid_at")
        .in("reservation_id", resIds)
        .order("due_date")
    : { data: [] };

  const resById = new Map(reservations.map((r) => [r.id, r]));
  const instalments: DashboardInstalment[] = (instRows ?? []).map((i) => {
    const r = resById.get(i.reservation_id);
    return {
      id: i.id,
      reservation_id: i.reservation_id,
      seq: i.seq,
      due_date: i.due_date,
      amount: Number(i.amount),
      status: i.status,
      paid_at: i.paid_at,
      tenant: r ? nameOf(r) : "—",
      unit_name: r ? (unitNameById.get(r.unit_id) ?? "—") : "—",
      contract_ref: r?.contract_ref ?? null,
      days_until_due: daysFromNow(i.due_date),
    };
  });

  const due = instalments.filter((i) => i.status === "due");

  return {
    site,
    units: dashUnits,
    totals: {
      units: dashUnits.length,
      lettable: lettable.length,
      occupied: occupied.length,
      vacant: lettable.length - occupied.length,
      unpriced: dashUnits.filter((u) => u.price === null).length,
      sqm_total: dashUnits.reduce((n, u) => n + (u.size_sqm ?? 0), 0),
      sqm_occupied: occupied.reduce((n, u) => n + (u.size_sqm ?? 0), 0),
      committed_monthly: reservations
        .filter((r) => r.ends_at > nowIso)
        .reduce((n, r) => n + Number(r.unit_price ?? 0), 0),
    },
    instalments: {
      overdue: due.filter((i) => i.days_until_due < 0),
      upcoming: due.filter((i) => i.days_until_due >= 0),
      paid_total: instalments.filter((i) => i.status === "paid").reduce((n, i) => n + i.amount, 0),
      outstanding_total: due.reduce((n, i) => n + i.amount, 0),
    },
    ending_soon: reservations
      .filter((r) => r.ends_at > nowIso && daysFromNow(r.ends_at) <= 90)
      .map((r) => ({
        reservation_id: r.id,
        tenant: nameOf(r),
        unit_name: unitNameById.get(r.unit_id) ?? "—",
        ends_at: r.ends_at,
        days_left: daysFromNow(r.ends_at),
        contract_ref: r.contract_ref,
      }))
      .sort((a, b) => a.days_left - b.days_left),
  };
}
