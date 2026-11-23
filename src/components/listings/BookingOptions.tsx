"use client";

import { useState } from "react";
import Link from "next/link";
import type { ShortStayRateRow } from "@/lib/supabase/queries";
import type { RentalMode } from "@/types/property";
import { useT } from "@/lib/i18n/LocaleProvider";

interface BookingOptionsProps {
  propertyId:        string;
  slug:              string;
  rentalMode:        RentalMode;
  priceMonthly:      number;
  minStayMonths:     number;
  isInstantBookable: boolean;
  shortStayRate:     ShortStayRateRow | null;
}

function formatIDR(n: number) {
  return new Intl.NumberFormat("id-ID").format(n);
}

export function BookingOptions({
  propertyId,
  slug,
  rentalMode,
  priceMonthly,
  minStayMonths,
  isInstantBookable,
  shortStayRate,
}: BookingOptionsProps) {
  const t = useT();
  const [tab, setTab] = useState<"long_term" | "short_stay">(
    rentalMode === "short_stay" ? "short_stay" : "long_term"
  );

  const showTabs = rentalMode === "both";

  return (
    <div className="bg-white border border-[#cccccc] rounded-xl p-6 shadow-sm">
      {/* Tab switcher — only shown when mode is "both" */}
      {showTabs && (
        <div className="flex rounded-lg overflow-hidden border border-[#cccccc] mb-5 text-sm font-semibold">
          {(["long_term", "short_stay"] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setTab(mode)}
              className={`flex-1 py-2 transition-colors ${
                tab === mode
                  ? "bg-[#1a7a5e] text-white"
                  : "bg-white text-[#3e4944] hover:bg-[#f6f3f2]"
              }`}
            >
              {mode === "long_term" ? t("book.longTerm") : t("book.shortStay")}
            </button>
          ))}
        </div>
      )}

      {/* Long-term panel */}
      {(tab === "long_term" || rentalMode === "long_term") && (
        <div className="space-y-4">
          <div>
            <div className="text-xs text-[#3e4944] mb-1">{t("book.startingFrom")}</div>
            <div className="text-[#1a7a5e] text-3xl font-bold">IDR {formatIDR(priceMonthly)}</div>
            <div className="text-xs text-[#3e4944]">{t("book.perMonthPlus")}</div>
          </div>

          <div className="space-y-3 mb-6">
            {[
              { label: t("book.minStay"), value: `${minStayMonths} ${minStayMonths > 1 ? t("book.monthPlural") : t("book.month")}` },
            ].map((item) => (
              <div key={item.label} className="flex justify-between items-center pb-3 border-b border-[#bec9c2]">
                <span className="text-[#3e4944] text-sm">{item.label}</span>
                <span className="text-[#1b1c1c] font-bold text-sm">{item.value}</span>
              </div>
            ))}
          </div>

          <div className="space-y-3">
            <Link
              href="/consultation"
              className="w-full bg-[#1a7a5e] text-white py-4 rounded-lg font-semibold flex flex-col items-center hover:opacity-90 transition-opacity"
            >
              <span>{t("book.consult")}</span>
              <span className="text-xs font-normal opacity-80">{t("book.consultSub")}</span>
            </Link>
            <Link
              href={`/listings/${slug}/viewing`}
              className="w-full border-2 border-[#0d2137] text-[#0d2137] py-4 rounded-lg font-semibold flex flex-col items-center hover:bg-[#f6f3f2] transition-colors"
            >
              <span>{t("book.viewing")}</span>
              <span className="text-xs font-normal opacity-70">{t("book.viewingSub")}</span>
            </Link>
          </div>
        </div>
      )}

      {/* Short-stay panel */}
      {(tab === "short_stay" || rentalMode === "short_stay") && shortStayRate && (
        <div className="space-y-4">
          <div>
            <div className="text-xs text-[#3e4944] mb-1">{t("book.nightlyRate")}</div>
            <div className="text-[#1a7a5e] text-3xl font-bold">
              IDR {formatIDR(shortStayRate.price_per_night)}
            </div>
            {shortStayRate.price_per_night_weekend && (
              <div className="text-xs text-[#3e4944]">
                {t("book.weekend")}: IDR {formatIDR(shortStayRate.price_per_night_weekend)}
              </div>
            )}
            {shortStayRate.cleaning_fee > 0 && (
              <div className="text-xs text-[#6e7a74]">
                + IDR {formatIDR(shortStayRate.cleaning_fee)} {t("book.cleaningFee")}
              </div>
            )}
          </div>

          <div className="space-y-2 pb-4 border-b border-[#bec9c2]">
            <div className="flex justify-between text-sm">
              <span className="text-[#3e4944]">{t("book.minNights")}</span>
              <span className="font-bold text-[#1b1c1c]">{shortStayRate.min_nights}</span>
            </div>
            {shortStayRate.max_nights && (
              <div className="flex justify-between text-sm">
                <span className="text-[#3e4944]">{t("book.maxNights")}</span>
                <span className="font-bold text-[#1b1c1c]">{shortStayRate.max_nights}</span>
              </div>
            )}
            {isInstantBookable && (
              <div className="flex items-center gap-1.5 text-xs text-[#1a7a5e] font-semibold">
                <span className="material-symbols-outlined text-sm">bolt</span>
                {t("book.instantAvail")}
              </div>
            )}
          </div>

          <Link
            href={`/listings/${slug}/book`}
            className="w-full bg-[#1a7a5e] text-white py-4 rounded-lg font-semibold flex flex-col items-center hover:opacity-90 transition-opacity"
          >
            <span>{t("book.bookNow")}</span>
            <span className="text-xs font-normal opacity-80">
              {isInstantBookable ? t("book.instantConfirm") : t("book.adminConfirm")}
            </span>
          </Link>
        </div>
      )}

      {/* Short-stay mode but no rate configured (admin hasn't set it yet) */}
      {(tab === "short_stay" || rentalMode === "short_stay") && !shortStayRate && (
        <div className="text-center py-6 text-sm text-[#6e7a74]">
          {t("book.noRates")}
        </div>
      )}
    </div>
  );
}
