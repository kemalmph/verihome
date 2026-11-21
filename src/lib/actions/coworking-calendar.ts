"use server";

import { requireAdmin } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * The week a site is having.
 *
 * Every boundary here is a Jakarta boundary. A "day" computed in UTC starts at
 * 07:00 local, so an evening booking lands on the wrong square of the grid and
 * a morning one disappears off the left edge — the same class of mistake that
 * made an instalment age a day early and entitlement hours fall into the wrong
 * month. The building is in Bandung; the calendar is in Bandung time.
 */

const JKT = "Asia/Jakarta";

/** YYYY-MM-DD for an instant, as seen in Jakarta. */
export async function jakartaDay(d: Date): Promise<string> {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: JKT, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(d);
}

/** The instant a Jakarta calendar day begins. WIB is UTC+7 all year — no DST. */
function startOfJakartaDay(ymd: string): Date {
  return new Date(`${ymd}T00:00:00+07:00`);
}

/** Monday of the Jakarta week containing this date. */
function mondayOf(ymd: string): string {
  const d = new Date(`${ymd}T12:00:00+07:00`);          // midday avoids any edge
  const dow = (d.getUTCDay() + 6) % 7;                   // 0 = Monday
  d.setUTCDate(d.getUTCDate() - dow);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: JKT, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(d);
}

export interface CalUnit {
  id: string;
  name: string;
  unit_type: string;
  letting_mode: string;
  status: string;
  exclusive_use: boolean;
  capacity: number;
}

export interface CalBooking {
  id: string;
  unit_id: string;
  starts_at: string;
  ends_at: string;
  status: string;
  payment_status: string;
  who: string;
  contract_ref: string | null;
  event_id: string | null;
  event_title: string | null;
  membership_id: string | null;
  /** Jakarta days this booking touches within the week, as YYYY-MM-DD. */
  days: string[];
  /** HH:MM–HH:MM in Jakarta, or null when it spans whole days. */
  time_label: string | null;
}

export interface CalEvent {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  status: string;
  visibility: string;
  host: string | null;
  /** Parts of the event nothing has booked space for. */
  gaps: { gap_start: string; gap_end: string }[];
  unit_names: string[];
}

export interface SiteCalendar {
  site: { id: string; name: string };
  week_start: string;
  week_end: string;
  prev_week: string;
  next_week: string;
  this_week: string;
  days: { ymd: string; label: string; is_today: boolean }[];
  units: CalUnit[];
  bookings: CalBooking[];
  events: CalEvent[];
}

