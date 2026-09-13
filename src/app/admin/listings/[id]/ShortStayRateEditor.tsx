"use client";

import { useState, useTransition, useMemo } from "react";

export interface ShortStayRateData {
  price_per_night:         number | null;
  price_per_night_weekend: number | null;
  price_per_week:          number | null;
  price_per_month:         number | null;
  min_nights:              number | null;
  max_nights:              number | null;
  cleaning_fee:            number | null;
  security_deposit:        number | null;
  check_in_time:           string;
  check_out_time:          string;
  buffer_days:             number;
  active:                  boolean;
}

interface Props {
  propertyId:       string;
  /** Current value of the Rental Mode dropdown (may not yet be saved) */
  rentalMode:       string;
  /** The value that is actually persisted in the DB */
  savedRentalMode:  string;
  initialRate:      ShortStayRateData | null;
}

const input = "w-full h-11 px-4 rounded-lg border border-[#cccccc] focus:border-[#1a7a5e] focus:outline-none focus:ring-2 focus:ring-[#9cf4d1]/40 text-sm bg-white disabled:bg-[#f6f3f2] disabled:text-[#aaa] disabled:cursor-not-allowed";
const labelCls = "text-xs font-semibold text-[#3e4944] uppercase tracking-wider block mb-1";

function isShortStayMode(mode: string) {
  return mode === "short_stay" || mode === "both";
}

function fmt(n: number) {
  return n.toLocaleString("id-ID");
}

// ── Pricing preview ───────────────────────────────────────────

type PricingTier = "per_night" | "weekly" | "monthly";

function calcPreview(
  rate: ShortStayRateData,
  nights: number,
  weekendNights: number
): { tier: PricingTier; subtotal: number; total: number } | null {
  const pn  = Number(rate.price_per_night  ?? 0);
  const pw  = Number(rate.price_per_week   ?? 0);
  const pm  = Number(rate.price_per_month  ?? 0);
  const pnw = Number(rate.price_per_night_weekend ?? pn);
  const cf  = Number(rate.cleaning_fee ?? 0);
  if (!pn) return null;

  if (nights >= 28 && pm) {
    const subtotal = (nights / 30) * pm;
    return { tier: "monthly", subtotal, total: subtotal + cf };
  }
  if (nights >= 7 && pw) {
    const subtotal = (nights / 7) * pw;
    return { tier: "weekly", subtotal, total: subtotal + cf };
  }
  const weekdayNights = nights - weekendNights;
  const subtotal = weekdayNights * pn + weekendNights * pnw;
  return { tier: "per_night", subtotal, total: subtotal + cf };
}

const PREVIEW_SCENARIOS: { label: string; nights: number; weekendNights: number }[] = [
  { label: "3 nights, weekdays only",      nights: 3,  weekendNights: 0 },
  { label: "3 nights incl. weekend",       nights: 3,  weekendNights: 2 },
  { label: "10 nights",                    nights: 10, weekendNights: 2 },
  { label: "30 nights",                    nights: 30, weekendNights: 8 },
];

const tierLabel: Record<PricingTier, string> = {
  per_night: "per night",
  weekly:    "weekly rate",
  monthly:   "monthly rate",
};

