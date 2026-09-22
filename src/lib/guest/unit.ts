import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NotFoundError } from "@/lib/auth/guards";
import { contactWindowOpen } from "@/lib/owner/queries";

/**
 * Guest-scoped reads for the unit pages.
 *
 * Same rule as the owner portal: the session is resolved here, and every query
 * filters by record id AND user id together. A guest asking for another guest's
 * booking gets not-found, which is the same answer as a booking that does not
 * exist — anything else would confirm that a particular id is somebody's.
 */

const n = (v: unknown) => Math.round(Number(v ?? 0));

async function sessionUserId(): Promise<string> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new NotFoundError("You need to be signed in.");
  return user.id;
}

export interface RefundPosition {
  /** What the guest gets back if they cancel right now. */
  amountNow: number;
  label: string;
  /** When that figure next changes, and to what. */
  nextChangeAt: string | null;
  nextAmount: number | null;
}

/**
 * The refund the guest would receive if they cancelled at this moment.
 *
 * Deliberately shown as a live figure with its expiry date, rather than a
 * paragraph of policy. A guest deciding whether to cancel wants the number and
 * the deadline; the policy text is what they cannot act on.
 */
export function refundPosition(
  checkIn: string,
  stayPaid: number,
  deposit: number,
  now = new Date()
): RefundPosition {
  const checkInTs = new Date(`${checkIn}T00:00:00+07:00`).getTime();
  const sevenDays = checkInTs - 7 * 86_400_000;
  const oneDay = checkInTs - 86_400_000;
  const t = now.getTime();

  // The deposit is the guest's own money and comes back on any cancellation
  // before check-in; only the stay portion is subject to the schedule.
  if (t < sevenDays) {
    return {
      amountNow: stayPaid + deposit,
      label: "Pengembalian penuh",
      nextChangeAt: new Date(sevenDays).toISOString(),
      nextAmount: Math.round(stayPaid * 0.5) + deposit,
    };
  }
  if (t < oneDay) {
    return {
      amountNow: Math.round(stayPaid * 0.5) + deposit,
      label: "Pengembalian 50%",
      nextChangeAt: new Date(oneDay).toISOString(),
      nextAmount: deposit,
    };
  }
  return {
    amountNow: deposit,
    label: "Hanya jaminan yang dikembalikan",
    nextChangeAt: null,
    nextAmount: null,
  };
}

// ── One stay ────────────────────────────────────────────────────────────────

export async function guestUnit(bookingId: string) {
  const userId = await sessionUserId();
  const admin = createAdminClient();

  // Filtered by booking id AND user id in one query.
  const { data: booking } = await admin
    .from("bookings")
    .select(`id, booking_code, property_id, user_id, check_in_date, check_out_date,
             nights, guests, status, payment_status, total_price, credit_applied,
             security_deposit, created_at`)
    .eq("id", bookingId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!booking) throw new NotFoundError();

  const propertyId = booking.property_id as string;

  const [{ data: property }, { data: rate }, { data: rla }, { data: area }, { data: media }, { data: details }, { data: owner }] =
    await Promise.all([
      admin.from("properties")
        .select("id, name, slug, area, address, google_maps_url, owner_id, status")
        .eq("id", propertyId).maybeSingle(),
      admin.from("short_stay_rates")
        .select("check_in_time, check_out_time, cleaning_fee").eq("property_id", propertyId).maybeSingle(),
      admin.from("rla_assessments").select("*").eq("property_id", propertyId).limit(1),
      admin.from("area_overviews").select("*").eq("property_id", propertyId).limit(1),
      admin.from("property_media").select("*").eq("property_id", propertyId).limit(1),
      admin.from("property_details").select("*").eq("property_id", propertyId).limit(1),
      admin.from("owners").select("name, phone_whatsapp").eq("id",
        (await admin.from("properties").select("owner_id").eq("id", propertyId).maybeSingle()).data?.owner_id ?? ""
      ).maybeSingle(),
    ]);

  const confirmed = booking.status === "confirmed" || booking.status === "completed";
  const contactOpen = contactWindowOpen(
    booking.status as string, booking.check_in_date as string, booking.check_out_date as string
  );

  const stayPaid = n(booking.total_price);
  const deposit = n(booking.security_deposit);

  const photos = [
    ...((media?.[0]?.photos_exterior as string[]) ?? []),
    ...((media?.[0]?.photos_unit as string[]) ?? []),
    ...((media?.[0]?.photos_common_area as string[]) ?? []),
  ];

  return {
    booking: {
      id: booking.id as string,
      code: booking.booking_code as string,
      checkIn: booking.check_in_date as string,
      checkOut: booking.check_out_date as string,
      nights: Number(booking.nights ?? 0),
      guests: Number(booking.guests ?? 0),
      status: booking.status as string,
      paymentStatus: booking.payment_status as string,
      stayPaid,
      creditApplied: n(booking.credit_applied),
      deposit,
    },
    property: {
      name: (property?.name as string) ?? "—",
      slug: (property?.slug as string) ?? null,
      area: (property?.area as string) ?? null,
      // The full street address is held back until the booking is confirmed.
      // Before that the guest has the area, which is enough to plan and not
      // enough to arrange around the platform.
      address: confirmed ? ((property?.address as string) ?? null) : null,
      mapUrl: (property?.google_maps_url as string) ?? null,
      photos,
      videoUrl: (media?.[0]?.video_url as string) ?? null,
    },
    times: {
      checkIn: (rate?.check_in_time as string) ?? "14:00",
      checkOut: (rate?.check_out_time as string) ?? "12:00",
    },
    rules: (details?.[0]?.rules as string) ?? null,
    facilities: (details?.[0]?.facilities as string[]) ?? [],
    includedUtilities: (details?.[0]?.included_utilities as string[]) ?? [],
    area: area?.[0] ?? null,
    rla: rla?.[0] ?? null,
    // Owner contact appears only inside the same 48-hour window in which the
    // owner can see the guest's. The symmetry is deliberate.
    ownerContact: contactOpen
      ? { name: (owner?.name as string) ?? null, phone: (owner?.phone_whatsapp as string) ?? null }
      : null,
    contactOpen,
    confirmed,
    refund: refundPosition(booking.check_in_date as string, stayPaid, deposit),
  };
}

