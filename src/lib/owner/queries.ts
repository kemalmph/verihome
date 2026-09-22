import { createAdminClient } from "@/lib/supabase/admin";
import { requireOwner, ownedProperty, NotFoundError } from "@/lib/auth/guards";

/**
 * Every owner-scoped read.
 *
 * Each function calls requireOwner() itself and filters by the owner id it
 * returns. None of them accepts an owner id from a caller — an argument would
 * be a parameter someone could set, and the whole point is that it cannot be.
 *
 * Reads that take a record id filter by that id AND the owner id in the same
 * query, and throw NotFoundError on a miss. Loading by id and comparing
 * afterwards is the same bug written later: by then the row has been read.
 */

const n = (v: unknown) => Math.round(Number(v ?? 0));

/** Guest privacy: owners see a first name, never a surname. */
export function firstNameOnly(full: string | null | undefined): string {
  const s = String(full ?? "").trim();
  if (!s) return "—";
  return s.split(/\s+/)[0];
}

/**
 * Owner sees guest contact only in a narrow window around the stay: from 48
 * hours before check-in until checkout, and only once confirmed. Outside it
 * there is no operational reason for the owner to hold a guest's phone number.
 * The guest's view of the owner uses the identical window.
 */
export function contactWindowOpen(
  status: string | null,
  checkIn: string | null,
  checkOut: string | null,
  now = new Date()
): boolean {
  if (status !== "confirmed" && status !== "completed") return false;
  if (!checkIn || !checkOut) return false;
  const opens = new Date(`${checkIn}T00:00:00+07:00`).getTime() - 48 * 3_600_000;
  const closes = new Date(`${checkOut}T23:59:59+07:00`).getTime();
  const t = now.getTime();
  return t >= opens && t <= closes;
}

// ── Properties ──────────────────────────────────────────────────────────────

export async function ownerProperties() {
  const { ownerId } = await requireOwner();
  const admin = createAdminClient();

  const { data } = await admin
    .from("properties")
    .select("id, name, area, slug, status, rental_mode, price_monthly, platform_commission_pct, cleaning_fee_goes_to")
    .eq("owner_id", ownerId)
    .order("name");

  return data ?? [];
}

export async function ownerPropertyDetail(propertyId: string) {
  const { ownerId } = await requireOwner();
  const property = await ownedProperty(ownerId, propertyId);
  const admin = createAdminClient();

  const [{ data: rate }, { data: rla }, { data: area }, { data: media }, { data: checklist }, { data: details }] =
    await Promise.all([
      admin.from("short_stay_rates").select("*").eq("property_id", propertyId).maybeSingle(),
      admin.from("rla_assessments").select("*").eq("property_id", propertyId).order("id").limit(1),
      admin.from("area_overviews").select("*").eq("property_id", propertyId).limit(1),
      admin.from("property_media").select("*").eq("property_id", propertyId).limit(1),
      admin.from("publish_checklist").select("*").eq("property_id", propertyId).maybeSingle(),
      admin.from("property_details").select("*").eq("property_id", propertyId).limit(1),
    ]);

  return {
    property,
    rate: rate ?? null,
    rla: rla?.[0] ?? null,
    area: area?.[0] ?? null,
    media: media?.[0] ?? null,
    details: details?.[0] ?? null,
    checklist: checklist ?? null,
  };
}

// ── Calendar ────────────────────────────────────────────────────────────────

export async function ownerCalendar(propertyId: string, fromISO: string, toISO: string) {
  const { ownerId } = await requireOwner();
  await ownedProperty(ownerId, propertyId);
  const admin = createAdminClient();

  const [{ data: blocks }, { data: bookings }, { data: rate }] = await Promise.all([
    admin
      .from("availability_blocks")
      .select("id, start_date, end_date, reason, booking_id, created_by_owner")
      .eq("property_id", propertyId)
      .lte("start_date", toISO)
      .gte("end_date", fromISO),
    admin
      .from("bookings")
      .select("id, check_in_date, check_out_date, status")
      .eq("property_id", propertyId)
      .not("status", "in", '("cancelled","expired")')
      .lte("check_in_date", toISO)
      .gte("check_out_date", fromISO),
    admin.from("short_stay_rates").select("buffer_days").eq("property_id", propertyId).maybeSingle(),
  ]);

  return {
    blocks: blocks ?? [],
    bookings: bookings ?? [],
    bufferDays: Number(rate?.buffer_days ?? 0),
  };
}

// ── Bookings ────────────────────────────────────────────────────────────────