function PricingPreview({ rate }: { rate: ShortStayRateData }) {
  const rows = useMemo(
    () => PREVIEW_SCENARIOS.map((s) => ({ ...s, result: calcPreview(rate, s.nights, s.weekendNights) })),
    [rate]
  );

  if (!rate.price_per_night) return null;

  return (
    <div className="border border-[#e4e2e1] rounded-lg overflow-hidden text-sm">
      <div className="bg-[#f6f3f2] px-4 py-2 text-xs font-semibold text-[#3e4944] uppercase tracking-wider">
        Live pricing preview
      </div>
      <table className="w-full">
        <thead>
          <tr className="text-xs text-[#6e7a74] border-b border-[#e4e2e1]">
            <th className="text-left px-4 py-2 font-medium">Scenario</th>
            <th className="text-left px-4 py-2 font-medium">Tier</th>
            <th className="text-right px-4 py-2 font-medium">Total (incl. cleaning)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-b border-[#f6f3f2] last:border-0">
              <td className="px-4 py-2.5 text-[#3e4944]">{row.label}</td>
              <td className="px-4 py-2.5">
                {row.result ? (
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    row.result.tier === "monthly" ? "bg-purple-100 text-purple-700" :
                    row.result.tier === "weekly"  ? "bg-blue-100 text-blue-700" :
                    "bg-[#e8f5f0] text-[#1a7a5e]"
                  }`}>
                    {tierLabel[row.result.tier]}
                  </span>
                ) : "—"}
              </td>
              <td className="px-4 py-2.5 text-right font-semibold text-[#0d2137]">
                {row.result ? `IDR ${fmt(Math.round(row.result.total))}` : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Inline warnings ───────────────────────────────────────────

function Warn({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-1.5 text-amber-700 text-xs mt-1.5">
      <span className="material-symbols-outlined text-amber-500" style={{ fontSize: 14, lineHeight: "1.1" }}>warning</span>
      {children}
    </p>
  );
}

function useWarnings(rate: ShortStayRateData) {
  return useMemo(() => {
    const warns: Record<string, string> = {};

    const max = rate.max_nights;
    const min = rate.min_nights;

    if (max !== null && max < 28 && rate.price_per_month)
      warns.monthly = "Monthly rate will never apply — max stay is under 28 nights.";

    if (max !== null && max < 7 && rate.price_per_week)
      warns.weekly = "Weekly rate will never apply — max stay is under 7 nights.";

    if (min !== null && max !== null && min > max)
      warns.minmax = "Minimum stay is longer than maximum stay.";

    if (rate.price_per_night_weekend && (rate.price_per_week || rate.price_per_month))
      warns.weekend = "Weekend rate applies only to stays under 7 nights. Weekly and monthly rates are flat totals.";

    if (rate.buffer_days > 0)
      warns.buffer = `Blocks ${rate.buffer_days} day${rate.buffer_days > 1 ? "s" : ""} after each checkout. Applies to new bookings only.`;

    return warns;
  }, [rate]);
}

// ── Main component ────────────────────────────────────────────

export function ShortStayRateEditor({ propertyId, rentalMode, savedRentalMode, initialRate }: Props) {
  const isEditable  = isShortStayMode(savedRentalMode);
  const pendingSave = !isEditable && isShortStayMode(rentalMode);

  const [rate, setRate] = useState<ShortStayRateData>({
    price_per_night:         initialRate?.price_per_night         ?? null,
    price_per_night_weekend: initialRate?.price_per_night_weekend ?? null,
    price_per_week:          (initialRate as ShortStayRateData | null)?.price_per_week  ?? null,
    price_per_month:         (initialRate as ShortStayRateData | null)?.price_per_month ?? null,
    min_nights:              initialRate?.min_nights              ?? 1,
    max_nights:              initialRate?.max_nights              ?? null,
    cleaning_fee:            initialRate?.cleaning_fee            ?? 0,
    security_deposit:        (initialRate as ShortStayRateData | null)?.security_deposit ?? 0,
    check_in_time:           (initialRate as ShortStayRateData | null)?.check_in_time   ?? "14:00",
    check_out_time:          (initialRate as ShortStayRateData | null)?.check_out_time  ?? "12:00",
    buffer_days:             (initialRate as ShortStayRateData | null)?.buffer_days     ?? 0,
    active:                  initialRate?.active                  ?? true,
  });

  const [isPending, startTransition] = useTransition();
  const [saved,  setSaved]  = useState(false);
  const [error,  setError]  = useState("");

  const warnings = useWarnings(rate);

  function field(key: keyof ShortStayRateData, value: string | number | boolean | null) {
    setSaved(false);
    setRate((prev) => ({ ...prev, [key]: value }));
  }

  function handleToggleActive() {
    if (!isEditable) return;
    field("active", !rate.active);
  }

  function handleSave() {
    if (!isEditable) return;
    if (!rate.price_per_night) { setError("Nightly rate is required."); return; }
    setError("");
    startTransition(async () => {
      const res = await fetch("/api/admin/short-stay-rates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ propertyId, ...rate }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? "Save failed");
        return;
      }
      setSaved(true);
    });
  }

  return (
    <div className="bg-white rounded-xl border border-[#cccccc] shadow-sm p-6 space-y-5">
      {/* Header */}
      <div className="flex items-start gap-3 pb-2 border-b border-[#e4e2e1]">
        <span className="material-symbols-outlined text-[#1a7a5e] text-xl mt-0.5">nights_stay</span>
        <div className="flex-1">
          <h3 className="font-semibold text-[#0d2137]">Short-stay Rates</h3>
          <p className="text-xs text-[#6e7a74] mt-0.5">Nightly pricing and stay rules</p>
        </div>

        {isEditable && (
          <div className="flex flex-col items-end gap-1">
            <button
              type="button"
              onClick={handleToggleActive}
              className="flex items-center gap-2 text-sm"
              title={rate.active
                ? "Deactivating stops new bookings. Confirmed future bookings are not affected."
                : "Activate to allow new short-stay bookings"}
            >
              <span className="text-[#3e4944]">Active</span>
              <div className={`w-10 h-5 rounded-full relative transition-colors ${rate.active ? "bg-[#1a7a5e]" : "bg-[#cccccc]"}`}>
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${rate.active ? "translate-x-5" : ""}`} />
              </div>
            </button>
            {!rate.active && initialRate?.active && (
              <p className="text-[10px] text-[#6e7a74] text-right max-w-[180px]">
                Stops new bookings only. Confirmed future bookings are unaffected.
              </p>
            )}
          </div>
        )}
      </div>

      {/* State notices */}
      {pendingSave && (
        <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-800">
          <span className="material-symbols-outlined text-blue-500 text-base">info</span>
          Rental Mode has been changed but not saved yet.
          <strong className="ml-1">Save as Draft</strong> above first, then return here to set rates.
        </div>
      )}

      {!isEditable && !pendingSave && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
          <span className="material-symbols-outlined text-amber-500 text-base">lock</span>
          Short-stay rates are only editable when <strong className="mx-1">Rental Mode</strong> is
          set to <strong className="mx-1">&quot;Short stay only&quot;</strong> or <strong className="mx-1">&quot;Both&quot;</strong> and saved.
        </div>
      )}

      {/* Fields */}
      <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 ${!isEditable ? "opacity-50 pointer-events-none select-none" : ""}`}>
        <div>
          <label className={labelCls}>Nightly Rate (IDR) *</label>
          <input
            type="number" min={0} disabled={!isEditable}
            value={rate.price_per_night ?? ""}
            onChange={(e) => field("price_per_night", e.target.value ? Number(e.target.value) : null)}
            placeholder="500000" className={input}
          />
        </div>
        <div>
          <label className={labelCls}>Weekend Rate (IDR) <span className="font-normal normal-case text-[#aaa]">optional</span></label>
          <input
            type="number" min={0} disabled={!isEditable}
            value={rate.price_per_night_weekend ?? ""}
            onChange={(e) => field("price_per_night_weekend", e.target.value ? Number(e.target.value) : null)}
            placeholder="Same as weekday" className={input}
          />
          {warnings.weekend && <Warn>{warnings.weekend}</Warn>}
        </div>
        <div>
          <label className={labelCls}>Weekly Rate (IDR) <span className="font-normal normal-case text-[#aaa]">optional</span></label>
          <input
            type="number" min={0} disabled={!isEditable}
            value={rate.price_per_week ?? ""}
            onChange={(e) => field("price_per_week", e.target.value ? Number(e.target.value) : null)}
            placeholder="e.g. 2800000 (≥7 nights)" className={input}
          />
          {warnings.weekly && <Warn>{warnings.weekly}</Warn>}
        </div>
        <div>
          <label className={labelCls}>Monthly Rate (IDR) <span className="font-normal normal-case text-[#aaa]">optional</span></label>
          <input
            type="number" min={0} disabled={!isEditable}
            value={rate.price_per_month ?? ""}
            onChange={(e) => field("price_per_month", e.target.value ? Number(e.target.value) : null)}
            placeholder="e.g. 9000000 (≥28 nights)" className={input}
          />
          {warnings.monthly && <Warn>{warnings.monthly}</Warn>}
        </div>
        <div>
          <label className={labelCls}>Cleaning Fee (IDR)</label>
          <input
            type="number" min={0} disabled={!isEditable}
            value={rate.cleaning_fee ?? ""}
            onChange={(e) => field("cleaning_fee", e.target.value ? Number(e.target.value) : 0)}
            placeholder="0" className={input}
          />
        </div>
        <div>
          <label className={labelCls}>Security Deposit (IDR) <span className="font-normal normal-case text-[#aaa]">refundable</span></label>
          <input
            type="number" min={0} disabled={!isEditable}
            value={rate.security_deposit ?? ""}
            onChange={(e) => field("security_deposit", e.target.value ? Number(e.target.value) : 0)}
            placeholder="0" className={input}
          />
        </div>
        <div>
          <label className={labelCls}>Check-in Time</label>
          <input
            type="time" disabled={!isEditable}
            value={rate.check_in_time}
            onChange={(e) => field("check_in_time", e.target.value || "14:00")}
            className={input}
          />
        </div>
        <div>
          <label className={labelCls}>Check-out Time</label>
          <input
            type="time" disabled={!isEditable}
            value={rate.check_out_time}
            onChange={(e) => field("check_out_time", e.target.value || "12:00")}
            className={input}
          />
        </div>
        <div>
          <label className={labelCls}>Buffer Days <span className="font-normal normal-case text-[#aaa]">cleaning gap</span></label>
          <input
            type="number" min={0} max={7} disabled={!isEditable}
            value={rate.buffer_days}
            onChange={(e) => field("buffer_days", Number(e.target.value) || 0)}
            placeholder="0" className={input}
          />
          {warnings.buffer && <Warn>{warnings.buffer}</Warn>}
        </div>
        <div className="md:col-span-1" />
        <div>
          <label className={labelCls}>Min Nights</label>
          <input
            type="number" min={1} disabled={!isEditable}
            value={rate.min_nights ?? ""}
            onChange={(e) => field("min_nights", e.target.value ? Number(e.target.value) : 1)}
            className={input}
          />
        </div>
        <div>
          <label className={labelCls}>Max Nights <span className="font-normal normal-case text-[#aaa]">optional</span></label>
          <input
            type="number" min={1} disabled={!isEditable}
            value={rate.max_nights ?? ""}
            onChange={(e) => field("max_nights", e.target.value ? Number(e.target.value) : null)}
            placeholder="No limit" className={input}
          />
          {warnings.minmax && <Warn>{warnings.minmax}</Warn>}
        </div>
      </div>

      {/* Live pricing preview */}
      {isEditable && <PricingPreview rate={rate} />}

      {error && <p className="text-sm text-red-600">{error}</p>}

      {saved && (
        <div className="flex items-center gap-2 text-sm text-[#1a7a5e] font-medium">
          <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
          Rate saved. Checklist updated.
        </div>
      )}

      <button
        type="button"
        disabled={!isEditable || isPending}
        onClick={handleSave}
        className="px-6 py-2.5 bg-[#1a7a5e] text-white rounded-lg font-semibold text-sm hover:opacity-90 disabled:opacity-40 flex items-center gap-2"
      >
        {isPending ? (
          <><span className="material-symbols-outlined animate-spin text-sm">progress_activity</span> Saving…</>
        ) : (
          <><span className="material-symbols-outlined text-sm">save</span> Save Rate</>
        )}
      </button>
    </div>
  );
}
