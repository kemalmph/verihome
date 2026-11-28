"use client";

import { useState } from "react";
import Link from "next/link";
import { useT } from "@/lib/i18n/LocaleProvider";
import type { ShortStayRateRow } from "@/lib/supabase/queries";
import { pill } from "@/components/brand/styles";
import { FlowSteps } from "@/components/checkout/FlowSteps";
import { PaymentInstructions } from "@/components/checkout/PaymentInstructions";
import type { PaymentIntent } from "@/lib/payment/types";
import { flow } from "@/components/checkout/styles";

interface Props {
  propertyId:   string;
  slug:         string;
  propertyName: string;
  rate:         ShortStayRateRow;
}

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
  const t = useT();
  const [checkIn,  setCheckIn]  = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [guests,   setGuests]   = useState(1);
  const [quote,    setQuote]    = useState<Quote | null>(null);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");

  // The quote shown here is for display. The server recomputes the charge
  // when the booking is created, and its figure is the one that counts
  // (Reference §7).
  async function fetchQuote() {
    if (!checkIn || !checkOut) return;
    setLoading(true);
    setError("");
    try {
      const res  = await fetch(
        `/api/availability?propertyId=${propertyId}&checkIn=${checkIn}&checkOut=${checkOut}`
      );
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setQuote(data.quote);
    } catch {
      setError(t("bf.quoteError"));
    } finally {
      setLoading(false);
    }
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <section className={flow.card}>
      <h2 className={flow.title}>{t("bf.s1title")}</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <label className="block">
          <span className={flow.label}>{t("bf.checkIn")}</span>
          <input
            type="date"
            min={today}
            value={checkIn}
            onChange={(e) => { setCheckIn(e.target.value); setQuote(null); }}
            className={flow.field}
          />
        </label>
        <label className="block">
          <span className={flow.label}>{t("bf.checkOut")}</span>
          <input
            type="date"
            min={checkIn || today}
            value={checkOut}
            onChange={(e) => { setCheckOut(e.target.value); setQuote(null); }}
            className={flow.field}
          />
        </label>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <label className="block">
          <span className={flow.label}>{t("bf.guests")}</span>
          <input
            type="number"
            min={1}
            max={20}
            value={guests}
            onChange={(e) => setGuests(Number(e.target.value))}
            className={`${flow.field} w-32`}
          />
        </label>
        <p className="text-xs text-ink-3 pb-1">
          {t("bf.min")} {rate.min_nights} {rate.min_nights > 1 ? t("bf.nights") : t("bf.night")}
          {rate.max_nights ? ` · ${t("bf.max")} ${rate.max_nights} ${t("bf.nights")}` : ""}
        </p>
      </div>

      <button
        onClick={fetchQuote}
        disabled={!checkIn || !checkOut || loading}
        className={`${pill.secondary} w-full disabled:opacity-40`}
      >
        <span aria-hidden className="material-symbols-outlined text-[18px] text-brand">calculate</span>
        {loading ? t("bf.calculating") : t("bf.checkPrice")}
      </button>

      {error && <p className={flow.error}>{error}</p>}

      {quote && (
        <div className="rounded-2xl bg-cream-2 border border-line p-5 space-y-2.5 text-sm">
          {/* Tier-aware price breakdown */}
          {quote.tier === "monthly" && (
            <div className="flex justify-between gap-4 text-ink-2">
              <span>IDR {fmt(Math.round(quote.subtotal / (quote.nights / 30)))} × {(quote.nights / 30).toFixed(1)} {t("bf.months")}</span>
              <span className="tabular-nums">IDR {fmt(quote.subtotal)}</span>
            </div>
          )}
          {quote.tier === "weekly" && (
            <div className="flex justify-between gap-4 text-ink-2">
              <span>IDR {fmt(Math.round(quote.subtotal / (quote.nights / 7)))} × {(quote.nights / 7).toFixed(1)} {t("flow.weeks")}</span>
              <span className="tabular-nums">IDR {fmt(quote.subtotal)}</span>
            </div>
          )}
          {quote.tier === "per_night" && quote.breakdown.length > 0 && (() => {
            const hasWeekend = quote.breakdown.some((b, i) =>
              i > 0 && b.price !== quote.breakdown[0].price
            );
            return hasWeekend ? (
              <>
                {quote.breakdown.map((b) => (
                  <div key={b.date} className="flex justify-between gap-4 text-ink-2">
                    <span>{b.date}</span><span className="tabular-nums">IDR {fmt(b.price)}</span>
                  </div>
                ))}
              </>
            ) : (
              <div className="flex justify-between gap-4 text-ink-2">
                <span>IDR {fmt(quote.breakdown[0].price)} × {quote.nights} {t("bf.nights")}</span>
                <span className="tabular-nums">IDR {fmt(quote.subtotal)}</span>
              </div>
            );
          })()}
          {quote.cleaningFee > 0 && (
            <div className="flex justify-between gap-4 text-ink-3">
              <span>{t("bf.cleaningFee")}</span><span className="tabular-nums">IDR {fmt(quote.cleaningFee)}</span>
            </div>
          )}
          {quote.securityDeposit > 0 && (
            <div className="flex justify-between gap-4 text-ink-3">
              <span>{t("bf.securityDeposit")} <span className="text-xs">{t("bf.refundable")}</span></span>
              <span className="tabular-nums">IDR {fmt(quote.securityDeposit)}</span>
            </div>
          )}
          <div className="flex justify-between items-baseline gap-4 border-t border-line-strong pt-3 mt-1">
            <span className="font-bold text-ink">{t("bf.totalToPay")}</span>
            <span className="text-lg sm:text-xl font-extrabold tracking-[-0.02em] text-ink tabular-nums whitespace-nowrap">
              IDR {fmt(quote.total + quote.securityDeposit)}
            </span>
          </div>

          <button
            onClick={() => onNext(checkIn, checkOut, guests, quote)}
            className={`${pill.primary} w-full mt-3`}
          >
            {t("flow.continue")} <span aria-hidden>→</span>
          </button>
        </div>
      )}
    </section>
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
  const rows = [
    { label: t("bf.checkIn"),  value: checkIn },
    { label: t("bf.checkOut"), value: checkOut },
    { label: t("bf.nightsLabel"), value: String(quote.nights) },
    { label: t("bf.guests"),   value: String(guests) },
    { label: t("bf.subtotal"), value: `IDR ${fmt(quote.subtotal)}` },
    ...(quote.cleaningFee > 0 ? [{ label: t("bf.cleaningFee"), value: `IDR ${fmt(quote.cleaningFee)}` }] : []),
    ...(quote.securityDeposit > 0
      ? [{ label: t("bf.depositRefundable"), value: `IDR ${fmt(quote.securityDeposit)}` }]
      : []),
  ];

  return (
    <section className={flow.card}>
      <h2 className={flow.title}>{t("bf.s2title")}</h2>

      <dl className="text-sm divide-y divide-line">
        {rows.map((row) => (
          <div key={row.label} className="flex justify-between gap-4 py-2.5">
            <dt className="text-ink-3">{row.label}</dt>
            <dd className="font-semibold text-ink tabular-nums">{row.value}</dd>
          </div>
        ))}
      </dl>

      <div className="flex justify-between items-baseline gap-4 rounded-2xl bg-brand-soft px-5 py-4">
        <span className="font-bold text-ink">{t("bf.totalTransfer")}</span>
        <span className="text-lg sm:text-xl font-extrabold tracking-[-0.02em] text-ink tabular-nums whitespace-nowrap">
          IDR {fmt(quote.total + quote.securityDeposit)}
        </span>
      </div>

      <p className="text-xs text-ink-3">{t("bf.agree")}</p>

      <div className="flex flex-col-reverse sm:flex-row gap-3">
        <button onClick={onBack} className={`${pill.secondary} sm:flex-1`}>
          <span aria-hidden>←</span> {t("bf.back")}
        </button>
        <button
          onClick={onConfirm}
          disabled={loading}
          className={`${pill.primary} sm:flex-[2]`}
        >
          {loading ? t("bf.creating") : t("bf.confirmGet")}
        </button>
      </div>
    </section>
  );
}