export async function getSiteCalendar(siteId: string, weekParam?: string): Promise<SiteCalendar | null> {
  await requireAdmin();
  const admin = createAdminClient();

  const todayYmd = await jakartaDay(new Date());
  const anchor = weekParam && /^\d{4}-\d{2}-\d{2}$/.test(weekParam) ? weekParam : todayYmd;
  const weekStart = mondayOf(anchor);

  const dayList: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = startOfJakartaDay(weekStart);
    d.setUTCDate(d.getUTCDate() + i);
    dayList.push(await jakartaDay(d));
  }
  const weekEnd = dayList[6];

  const fromTs = startOfJakartaDay(weekStart).toISOString();
  const toExclusive = startOfJakartaDay(weekEnd);
  toExclusive.setUTCDate(toExclusive.getUTCDate() + 1);
  const toTs = toExclusive.toISOString();

  const { data: site } = await admin
    .from("sites").select("id, name").eq("id", siteId).maybeSingle();
  if (!site) return null;

  const { data: unitRows } = await admin
    .from("lettable_units")
    .select("id, name, unit_type, letting_mode, status, exclusive_use, capacity")
    .eq("site_id", siteId);

  const units = (unitRows ?? [])
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name, "id", { numeric: true, sensitivity: "base" }))
    .map((u) => ({ ...u, capacity: Number(u.capacity ?? 0), exclusive_use: Boolean(u.exclusive_use) }));

  const unitIds = units.map((u) => u.id);
  const unitNameById = new Map(units.map((u) => [u.id, u.name]));

  // Overlap, not containment: a lease running all year must appear in every
  // week it covers, not only the week it started.
  const { data: resRows } = unitIds.length
    ? await admin
        .from("unit_reservations")
        .select("id, unit_id, starts_at, ends_at, status, payment_status, tenant_name, user_id, contract_ref, event_id, membership_id")
        .in("unit_id", unitIds)
        .in("status", ["pending", "confirmed", "completed"])
        .lt("starts_at", toTs)
        .gt("ends_at", fromTs)
        .order("starts_at")
    : { data: [] };

  const { data: evRows } = await admin
    .from("events")
    .select("id, title, starts_at, ends_at, status, visibility, host_name")
    .eq("site_id", siteId)
    .neq("status", "cancelled")
    .lt("starts_at", toTs)
    .gt("ends_at", fromTs)
    .order("starts_at");

  const eventTitleById = new Map((evRows ?? []).map((e) => [e.id, e.title]));

  const hhmm = (iso: string) =>
    new Intl.DateTimeFormat("id-ID", { timeZone: JKT, hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

  const bookings: CalBooking[] = [];
  for (const r of resRows ?? []) {
    const days = dayList.filter((ymd) => {
      const dayStart = startOfJakartaDay(ymd).getTime();
      const dayEnd = dayStart + 86400000;
      return new Date(r.starts_at).getTime() < dayEnd && new Date(r.ends_at).getTime() > dayStart;
    });

    // A booking that covers whole days gets no clock; one inside a single day
    // does. Showing "00:00–23:59" on a year-long lease is noise.
    const spansDays = new Date(r.ends_at).getTime() - new Date(r.starts_at).getTime() > 36 * 3600 * 1000;

    bookings.push({
      id: r.id,
      unit_id: r.unit_id,
      starts_at: r.starts_at,
      ends_at: r.ends_at,
      status: r.status,
      payment_status: r.payment_status,
      who: r.tenant_name ?? (r.user_id ? "Akun terdaftar" : "—"),
      contract_ref: r.contract_ref,
      event_id: r.event_id,
      event_title: r.event_id ? (eventTitleById.get(r.event_id) ?? null) : null,
      membership_id: r.membership_id,
      days,
      time_label: spansDays ? null : `${hhmm(r.starts_at)}–${hhmm(r.ends_at)}`,
    });
  }

  // Which units each event actually holds, and whether it holds enough of
  // them. A published event with a gap is an event announced in a room nobody
  // booked, which is the whole reason event_space_gaps exists.
  const events: CalEvent[] = [];
  for (const e of evRows ?? []) {
    const { data: gaps } = await admin.rpc("event_space_gaps", { p_event_id: e.id });
    const held = bookings.filter((b) => b.event_id === e.id).map((b) => unitNameById.get(b.unit_id) ?? "—");
    events.push({
      id: e.id,
      title: e.title,
      starts_at: e.starts_at,
      ends_at: e.ends_at,
      status: e.status,
      visibility: e.visibility,
      host: e.host_name,
      gaps: (gaps ?? []) as { gap_start: string; gap_end: string }[],
      unit_names: [...new Set(held)],
    });
  }

  const shift = (ymd: string, by: number) => {
    const d = startOfJakartaDay(ymd);
    d.setUTCDate(d.getUTCDate() + by);
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: JKT, year: "numeric", month: "2-digit", day: "2-digit",
    }).format(d);
  };

  return {
    site,
    week_start: weekStart,
    week_end: weekEnd,
    prev_week: shift(weekStart, -7),
    next_week: shift(weekStart, 7),
    this_week: todayYmd,
    days: dayList.map((ymd) => ({
      ymd,
      label: new Intl.DateTimeFormat("id-ID", {
        timeZone: JKT, weekday: "short", day: "numeric", month: "short",
      }).format(startOfJakartaDay(ymd)),
      is_today: ymd === todayYmd,
    })),
    units,
    bookings,
    events,
  };
}
