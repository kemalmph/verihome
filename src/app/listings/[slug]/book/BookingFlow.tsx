"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n/LocaleProvider";
import type { ShortStayRateRow } from "@/lib/supabase/queries";

interface Props {
  propertyId:   string;
  slug:         string;
  propertyName: string;
  rate:         ShortStayRateRow;
}

// passed down to StepDates via context-like prop


type PricingTier = "per_night" | "weekly" | "monthly";

interface Quote {
  nights:           number;
  tier:             PricingTier;
  effectivePerNight: number;
  cleaningFee:      number;
  securityDeposit:  number;
  subtotal:         number;
  total:            number;
  checkInTime:      string;
  checkOutTime:     string;
  breakdown:        { date: string; price: number }[];
}

interface Intent {
  instructions:  string;
  bankName:      string;
  accountNumber: string;
  accountHolder: string;
  transferCode:  string;
  totalAmount:   number;
}

function fmt(n: number) {
  return new Intl.NumberFormat("id-ID").format(n);
}

// Payment deadline is shown in Jakarta time — the transfer is made from an
// Indonesian bank, so WIB is the only timezone the guest can act on.
function fmtDeadline(iso: string) {
  const d = new Date(iso);
  // Date and time are formatted separately: a combined id-ID format splices in
  // "pukul", which reads wrong inside the surrounding English sentence.
  const date = new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta", day: "numeric", month: "long", year: "numeric",
  }).format(d);
  const time = new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(d);
  return `${date}, ${time}`;
}

// ── Step 1: pick dates ────────────────────────────────────────

