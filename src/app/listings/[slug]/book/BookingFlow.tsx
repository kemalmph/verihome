"use client";

import { useState } from "react";
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
      setError("Could not fetch price. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="bg-white rounded-xl border border-[#cccccc] p-6 space-y-5">
      <h2 className="font-bold text-[#0d2137] text-lg">1. Select your dates</h2>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-[#3e4944] mb-1">Check-in</label>
          <input
            type="date"
            min={today}
            value={checkIn}
            onChange={(e) => { setCheckIn(e.target.value); setQuote(null); }}
            className="w-full border border-[#cccccc] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#1a7a5e]"
          />
        </div>
        <div>
          <label className="block text-sm text-[#3e4944] mb-1">Check-out</label>
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
        <label className="block text-sm text-[#3e4944] mb-1">Guests</label>
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
        Min {rate.min_nights} night{rate.min_nights > 1 ? "s" : ""}
        {rate.max_nights ? ` · Max ${rate.max_nights} nights` : ""}
      </div>

      <button
        onClick={fetchQuote}
        disabled={!checkIn || !checkOut || loading}
        className="w-full py-2.5 bg-[#0d2137] text-white rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-40"
      >
        {loading ? "Calculating…" : "Check availability & price"}
      </button>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {quote && (
        <div className="bg-[#f6f3f2] rounded-lg p-4 space-y-2 text-sm">
          {/* Tier-aware price breakdown */}
          {quote.tier === "monthly" && (
            <div className="flex justify-between">
              <span>IDR {fmt(Math.round(quote.subtotal / (quote.nights / 30)))} × {(quote.nights / 30).toFixed(1)} bulan</span>
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
                <span>IDR {fmt(quote.breakdown[0].price)} × {quote.nights} malam</span>
                <span>IDR {fmt(quote.subtotal)}</span>
              </div>
            );
          })()}
          {quote.cleaningFee > 0 && (
            <div className="flex justify-between text-[#6e7a74]"><span>Cleaning fee</span><span>IDR {fmt(quote.cleaningFee)}</span></div>
          )}
          <div className="flex justify-between font-bold border-t border-[#cccccc] pt-2">
            <span>Total</span><span className="text-[#1a7a5e]">IDR {fmt(quote.total)}</span>
          </div>
          {quote.securityDeposit > 0 && (
            <div className="flex justify-between text-xs text-[#6e7a74] border-t border-[#e4e2e1] pt-2">
              <span>Security deposit (refundable, paid separately)</span>
              <span>IDR {fmt(quote.securityDeposit)}</span>
            </div>
          )}

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
  return (
    <div className="bg-white rounded-xl border border-[#cccccc] p-6 space-y-5">
      <h2 className="font-bold text-[#0d2137] text-lg">2. Confirm your booking</h2>

      <div className="space-y-3 text-sm">
        {[
          { label: "Check-in",    value: checkIn },
          { label: "Check-out",   value: checkOut },
          { label: "Nights",      value: String(quote.nights) },
          { label: "Guests",      value: String(guests) },
          { label: "Subtotal",    value: `IDR ${fmt(quote.subtotal)}` },
          ...(quote.cleaningFee > 0 ? [{ label: "Cleaning fee", value: `IDR ${fmt(quote.cleaningFee)}` }] : []),
          { label: "Total (to transfer)",  value: `IDR ${fmt(quote.total)}` },
          ...(quote.securityDeposit > 0 ? [{ label: "Security deposit (refundable)", value: `IDR ${fmt(quote.securityDeposit)}` }] : []),
        ].map((row) => (
          <div key={row.label} className="flex justify-between border-b border-[#f6f3f2] pb-2 last:border-0 last:font-bold">
            <span className="text-[#3e4944]">{row.label}</span>
            <span className="text-[#1b1c1c]">{row.value}</span>
          </div>
        ))}
      </div>

      <p className="text-xs text-[#6e7a74]">
        By confirming, you agree to pay via bank transfer. Details will be shown on the next screen.
      </p>

      <div className="flex gap-3">
        <button onClick={onBack} className="flex-1 py-3 border border-[#cccccc] rounded-lg text-sm font-semibold text-[#3e4944] hover:bg-[#f6f3f2]">
          ← Back
        </button>
        <button
          onClick={onConfirm}
          disabled={loading}
          className="flex-1 py-3 bg-[#1a7a5e] text-white rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50"
        >
          {loading ? "Creating booking…" : "Confirm & get payment details"}
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
  return (
    <div className="bg-white rounded-xl border border-[#cccccc] p-6 space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-[#1a7a5e]/10 flex items-center justify-center">
          <span className="material-symbols-outlined text-[#1a7a5e]">check_circle</span>
        </div>
        <div>
          <h2 className="font-bold text-[#0d2137] text-lg">Booking requested!</h2>
          <p className="text-sm text-[#6e7a74]">Code: <strong>{bookingCode}</strong></p>
        </div>
      </div>

      <div className="bg-[#f6f3f2] rounded-lg p-4 space-y-3">
        <p className="font-semibold text-sm text-[#0d2137]">Complete your payment:</p>
        <div className="space-y-1 text-sm">
          <div className="flex justify-between"><span className="text-[#6e7a74]">Bank</span><strong>{intent.bankName}</strong></div>
          <div className="flex justify-between"><span className="text-[#6e7a74]">Account</span><strong>{intent.accountNumber}</strong></div>
          <div className="flex justify-between"><span className="text-[#6e7a74]">Name</span><strong>{intent.accountHolder}</strong></div>
          <div className="flex justify-between text-[#1a7a5e] font-bold border-t border-[#cccccc] pt-2 mt-2">
            <span>Transfer exactly</span>
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
              Transfer before {fmtDeadline(expiresAt)} WIB
            </p>
            <p className="text-amber-800">
              After this time the booking is cancelled automatically and the dates are released to other guests.
            </p>
            <p className="text-amber-800">
              Transfer sebelum waktu tersebut. Lewat batas ini, pemesanan otomatis dibatalkan dan tanggalnya dilepas.
            </p>
          </div>
        </div>
      )}

      <p className="text-xs text-[#6e7a74]">
        After transferring, upload your payment proof in <strong>My Bookings</strong>. We&apos;ll confirm within 24 hours.
      </p>

      <a
        href="/dashboard/bookings"
        className="block w-full py-3 bg-[#0d2137] text-white rounded-lg text-sm font-semibold text-center hover:opacity-90"
      >
        View my bookings
      </a>
    </div>
  );
}

// ── Main flow ─────────────────────────────────────────────────

export function BookingFlow({ propertyId, rate }: Pick<Props, "propertyId" | "rate">) {
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
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Progress */}
      <div className="flex items-center gap-2 text-xs text-[#6e7a74] mb-2">
        {(["Select dates", "Confirm", "Payment"] as const).map((label, i) => (
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
