import { createAdminClient } from "@/lib/supabase/admin";

// ── Types ─────────────────────────────────────────────────────

export type PricingTier = "per_night" | "weekly" | "monthly";

export interface PriceQuote {
  nights:          number;
  tier:            PricingTier;
  /** Effective per-night average (for display only) */
  effectivePerNight: number;
  cleaningFee:     number;
  securityDeposit: number;
  subtotal:        number;
  /** subtotal + cleaningFee (securityDeposit collected separately) */
  total:           number;
  checkInTime:     string;
  checkOutTime:    string;
  /** Per-night breakdown; only populated in per_night tier */
  breakdown:       { date: string; price: number }[];
}

export interface StayValidation {
  valid:   boolean;
  error?:  string;
}

// ── Helpers ───────────────────────────────────────────────────

function isWeekend(date: Date): boolean {
  const day = date.getUTCDay();
  return day === 0 || day === 6;
}

function dateRange(checkIn: Date, checkOut: Date): Date[] {
  const dates: Date[] = [];
  const cur = new Date(checkIn);
  while (cur < checkOut) {
    dates.push(new Date(cur));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return dates;
}

export function toDateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setUTCDate(r.getUTCDate() + n);
  return r;
}

// ── Public API ────────────────────────────────────────────────

export async function getUnavailableDates(propertyId: string): Promise<string[]> {
  const admin = createAdminClient();
  const [blocksResult, bufferDays] = await Promise.all([
    admin
      .from("availability_blocks")
      .select("start_date, end_date")
      .eq("property_id", propertyId),
    getBufferDays(propertyId),
  ]);

  if (blocksResult.error || !blocksResult.data) return [];

  const blocked = new Set<string>();
  for (const block of blocksResult.data) {
    const cur = new Date(block.start_date + "T00:00:00Z");
    // Extend end by buffer_days so picker disables cleaning gap dates too
    const end = addDays(new Date(block.end_date + "T00:00:00Z"), bufferDays);
    while (cur < end) {
      blocked.add(toDateString(cur));
      cur.setUTCDate(cur.getUTCDate() + 1);
    }
  }
  return Array.from(blocked);
}

export async function isRangeAvailable(
  propertyId: string,
  checkIn: Date,
  checkOut: Date,
  bufferDays = 0
): Promise<boolean> {
  const admin = createAdminClient();
  // One-directional: existing block conflicts if its end_date + buffer > checkIn
  // AND its start_date < checkOut. This only penalises the cleaning gap after
  // an existing checkout — not the days before an existing check-in.
  const windowStart = toDateString(addDays(checkIn, -bufferDays)); // end_date + buffer > checkIn ↔ end_date > checkIn - buffer
  const windowEnd   = toDateString(checkOut);                       // start_date < checkOut (no expansion)

  const { data } = await admin
    .from("availability_blocks")
    .select("id")
    .eq("property_id", propertyId)
    .lt("start_date", windowEnd)
    .gt("end_date",   windowStart)
    .limit(1);

  return !data || data.length === 0;
}

export async function validateStayRules(
  propertyId: string,
  checkIn: Date,
  checkOut: Date
): Promise<StayValidation> {
  const admin = createAdminClient();
  const { data: rate } = await admin
    .from("short_stay_rates")
    .select("min_nights, max_nights, active")
    .eq("property_id", propertyId)
    .eq("active", true)
    .maybeSingle();

  if (!rate) return { valid: false, error: "Property is not available for short stay." };

  const nights = Math.round((checkOut.getTime() - checkIn.getTime()) / 86_400_000);
  if (nights < 1)             return { valid: false, error: "Check-out must be after check-in." };
  if (nights < rate.min_nights) return { valid: false, error: `Minimum stay is ${rate.min_nights} night(s).` };
  if (rate.max_nights && nights > rate.max_nights)
    return { valid: false, error: `Maximum stay is ${rate.max_nights} night(s).` };

  return { valid: true };
}

/**
 * Tier precedence (highest wins):
 *   monthly  — nights >= 28 AND price_per_month is set
 *   weekly   — nights >= 7  AND price_per_week  is set
 *   per_night — per-night sum with optional weekend override
 *
 * Weekend override only applies in the per_night tier.
 * securityDeposit is always added as a separate collected amount (refundable).
 */
export async function calculatePrice(
  propertyId: string,
  checkIn: Date,
  checkOut: Date
): Promise<PriceQuote | null> {
  const admin = createAdminClient();
  const { data: rate } = await admin
    .from("short_stay_rates")
    .select(`
      price_per_night, price_per_night_weekend,
      price_per_week, price_per_month,
      cleaning_fee, security_deposit,
      check_in_time, check_out_time, active
    `)
    .eq("property_id", propertyId)
    .eq("active", true)
    .maybeSingle();

  if (!rate) return null;

  const nightDates  = dateRange(checkIn, checkOut);
  const nightCount  = nightDates.length;
  const cleaningFee = Number(rate.cleaning_fee ?? 0);
  const secDep      = Number(rate.security_deposit ?? 0);
  const checkInTime  = (rate.check_in_time  as string) ?? "14:00";
  const checkOutTime = (rate.check_out_time as string) ?? "12:00";

  // Monthly tier
  if (nightCount >= 28 && rate.price_per_month) {
    const subtotal = (nightCount / 30) * Number(rate.price_per_month);
    return {
      nights: nightCount,
      tier: "monthly",
      effectivePerNight: subtotal / nightCount,
      cleaningFee,
      securityDeposit: secDep,
      subtotal,
      total: subtotal + cleaningFee,
      checkInTime,
      checkOutTime,
      breakdown: [],
    };
  }

  // Weekly tier
  if (nightCount >= 7 && rate.price_per_week) {
    const subtotal = (nightCount / 7) * Number(rate.price_per_week);
    return {
      nights: nightCount,
      tier: "weekly",
      effectivePerNight: subtotal / nightCount,
      cleaningFee,
      securityDeposit: secDep,
      subtotal,
      total: subtotal + cleaningFee,
      checkInTime,
      checkOutTime,
      breakdown: [],
    };
  }

  // Per-night tier with weekend override
  const breakdown = nightDates.map((d) => ({
    date: toDateString(d),
    price:
      isWeekend(d) && rate.price_per_night_weekend
        ? Number(rate.price_per_night_weekend)
        : Number(rate.price_per_night),
  }));

  const subtotal = breakdown.reduce((s, r) => s + r.price, 0);

  return {
    nights: nightCount,
    tier: "per_night",
    effectivePerNight: nightCount > 0 ? subtotal / nightCount : Number(rate.price_per_night),
    cleaningFee,
    securityDeposit: secDep,
    subtotal,
    total: subtotal + cleaningFee,
    checkInTime,
    checkOutTime,
    breakdown,
  };
}

/** Returns buffer_days for a property's short-stay rate (0 if none configured). */
export async function getBufferDays(propertyId: string): Promise<number> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("short_stay_rates")
    .select("buffer_days")
    .eq("property_id", propertyId)
    .maybeSingle();
  return Number((data as { buffer_days?: number } | null)?.buffer_days ?? 0);
}
