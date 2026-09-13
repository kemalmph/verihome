"use client";

import { useState, useTransition } from "react";

export interface ShortStayRateData {
  price_per_night:         number | null;
  price_per_night_weekend: number | null;
  min_nights:              number | null;
  max_nights:              number | null;
  cleaning_fee:            number | null;
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

export function ShortStayRateEditor({ propertyId, rentalMode, savedRentalMode, initialRate }: Props) {
  // Editing is only allowed when the DB mode is short_stay/both (mode is persisted)
  const isEditable     = isShortStayMode(savedRentalMode);
  // Dropdown points to short_stay/both but hasn't been saved yet
  const pendingSave    = !isEditable && isShortStayMode(rentalMode);

  const [rate, setRate] = useState<ShortStayRateData>({
    price_per_night:         initialRate?.price_per_night         ?? null,
    price_per_night_weekend: initialRate?.price_per_night_weekend ?? null,
    min_nights:              initialRate?.min_nights              ?? 1,
    max_nights:              initialRate?.max_nights              ?? null,
    cleaning_fee:            initialRate?.cleaning_fee            ?? 0,
    active:                  initialRate?.active                  ?? true,
  });

  const [isPending, startTransition] = useTransition();
  const [saved,  setSaved]  = useState(false);
  const [error,  setError]  = useState("");

  function field(key: keyof ShortStayRateData, value: number | boolean | null) {
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

        {/* Active toggle — only shown when editable */}
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
            {/* Deactivation note */}
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
            type="number"
            min={0}
            disabled={!isEditable}
            value={rate.price_per_night ?? ""}
            onChange={(e) => field("price_per_night", e.target.value ? Number(e.target.value) : null)}
            placeholder="500000"
            className={input}
          />
        </div>
        <div>
          <label className={labelCls}>Weekend Rate (IDR) <span className="font-normal normal-case text-[#aaa]">optional</span></label>
          <input
            type="number"
            min={0}
            disabled={!isEditable}
            value={rate.price_per_night_weekend ?? ""}
            onChange={(e) => field("price_per_night_weekend", e.target.value ? Number(e.target.value) : null)}
            placeholder="Same as weekday"
            className={input}
          />
        </div>
        <div>
          <label className={labelCls}>Cleaning Fee (IDR)</label>
          <input
            type="number"
            min={0}
            disabled={!isEditable}
            value={rate.cleaning_fee ?? ""}
            onChange={(e) => field("cleaning_fee", e.target.value ? Number(e.target.value) : 0)}
            placeholder="0"
            className={input}
          />
        </div>
        <div className="md:col-span-1" />
        <div>
          <label className={labelCls}>Min Nights</label>
          <input
            type="number"
            min={1}
            disabled={!isEditable}
            value={rate.min_nights ?? ""}
            onChange={(e) => field("min_nights", e.target.value ? Number(e.target.value) : 1)}
            className={input}
          />
        </div>
        <div>
          <label className={labelCls}>Max Nights <span className="font-normal normal-case text-[#aaa]">optional</span></label>
          <input
            type="number"
            min={1}
            disabled={!isEditable}
            value={rate.max_nights ?? ""}
            onChange={(e) => field("max_nights", e.target.value ? Number(e.target.value) : null)}
            placeholder="No limit"
            className={input}
          />
        </div>
      </div>

      {/* Summary */}
      {isEditable && rate.price_per_night && (
        <div className="bg-[#f6f3f2] rounded-lg px-4 py-3 text-sm text-[#3e4944] flex flex-wrap gap-4">
          <span>IDR {Number(rate.price_per_night).toLocaleString("id-ID")}/night</span>
          {rate.price_per_night_weekend && (
            <span>Weekend: IDR {Number(rate.price_per_night_weekend).toLocaleString("id-ID")}</span>
          )}
          {Number(rate.cleaning_fee) > 0 && (
            <span>+ IDR {Number(rate.cleaning_fee).toLocaleString("id-ID")} cleaning</span>
          )}
          <span>Min {rate.min_nights ?? 1}n{rate.max_nights ? ` · Max ${rate.max_nights}n` : ""}</span>
        </div>
      )}

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