export async function ownerBookings() {
  const { ownerId } = await requireOwner();
  const admin = createAdminClient();

  const { data: props } = await admin.from("properties").select("id, name").eq("owner_id", ownerId);
  const ids = (props ?? []).map((p) => p.id as string);
  if (ids.length === 0) return [];
  const nameOf = new Map((props ?? []).map((p) => [p.id as string, p.name as string]));

  const { data } = await admin
    .from("bookings")
    .select(`id, booking_code, property_id, check_in_date, check_out_date, nights, guests,
             status, payment_status, total_price, credit_applied, cleaning_fee,
             commission_pct, cleaning_fee_goes_to,
             user:users ( name, phone_whatsapp )`)
    .in("property_id", ids)
    .order("check_in_date", { ascending: false });

  return (data ?? []).map((b) => {
    const u = b.user as unknown as { name?: string; phone_whatsapp?: string } | null;
    const open = contactWindowOpen(b.status as string, b.check_in_date as string, b.check_out_date as string);

    const gross = n(b.total_price) + n(b.credit_applied);
    const cleaning = Math.min(n(b.cleaning_fee), gross);
    const rent = gross - cleaning;
    const pct = b.commission_pct == null ? null : Number(b.commission_pct);
    const margin = pct == null ? 0 : Math.round((rent * pct) / 100);
    const cleaningToOwner = b.cleaning_fee_goes_to === "owner";

    return {
      id: b.id as string,
      code: b.booking_code as string,
      propertyName: nameOf.get(b.property_id as string) ?? "—",
      checkIn: b.check_in_date as string,
      checkOut: b.check_out_date as string,
      nights: Number(b.nights ?? 0),
      guests: Number(b.guests ?? 0),
      status: b.status as string,
      // First name only, always. Never the surname, never a document, never a
      // payment proof.
      guestFirstName: firstNameOnly(u?.name),
      guestPhone: open ? (u?.phone_whatsapp ?? null) : null,
      contactOpen: open,
      toOwner: rent - margin + (cleaningToOwner ? cleaning : 0),
    };
  });
}

// ── Viewings ────────────────────────────────────────────────────────────────

export async function ownerViewings() {
  const { ownerId } = await requireOwner();
  const admin = createAdminClient();

  const { data: props } = await admin.from("properties").select("id, name").eq("owner_id", ownerId);
  const ids = (props ?? []).map((p) => p.id as string);
  if (ids.length === 0) return [];
  const nameOf = new Map((props ?? []).map((p) => [p.id as string, p.name as string]));

  const { data } = await admin
    .from("viewings")
    // No deposit columns selected at all. What an owner cannot receive, they
    // cannot leak — the deposit is between the guest and VeriHome.
    .select("id, property_id, status, scheduled_at, preferred_dates, user:users ( name )")
    .in("property_id", ids)
    .order("scheduled_at", { ascending: true, nullsFirst: false });

  return (data ?? []).map((v) => {
    const u = v.user as unknown as { name?: string } | null;
    return {
      id: v.id as string,
      propertyName: nameOf.get(v.property_id as string) ?? "—",
      status: v.status as string,
      scheduledAt: (v.scheduled_at as string) ?? null,
      preferred: (v.preferred_dates as { date: string; time: string }[] | null) ?? [],
      prospectFirstName: firstNameOnly(u?.name),
    };
  });
}

// ── Earnings ────────────────────────────────────────────────────────────────

/**
 * Read from the ledger's owner_payable account, never recomputed from
 * bookings. The ledger is the record of what VeriHome owes; a second
 * calculation over bookings would be a second opinion, and the two would
 * eventually disagree with nothing to say which was right.
 */
export async function ownerEarnings() {
  const { ownerId } = await requireOwner();
  const admin = createAdminClient();

  const { data: props } = await admin.from("properties").select("id, name").eq("owner_id", ownerId);
  const propIds = (props ?? []).map((p) => p.id as string);
  const nameOf = new Map((props ?? []).map((p) => [p.id as string, p.name as string]));

  // Entries carry owner_id sometimes and property_id more often, so match on
  // either — scoped to this owner's properties in both cases.
  const q = admin
    .from("ledger_entries")
    .select("id, entry_date, event_type, direction, amount, booking_id, property_id, owner_id, description")
    .eq("account", "owner_payable")
    .order("entry_date", { ascending: false });

  const { data: all } = await q;

  const mine = (all ?? []).filter(
    (e) => e.owner_id === ownerId || propIds.includes(e.property_id as string)
  );

  const earned = mine.filter((e) => e.direction === "credit").reduce((s, e) => s + n(e.amount), 0);
  const paid   = mine.filter((e) => e.direction === "debit").reduce((s, e) => s + n(e.amount), 0);

  const bookingIds = [...new Set(mine.map((e) => e.booking_id).filter(Boolean))] as string[];
  const { data: bookings } = bookingIds.length
    ? await admin
        .from("bookings")
        .select("id, booking_code, property_id, check_in_date, check_out_date, total_price, credit_applied, cleaning_fee, commission_pct, cleaning_fee_goes_to")
        .in("id", bookingIds)
    : { data: [] };

  const perBooking = (bookings ?? []).map((b) => {
    const gross = n(b.total_price) + n(b.credit_applied);
    const cleaning = Math.min(n(b.cleaning_fee), gross);
    const rent = gross - cleaning;
    const pct = b.commission_pct == null ? null : Number(b.commission_pct);
    const commission = pct == null ? 0 : Math.round((rent * pct) / 100);
    const cleaningToOwner = b.cleaning_fee_goes_to === "owner";
    return {
      id: b.id as string,
      code: b.booking_code as string,
      propertyName: nameOf.get(b.property_id as string) ?? "—",
      checkIn: b.check_in_date as string,
      gross,
      commission,
      cleaning,
      cleaningToOwner,
      net: rent - commission + (cleaningToOwner ? cleaning : 0),
    };
  });

  const payouts = mine
    .filter((e) => e.direction === "debit")
    .map((e) => ({
      id: e.id as string,
      date: String(e.entry_date).slice(0, 10),
      amount: n(e.amount),
      reference: (e.description as string) ?? "",
    }));

  return { earned, paid, outstanding: earned - paid, perBooking, payouts };
}

