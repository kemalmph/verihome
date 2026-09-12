import { createAdminClient } from "@/lib/supabase/admin";

// ── Types ─────────────────────────────────────────────────────

export interface RateInfo {
  pricePerNight: number;
  pricePerNightWeekend: number | null;
  minNights: number;
  maxNights: number | null;
  cleaningFee: number;
}

export interface PriceQuote {
  nights: number;
  pricePerNight: number;
  cleaningFee: number;
  subtotal: number;
  total: number;
  breakdown: { date: string; price: number }[];
}

export interface StayValidation {
  valid: boolean;
  error?: string;
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

// ── Public API ────────────────────────────────────────────────

/**
 * Returns an array of ISO date strings (YYYY-MM-DD) that are blocked
 * for the given property.
 */
export async function getUnavailableDates(propertyId: string): Promise<string[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("availability_blocks")
    .select("start_date, end_date")
    .eq("property_id", propertyId);

  if (error || !data) return [];

  const blocked = new Set<string>();
  for (const block of data) {
    const cur = new Date(block.start_date + "T00:00:00Z");
    const end = new Date(block.end_date   + "T00:00:00Z");
    while (cur < end) {
      blocked.add(toDateString(cur));
      cur.setUTCDate(cur.getUTCDate() + 1);
    }
  }
  return Array.from(blocked);
}

/**
 * Returns true if the requested date range has no availability_blocks overlap.
 */
export async function isRangeAvailable(
  propertyId: string,
  checkIn: Date,
  checkOut: Date
): Promise<boolean> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("availability_blocks")
    .select("id")
    .eq("property_id", propertyId)
    .lt("start_date", toDateString(checkOut))
    .gt("end_date",   toDateString(checkIn))
    .limit(1);

  return !data || data.length === 0;
}

/**
 * Validates that a stay satisfies the property's rate rules.
 */
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
  if (nights < 1) return { valid: false, error: "Check-out must be after check-in." };
  if (nights < rate.min_nights) {
    return { valid: false, error: `Minimum stay is ${rate.min_nights} night(s).` };
  }
  if (rate.max_nights && nights > rate.max_nights) {
    return { valid: false, error: `Maximum stay is ${rate.max_nights} night(s).` };
  }
  return { valid: true };
}

/**
 * Calculates price breakdown for the requested stay.
 * Applies weekend pricing where applicable.
 */
export async function calculatePrice(
  propertyId: string,
  checkIn: Date,
  checkOut: Date
): Promise<PriceQuote | null> {
  const admin = createAdminClient();
  const { data: rate } = await admin
    .from("short_stay_rates")
    .select("price_per_night, price_per_night_weekend, cleaning_fee, active")
    .eq("property_id", propertyId)
    .eq("active", true)
    .maybeSingle();

  if (!rate) return null;

  const nights = dateRange(checkIn, checkOut);
  const breakdown = nights.map((d) => ({
    date: toDateString(d),
    price:
      isWeekend(d) && rate.price_per_night_weekend
        ? Number(rate.price_per_night_weekend)
        : Number(rate.price_per_night),
  }));

  const subtotal    = breakdown.reduce((s, r) => s + r.price, 0);
  const cleaningFee = Number(rate.cleaning_fee);
  const total       = subtotal + cleaningFee;

  return {
    nights: nights.length,
    pricePerNight: Number(rate.price_per_night),
    cleaningFee,
    subtotal,
    total,
    breakdown,
  };
}
