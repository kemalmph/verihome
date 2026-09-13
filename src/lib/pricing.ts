// Pure pricing computation — no Supabase, no async, safe to import from client components.

export type PricingTier = "per_night" | "weekly" | "monthly";

export interface PriceQuote {
  nights:            number;
  tier:              PricingTier;
  /** Blended per-night average for display */
  effectivePerNight: number;
  cleaningFee:       number;
  securityDeposit:   number;
  subtotal:          number;
  /** subtotal + cleaningFee (securityDeposit collected separately) */
  total:             number;
  checkInTime:       string;
  checkOutTime:      string;
  /** Per-night breakdown; only populated in the per_night tier */
  breakdown:         { date: string; price: number }[];
}

export interface RateInput {
  price_per_night:         number | string | null;
  price_per_night_weekend?: number | string | null;
  price_per_week?:          number | string | null;
  price_per_month?:         number | string | null;
  cleaning_fee?:            number | string | null;
  security_deposit?:        number | string | null;
  check_in_time?:           string | null;
  check_out_time?:          string | null;
}

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

function toDateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function n(v: number | string | null | undefined): number {
  return Number(v ?? 0);
}

/**
 * Pure tier-selection and fee computation.
 *
 * Tier precedence (highest wins):
 *   monthly  — nights >= 28 AND price_per_month is set
 *   weekly   — nights >= 7  AND price_per_week  is set
 *   per_night — per-night sum with optional weekend override
 *
 * Weekend override only applies in the per_night tier.
 * Returns null when price_per_night is absent (rate not configured).
 */
export function computePrice(
  rate: RateInput,
  checkIn: Date,
  checkOut: Date
): PriceQuote | null {
  const pn  = n(rate.price_per_night);
  if (!pn) return null;

  const pnw        = n(rate.price_per_night_weekend) || pn;
  const pw         = n(rate.price_per_week);
  const pm         = n(rate.price_per_month);
  const cleaningFee    = n(rate.cleaning_fee);
  const securityDeposit = n(rate.security_deposit);
  const checkInTime    = rate.check_in_time  ?? "14:00";
  const checkOutTime   = rate.check_out_time ?? "12:00";

  const nightDates = dateRange(checkIn, checkOut);
  const nights     = nightDates.length;

  if (nights >= 28 && pm) {
    const subtotal = Math.round((nights / 30) * pm);
    const total    = Math.round(subtotal + cleaningFee);
    return {
      nights, tier: "monthly",
      effectivePerNight: Math.round(subtotal / nights),
      cleaningFee, securityDeposit,
      subtotal, total,
      checkInTime, checkOutTime,
      breakdown: [],
    };
  }

  if (nights >= 7 && pw) {
    const subtotal = Math.round((nights / 7) * pw);
    const total    = Math.round(subtotal + cleaningFee);
    return {
      nights, tier: "weekly",
      effectivePerNight: Math.round(subtotal / nights),
      cleaningFee, securityDeposit,
      subtotal, total,
      checkInTime, checkOutTime,
      breakdown: [],
    };
  }

  const breakdown = nightDates.map((d) => ({
    date: toDateString(d),
    price: isWeekend(d) && rate.price_per_night_weekend ? pnw : pn,
  }));
  const subtotal = Math.round(breakdown.reduce((s, r) => s + r.price, 0));
  const total    = Math.round(subtotal + cleaningFee);

  return {
    nights, tier: "per_night",
    effectivePerNight: nights > 0 ? Math.round(subtotal / nights) : pn,
    cleaningFee, securityDeposit,
    subtotal, total,
    checkInTime, checkOutTime,
    breakdown,
  };
}
