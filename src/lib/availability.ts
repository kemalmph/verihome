import { createAdminClient } from "@/lib/supabase/admin";
import { computePrice } from "@/lib/pricing";

// Re-export types so existing importers don't break
export type { PricingTier, PriceQuote } from "@/lib/pricing";

export interface StayValidation {
  valid:   boolean;
  error?:  string;
}

// ── Helpers ───────────────────────────────────────────────────

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
  const windowStart = toDateString(addDays(checkIn, -bufferDays));
  const windowEnd   = toDateString(checkOut);

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
  if (nights < 1)               return { valid: false, error: "Check-out must be after check-in." };
  if (nights < rate.min_nights) return { valid: false, error: `Minimum stay is ${rate.min_nights} night(s).` };
  if (rate.max_nights && nights > rate.max_nights)
    return { valid: false, error: `Maximum stay is ${rate.max_nights} night(s).` };

  return { valid: true };
}

/** Fetch the active rate row then delegate all computation to computePrice. */
export async function calculatePrice(
  propertyId: string,
  checkIn: Date,
  checkOut: Date
) {
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
  return computePrice(rate, checkIn, checkOut);
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