function StepDates({
  propertyId,
  rate,
  onNext,
}: {
  propertyId: string;
  rate: ShortStayRateRow;
  onNext: (checkIn: string, checkOut: string, guests: number, quote: Quote) => void;
}) {
  const [checkIn,  setCheckIn]  = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [guests,   setGuests]   = useState(1);
  const [quote,    setQuote]    = useState<Quote | null>(null);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");

  async function fetchQuote() {
    if (!checkIn || !checkOut) return;
    setLoading(true);
    setError("");
    try {
      const res  = await fetch(
        `/api/availability?propertyId=${propertyId}&checkIn=${checkIn}&checkOut=${checkOut}`
      );
      // Note: we build quote client-side to avoid passing propertyId in URL visible in component
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setQuote(data.quote);
    } catch {
      setError(t("bf.quoteError"));
    } finally {
      setLoading(false);
    }
  }

  const t = useT();
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="bg-white rounded-xl border border-[#cccccc] p-6 space-y-5">
      <h2 className="font-bold text-[#0d2137] text-lg">{t("bf.s1title")}</h2>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-[#3e4944] mb-1">{t("bf.checkIn")}</label>
          <input
            type="date"
            min={today}
            value={checkIn}
            onChange={(e) => { setCheckIn(e.target.value); setQuote(null); }}
            className="w-full border border-[#cccccc] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#1a7a5e]"
          />
        </div>
        <div>
          <label className="block text-sm text-[#3e4944] mb-1">{t("bf.checkOut")}</label>
          <input
            type="date"
            min={checkIn || today}
            value={checkOut}
            onChange={(e) => { setCheckOut(e.target.value); setQuote(null); }}
            className="w-full border border-[#cccccc] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#1a7a5e]"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm text-[#3e4944] mb-1">{t("bf.guests")}</label>
        <input
          type="number"
          min={1}
          max={20}
          value={guests}
          onChange={(e) => setGuests(Number(e.target.value))}
          className="w-32 border border-[#cccccc] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#1a7a5e]"
        />
      </div>

      <div className="text-xs text-[#6e7a74]">
        {t("bf.min")} {rate.min_nights} {rate.min_nights > 1 ? t("bf.nights") : t("bf.night")}
        {rate.max_nights ? ` · ${t("bf.max")} ${rate.max_nights} ${t("bf.nights")}` : ""}
      </div>

      <button
        onClick={fetchQuote}
        disabled={!checkIn || !checkOut || loading}
        className="w-full py-2.5 bg-[#0d2137] text-white rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-40"
      >
        {loading ? t("bf.calculating") : t("bf.checkPrice")}
      </button>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {quote && (
        <div className="bg-[#f6f3f2] rounded-lg p-4 space-y-2 text-sm">
          {/* Tier-aware price breakdown */}
          {quote.tier === "monthly" && (
            <div className="flex justify-between">
              <span>IDR {fmt(Math.round(quote.subtotal / (quote.nights / 30)))} × {(quote.nights / 30).toFixed(1)} {t("bf.months")}</span>
              <span>IDR {fmt(quote.subtotal)}</span>
            </div>
          )}
          {quote.tier === "weekly" && (
            <div className="flex justify-between">
              <span>IDR {fmt(Math.round(quote.subtotal / (quote.nights / 7)))} × {(quote.nights / 7).toFixed(1)} minggu</span>
              <span>IDR {fmt(quote.subtotal)}</span>
            </div>
          )}
          {quote.tier === "per_night" && quote.breakdown.length > 0 && (() => {
            const hasWeekend = quote.breakdown.some((b, i) =>
              i > 0 && b.price !== quote.breakdown[0].price
            );
            return hasWeekend ? (
              <>
                {quote.breakdown.map((b) => (
                  <div key={b.date} className="flex justify-between text-[#3e4944]">
                    <span>{b.date}</span><span>IDR {fmt(b.price)}</span>
                  </div>
                ))}
              </>
            ) : (
              <div className="flex justify-between">
                <span>IDR {fmt(quote.breakdown[0].price)} × {quote.nights} {t("bf.nights")}</span>
                <span>IDR {fmt(quote.subtotal)}</span>
              </div>
            );
          })()}
          {quote.cleaningFee > 0 && (
            <div className="flex justify-between text-[#6e7a74]"><span>{t("bf.cleaningFee")}</span><span>IDR {fmt(quote.cleaningFee)}</span></div>
          )}
          {quote.securityDeposit > 0 && (
            <div className="flex justify-between text-[#6e7a74]">
              <span>{t("bf.securityDeposit")} <span className="text-xs">{t("bf.refundable")}</span></span>
              <span>IDR {fmt(quote.securityDeposit)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold border-t border-[#cccccc] pt-2">
            <span>{t("bf.totalToPay")}</span>
            <span className="text-[#1a7a5e]">IDR {fmt(quote.total + quote.securityDeposit)}</span>
          </div>

          <button
            onClick={() => onNext(checkIn, checkOut, guests, quote)}
            className="w-full mt-2 py-3 bg-[#1a7a5e] text-white rounded-lg font-semibold hover:opacity-90"
          >
            Continue →
          </button>
        </div>
      )}
    </div>
  );
}

// ── Step 2: confirm details ───────────────────────────────────

function StepConfirm({
  checkIn, checkOut, guests, quote,
  onBack, onConfirm, loading,
}: {
  checkIn: string; checkOut: string; guests: number; quote: Quote;
  onBack: () => void; onConfirm: () => void; loading: boolean;
}) {
  const t = useT();
  return (
    <div className="bg-white rounded-xl border border-[#cccccc] p-6 space-y-5">
      <h2 className="font-bold text-[#0d2137] text-lg">{t("bf.s2title")}</h2>

      <div className="space-y-3 text-sm">
        {[
          { label: t("bf.checkIn"),  value: checkIn },
          { label: t("bf.checkOut"), value: checkOut },
          { label: t("bf.nightsLabel"), value: String(quote.nights) },
          { label: t("bf.guests"),   value: String(guests) },
          { label: t("bf.subtotal"), value: `IDR ${fmt(quote.subtotal)}` },
          ...(quote.cleaningFee > 0 ? [{ label: t("bf.cleaningFee"), value: `IDR ${fmt(quote.cleaningFee)}` }] : []),
          ...(quote.securityDeposit > 0
            ? [{ label: t("bf.depositRefundable"), value: `IDR ${fmt(quote.securityDeposit)}` }]
            : []),
          { label: t("bf.totalTransfer"), value: `IDR ${fmt(quote.total + quote.securityDeposit)}` },
        ].map((row) => (
          <div key={row.label} className="flex justify-between border-b border-[#f6f3f2] pb-2 last:border-0 last:font-bold">
            <span className="text-[#3e4944]">{row.label}</span>
            <span className="text-[#1b1c1c]">{row.value}</span>
          </div>
        ))}
      </div>

      <p className="text-xs text-[#6e7a74]">
        {t("bf.agree")}
      </p>

      <div className="flex gap-3">
        <button onClick={onBack} className="flex-1 py-3 border border-[#cccccc] rounded-lg text-sm font-semibold text-[#3e4944] hover:bg-[#f6f3f2]">
          ← {t("bf.back")}
        </button>
        <button
          onClick={onConfirm}
          disabled={loading}
          className="flex-1 py-3 bg-[#1a7a5e] text-white rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50"
        >
          {loading ? t("bf.creating") : t("bf.confirmGet")}
        </button>
      </div>
    </div>
  );
}

// ── Step 3: payment instructions ─────────────────────────────

function StepPayment({
  intent, bookingCode, expiresAt,
}: {
  intent: Intent; bookingCode: string; expiresAt: string | null;
}) {
  const t = useT();
  return (
    <div className="bg-white rounded-xl border border-[#cccccc] p-6 space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-[#1a7a5e]/10 flex items-center justify-center">
          <span className="material-symbols-outlined text-[#1a7a5e]">check_circle</span>
        </div>
        <div>
          <h2 className="font-bold text-[#0d2137] text-lg">{t("bf.requested")}</h2>
          <p className="text-sm text-[#6e7a74]">{t("bf.code")} <strong>{bookingCode}</strong></p>
        </div>
      </div>

      <div className="bg-[#f6f3f2] rounded-lg p-4 space-y-3">
        <p className="font-semibold text-sm text-[#0d2137]">{t("bf.completePayment")}</p>
        <div className="space-y-1 text-sm">
          <div className="flex justify-between"><span className="text-[#6e7a74]">{t("view.bank")}</span><strong>{intent.bankName}</strong></div>
          <div className="flex justify-between"><span className="text-[#6e7a74]">{t("view.account")}</span><strong>{intent.accountNumber}</strong></div>
          <div className="flex justify-between"><span className="text-[#6e7a74]">{t("view.accountName")}</span><strong>{intent.accountHolder}</strong></div>
          <div className="flex justify-between text-[#1a7a5e] font-bold border-t border-[#cccccc] pt-2 mt-2">
            <span>{t("view.transferExactly")}</span>
            <span>IDR {fmt(intent.totalAmount + Number(intent.transferCode))}</span>
          </div>
        </div>
        <p className="text-xs text-[#6e7a74]">{intent.instructions}</p>
      </div>

      {expiresAt && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
          <span className="material-symbols-outlined text-amber-500 text-base leading-none mt-0.5">schedule</span>
          <div className="text-xs text-amber-900 space-y-1">
            <p className="font-semibold">
              {t("bf.transferBefore")} {fmtDeadline(expiresAt)} WIB
            </p>
            <p className="text-amber-800">
              {t("bf.expiryNote")}
            </p>
          </div>
        </div>
      )}

      <p className="text-xs text-[#6e7a74]">
        {t("bf.afterTransfer")} <strong>{t("bf.myBookings")}</strong>. {t("bf.afterTransfer2")}
      </p>

      <a
        href="/dashboard/bookings"
        className="block w-full py-3 bg-[#0d2137] text-white rounded-lg text-sm font-semibold text-center hover:opacity-90"
      >
        {t("bf.viewBookings")}
      </a>
    </div>
  );
}

// ── Main flow ─────────────────────────────────────────────────

export function BookingFlow({ propertyId, rate }: Pick<Props, "propertyId" | "rate">) {
  const t = useT();
  const [step,    setStep]    = useState<1 | 2 | 3>(1);
  const [checkIn, setCheckIn] = useState("");
  const [checkOut,setCheckOut]= useState("");
  const [guests,  setGuests]  = useState(1);
  const [quote,   setQuote]   = useState<Quote | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");
  const [intent,  setIntent]  = useState<Intent | null>(null);
  const [bookingCode, setBookingCode] = useState("");
  const [expiresAt,   setExpiresAt]   = useState<string | null>(null);

  function handleStep1(ci: string, co: string, g: number, q: Quote) {
    setCheckIn(ci); setCheckOut(co); setGuests(g); setQuote(q);
    setStep(2);
  }

  async function handleConfirm() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ propertyId, checkIn, checkOut, guests }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setIntent(data.intent);
      setBookingCode(data.booking.booking_code);
      setExpiresAt(data.booking.expires_at ?? null);
      setStep(3);
    } catch {
      setError(t("common.error"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Progress */}
      <div className="flex items-center gap-2 text-xs text-[#6e7a74] mb-2">
        {[t("bf.stepDates"), t("bf.stepConfirm"), t("bf.stepPayment")].map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${step === i + 1 ? "bg-[#1a7a5e] text-white" : step > i + 1 ? "bg-[#9cf4d1] text-[#0d2137]" : "bg-[#e4e2e1] text-[#6e7a74]"}`}>
              {step > i + 1 ? "✓" : i + 1}
            </span>
            <span className={step === i + 1 ? "font-semibold text-[#0d2137]" : ""}>{label}</span>
            {i < 2 && <span className="text-[#cccccc]">›</span>}
          </div>
        ))}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-600">{error}</div>
      )}

      {step === 1 && <StepDates propertyId={propertyId} rate={rate} onNext={handleStep1} />}
      {step === 2 && quote && (
        <StepConfirm
          checkIn={checkIn} checkOut={checkOut} guests={guests} quote={quote}
          onBack={() => setStep(1)} onConfirm={handleConfirm} loading={loading}
        />
      )}
      {step === 3 && intent && (
        <StepPayment intent={intent} bookingCode={bookingCode} expiresAt={expiresAt} />
      )}
    </div>
  );
}