// ── Landing: current / next / most recent stay ──────────────────────────────

export async function guestUnitOverview() {
  const userId = await sessionUserId();
  const admin = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data: bookings } = await admin
    .from("bookings")
    .select(`id, booking_code, property_id, check_in_date, check_out_date, status,
             property:properties ( name, area, slug )`)
    .eq("user_id", userId)
    .not("status", "in", '("cancelled","expired")')
    .order("check_in_date", { ascending: true });

  const rows = (bookings ?? []).map((b) => ({
    id: b.id as string,
    code: b.booking_code as string,
    checkIn: b.check_in_date as string,
    checkOut: b.check_out_date as string,
    status: b.status as string,
    propertyName: (b.property as unknown as { name?: string } | null)?.name ?? "—",
    propertyArea: (b.property as unknown as { area?: string } | null)?.area ?? null,
  }));

  const current = rows.find((b) => b.checkIn <= today && b.checkOut >= today) ?? null;
  const next = rows.find((b) => b.checkIn > today) ?? null;
  const past = [...rows].reverse().find((b) => b.checkOut < today) ?? null;

  // A long-term placement keeps the relationship going after the deal closes,
  // and this is where the tenant comes back for the property information.
  const { data: placement } = await admin
    .from("placements")
    .select(`id, monthly_rent, lease_start_date, status,
             property:properties ( name, area, address, slug )`)
    .eq("user_id", userId)
    .in("status", ["reported", "invoiced", "paid"])
    .order("lease_start_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  return {
    current, next, past,
    tenancy: placement
      ? {
          id: placement.id as string,
          monthlyRent: n(placement.monthly_rent),
          leaseStart: (placement.lease_start_date as string) ?? null,
          propertyName: (placement.property as unknown as { name?: string } | null)?.name ?? "—",
          propertyArea: (placement.property as unknown as { area?: string } | null)?.area ?? null,
          propertyAddress: (placement.property as unknown as { address?: string } | null)?.address ?? null,
        }
      : null,
  };
}

// ── Saved units ─────────────────────────────────────────────────────────────

export async function guestSavedUnits() {
  const userId = await sessionUserId();
  const admin = createAdminClient();

  const { data: saved } = await admin
    .from("saved_listings")
    .select("id, property_id, saved_price, saved_at")
    .eq("user_id", userId)
    .order("saved_at", { ascending: false });

  const ids = (saved ?? []).map((s) => s.property_id as string).filter(Boolean);
  if (ids.length === 0) return [];

  const [{ data: props }, { data: rates }, { data: blocks }] = await Promise.all([
    admin.from("properties").select("id, name, area, slug, status, price_monthly, rental_mode").in("id", ids),
    admin.from("short_stay_rates").select("property_id, price_per_night").in("property_id", ids),
    admin.from("availability_blocks").select("property_id, end_date").in("property_id", ids)
      .gte("end_date", new Date().toISOString().slice(0, 10)),
  ]);

  const propById = new Map((props ?? []).map((p) => [p.id as string, p]));
  const nightly = new Map((rates ?? []).map((r) => [r.property_id as string, Number(r.price_per_night ?? 0)]));

  // Next free date for a short-stay unit: the day after the last current block.
  const nextFree = new Map<string, string>();
  for (const b of blocks ?? []) {
    const pid = b.property_id as string;
    const end = b.end_date as string;
    if (!nextFree.has(pid) || end > nextFree.get(pid)!) nextFree.set(pid, end);
  }

  return (saved ?? []).flatMap((s) => {
    const p = propById.get(s.property_id as string);
    if (!p) return [];
    const isShortStay = ["short_stay", "both"].includes((p.rental_mode as string) ?? "");
    const currentPrice = isShortStay
      ? (nightly.get(p.id as string) ?? 0)
      : n(p.price_monthly);
    const savedPrice = n(s.saved_price);

    return [{
      id: s.id as string,
      propertyId: p.id as string,
      name: p.name as string,
      area: (p.area as string) ?? null,
      slug: (p.slug as string) ?? null,
      isLive: p.status === "live",
      isShortStay,
      currentPrice,
      savedPrice,
      delta: savedPrice > 0 ? currentPrice - savedPrice : 0,
      savedAt: s.saved_at as string,
      nextAvailable: isShortStay ? (nextFree.get(p.id as string) ?? null) : null,
    }];
  });
}

export { NotFoundError };