// ── Placements ──────────────────────────────────────────────────────────────

export async function ownerPlacements() {
  const { ownerId } = await requireOwner();
  const admin = createAdminClient();

  const { data: props } = await admin.from("properties").select("id, name").eq("owner_id", ownerId);
  const ids = (props ?? []).map((p) => p.id as string);
  if (ids.length === 0) return [];
  const nameOf = new Map((props ?? []).map((p) => [p.id as string, p.name as string]));

  const { data } = await admin
    .from("placements")
    .select("id, property_id, monthly_rent, commission_pct, commission_amount, status, lease_start_date, reported_by, created_at, notes")
    .in("property_id", ids)
    .order("created_at", { ascending: false });

  return (data ?? []).map((p) => ({
    id: p.id as string,
    propertyName: nameOf.get(p.property_id as string) ?? "—",
    monthlyRent: n(p.monthly_rent),
    commissionPct: Number(p.commission_pct ?? 0),
    commissionAmount: n(p.commission_amount),
    status: p.status as string,
    leaseStart: (p.lease_start_date as string) ?? null,
    reportedBy: (p.reported_by as string) ?? null,
    createdAt: p.created_at as string,
  }));
}

// ── Profile ─────────────────────────────────────────────────────────────────

/** Masks all but the last four digits. The full number is never sent to the browser. */
export function maskAccount(num: string | null | undefined): string {
  const s = String(num ?? "").replace(/\s/g, "");
  if (!s) return "—";
  if (s.length <= 4) return "•".repeat(s.length);
  return "•".repeat(Math.max(4, s.length - 4)) + s.slice(-4);
}

export async function ownerProfile() {
  const { ownerId } = await requireOwner();
  const admin = createAdminClient();

  const [{ data: owner }, { data: pendingPayout }, { data: docs }] = await Promise.all([
    admin
      .from("owners")
      .select("id, name, email, phone_whatsapp, payout_bank, payout_account_number, payout_account_holder, payout_verified_at")
      .eq("id", ownerId)
      .single(),
    admin
      .from("owner_change_requests")
      .select("id, proposed, created_at")
      .eq("owner_id", ownerId)
      .eq("kind", "payout_account")
      .eq("status", "pending")
      .maybeSingle(),
    admin
      .from("owner_documents")
      .select("id, kind, object_key, original_name, uploaded_at")
      .eq("owner_id", ownerId)
      .order("uploaded_at", { ascending: false }),
  ]);

  return {
    owner: {
      name: owner?.name as string,
      email: (owner?.email as string) ?? null,
      phone: (owner?.phone_whatsapp as string) ?? null,
      payoutBank: (owner?.payout_bank as string) ?? null,
      payoutAccountMasked: maskAccount(owner?.payout_account_number as string),
      payoutHolder: (owner?.payout_account_holder as string) ?? null,
      payoutVerifiedAt: (owner?.payout_verified_at as string) ?? null,
    },
    pendingPayoutChange: pendingPayout
      ? {
          id: pendingPayout.id as string,
          bank: (pendingPayout.proposed as Record<string, string>)?.bank ?? "",
          accountMasked: maskAccount((pendingPayout.proposed as Record<string, string>)?.account_number),
          holder: (pendingPayout.proposed as Record<string, string>)?.account_holder ?? "",
          createdAt: pendingPayout.created_at as string,
        }
      : null,
    documents: (docs ?? []).map((d) => ({
      id: d.id as string,
      kind: d.kind as string,
      objectKey: d.object_key as string,
      originalName: (d.original_name as string) ?? "",
      uploadedAt: d.uploaded_at as string,
    })),
  };
}

export { NotFoundError };