// ── Step 3: payment instructions ─────────────────────────────

function StepPayment({
  intent, bookingCode, expiresAt,
}: {
  intent: PaymentIntent; bookingCode: string; expiresAt: string | null;
}) {
  const t = useT();
  return (
    <section className={flow.card}>
      <div className="flex items-center gap-4">
        <span className="grid place-items-center shrink-0 w-12 h-12 rounded-2xl bg-success-soft">
          <span aria-hidden className="material-symbols-outlined text-success">check_circle</span>
        </span>
        <div>
          <h2 className={flow.title}>{t("bf.requested")}</h2>
          <p className="text-sm text-ink-3">
            {t("bf.code")} <strong className="text-ink font-bold tracking-wide">{bookingCode}</strong>
          </p>
        </div>
      </div>

      {/* The deadline comes first: it decides whether the booking survives. */}
      {expiresAt && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3.5">
          <span aria-hidden className="material-symbols-outlined text-amber-600 text-[20px] leading-none mt-0.5">schedule</span>
          <div className="text-sm text-amber-900 space-y-1">
            <p className="font-bold">
              {t("bf.transferBefore")} {fmtDeadline(expiresAt)} WIB
            </p>
            <p className="text-xs text-amber-800">{t("bf.expiryNote")}</p>
          </div>
        </div>
      )}

      <PaymentInstructions intent={intent} title="bf.completePayment" />

      <p className="text-xs text-ink-3">
        {t("bf.afterTransfer")} <strong className="text-ink">{t("bf.myBookings")}</strong>. {t("bf.afterTransfer2")}
      </p>

      <Link href="/account/bookings" className={`${pill.primary} w-full`}>
        {t("bf.viewBookings")} <span aria-hidden>→</span>
      </Link>
    </section>
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
  const [intent,  setIntent]  = useState<PaymentIntent | null>(null);
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
    <div className="space-y-5">
      <FlowSteps labels={[t("bf.stepDates"), t("bf.stepConfirm"), t("bf.stepPayment")]} current={step} />

      {error && <div role="alert" className={flow.error}>{error}</div>}

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
