"use client";

import { useState } from "react";
import Link from "next/link";
import { useT } from "@/lib/i18n/LocaleProvider";
import { DepositPolicy } from "@/components/viewings/DepositPolicy";
import { VIEWING_POLICY_VERSION } from "@/lib/viewings/policy";
import { pill } from "@/components/brand/styles";
import { FlowSteps } from "@/components/checkout/FlowSteps";
import { PaymentInstructions } from "@/components/checkout/PaymentInstructions";
import type { PaymentIntent } from "@/lib/payment/types";
import { flow } from "@/components/checkout/styles";

interface Props {
  propertyId:    string;
  slug:          string;
  depositAmount: number;
}

function fmt(n: number) {
  return new Intl.NumberFormat("id-ID").format(n);
}

// ── Step 1: pick date/time ────────────────────────────────────

function StepSchedule({
  depositAmount,
  onNext,
}: {
  depositAmount: number;
  onNext: (date: string, time: string, notes: string) => void;
}) {
  const t = useT();
  const [date,  setDate]  = useState("");
  const [time,  setTime]  = useState("");
  const [notes, setNotes] = useState("");

  const today = new Date().toISOString().slice(0, 10);
  const slots = ["09:00", "10:00", "11:00", "13:00", "14:00", "15:00", "16:00"];

  return (
    <section className={flow.card}>
      <h2 className={flow.title}>{t("view.s1title")}</h2>

      <label className="block">
        <span className={flow.label}>{t("view.prefDate")}</span>
        <input
          type="date"
          min={today}
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className={flow.field}
        />
      </label>

      <fieldset>
        <legend className={flow.label}>{t("view.prefTime")}</legend>
        <div className="flex flex-wrap gap-2 mt-1">
          {slots.map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={time === s}
              onClick={() => setTime(s)}
              className={`px-4 py-2 rounded-full text-sm font-semibold border tabular-nums transition-colors ${
                time === s
                  ? "bg-brand text-white border-brand shadow-brand"
                  : "bg-white border-line-strong text-ink-2 hover:border-brand hover:text-ink"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </fieldset>

      <label className="block">
        <span className={flow.label}>{t("view.notes")}</span>
        <textarea
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={t("view.notesPh")}
          className={flow.textarea}
        />
      </label>

      <div className="rounded-2xl bg-cream-2 border border-line px-5 py-4">
        <p className="text-sm text-ink-2">
          {t("view.depositRequired")}{" "}
          <strong className="text-ink font-extrabold">IDR {fmt(depositAmount)}</strong>
        </p>
        <p className="mt-1 text-xs text-ink-3">{t("view.depositNote")}</p>
      </div>

      <button
        onClick={() => onNext(date, time, notes)}
        disabled={!date || !time}
        className={`${pill.primary} w-full`}
      >
        {t("flow.continue")} <span aria-hidden>→</span>
      </button>
    </section>
  );
}

// ── Step 2: confirm ───────────────────────────────────────────

function StepConfirm({
  date, time, notes, depositAmount,
  acknowledged, onAcknowledge,
  onBack, onConfirm, loading,
}: {
  date: string; time: string; notes: string; depositAmount: number;
  acknowledged: boolean; onAcknowledge: (v: boolean) => void;
  onBack: () => void; onConfirm: () => void; loading: boolean;
}) {
  const t = useT();
  return (
    <section className={flow.card}>
      <h2 className={flow.title}>{t("view.s2title")}</h2>

      <dl className="text-sm divide-y divide-line">
        {[
          { label: t("view.date"),    value: date },
          { label: t("view.time"),    value: time },
          { label: t("view.deposit"), value: `IDR ${fmt(depositAmount)}` },
        ].map((r) => (
          <div key={r.label} className="flex justify-between gap-4 py-2.5">
            <dt className="text-ink-3">{r.label}</dt>
            <dd className="font-semibold text-ink tabular-nums">{r.value}</dd>
          </div>
        ))}
        {notes && (
          <div className="py-2.5">
            <dt className="text-ink-3 text-xs mb-0.5">{t("view.notesShort")}</dt>
            <dd className="text-sm text-ink-2">{notes}</dd>
          </div>
        )}
      </dl>

      {/* The terms come before the money, not after it (Reference §10). */}
      <DepositPolicy deposit={depositAmount} />

      <label className="flex items-start gap-3 rounded-2xl border border-line bg-cream-2 px-4 py-3.5 cursor-pointer has-[:checked]:border-brand-light has-[:checked]:bg-brand-soft">
        <input
          type="checkbox"
          checked={acknowledged}
          onChange={(e) => onAcknowledge(e.target.checked)}
          className="mt-0.5 w-4 h-4 accent-brand shrink-0"
        />
        <span className="text-sm text-ink-2">{t("view.ack")}</span>
      </label>

      <div className="flex flex-col-reverse sm:flex-row gap-3">
        <button onClick={onBack} className={`${pill.secondary} sm:flex-1`}>
          <span aria-hidden>←</span> {t("view.back")}
        </button>
        <button
          onClick={onConfirm}
          disabled={loading || !acknowledged}
          className={`${pill.primary} sm:flex-[2] disabled:cursor-not-allowed`}
        >
          {loading ? t("view.submitting") : t("view.submit")}
        </button>
      </div>
    </section>
  );
}

// ── Step 3: payment ───────────────────────────────────────────

function StepPayment({ intent }: { intent: PaymentIntent }) {
  const t = useT();
  return (
    <section className={flow.card}>
      <div className="flex items-center gap-4">
        <span className="grid place-items-center shrink-0 w-12 h-12 rounded-2xl bg-success-soft">
          <span aria-hidden className="material-symbols-outlined text-success">check_circle</span>
        </span>
        <div>
          <h2 className={flow.title}>{t("view.requested")}</h2>
          <p className="text-sm text-ink-3">{t("view.requestedSub")}</p>
        </div>
      </div>

      <PaymentInstructions intent={intent} title="view.payNow" />

      <Link href="/account/viewings" className={`${pill.primary} w-full`}>
        {t("view.myViewings")} <span aria-hidden>→</span>
      </Link>
    </section>
  );
}

// ── Main ──────────────────────────────────────────────────────

export function ViewingFlow({ propertyId, depositAmount }: Pick<Props, "propertyId" | "depositAmount">) {
  const t = useT();
  const [step,   setStep]   = useState<1 | 2 | 3>(1);
  const [date,   setDate]   = useState("");
  const [time,   setTime]   = useState("");
  const [notes,  setNotes]  = useState("");
  const [loading,setLoading]= useState(false);
  const [error,  setError]  = useState("");
  const [intent, setIntent] = useState<PaymentIntent | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);

  function handleStep1(d: string, tm: string, n: string) {
    setDate(d); setTime(tm); setNotes(n);
    setStep(2);
  }

  async function handleConfirm() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/viewings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId,
          preferredDates: [{ date, time }],
          notes,
          policyAcknowledged: acknowledged,
          policyVersion: VIEWING_POLICY_VERSION,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setIntent(data.intent);
      setStep(3);
    } catch {
      setError(t("common.error"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <FlowSteps labels={[t("view.stepSchedule"), t("view.stepConfirm"), t("view.stepPayment")]} current={step} />

      {error && <div role="alert" className={flow.error}>{error}</div>}

      {step === 1 && <StepSchedule depositAmount={depositAmount} onNext={handleStep1} />}
      {step === 2 && (
        <StepConfirm
          date={date} time={time} notes={notes} depositAmount={depositAmount}
          acknowledged={acknowledged} onAcknowledge={setAcknowledged}
          onBack={() => setStep(1)} onConfirm={handleConfirm} loading={loading}
        />
      )}
      {step === 3 && intent && <StepPayment intent={intent} />}
    </div>
  );
}
