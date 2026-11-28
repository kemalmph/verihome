"use client";


import { useState } from "react";
import { useT } from "@/lib/i18n/LocaleProvider";
import { DepositPolicy } from "@/components/viewings/DepositPolicy";
import { VIEWING_POLICY_VERSION } from "@/lib/viewings/policy";

interface Props {
  propertyId:    string;
  slug:          string;
  depositAmount: number;
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
    <div className="bg-white rounded-xl border border-[#cccccc] p-6 space-y-5">
      <h2 className="font-bold text-ink text-lg">{t("view.s1title")}</h2>

      <div>
        <label className="block text-sm text-ink-2 mb-1">{t("view.prefDate")}</label>
        <input
          type="date"
          min={today}
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full border border-[#cccccc] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand"
        />
      </div>

      <div>
        <label className="block text-sm text-ink-2 mb-2">{t("view.prefTime")}</label>
        <div className="flex flex-wrap gap-2">
          {slots.map((s) => (
            <button
              key={s}
              onClick={() => setTime(s)}
              className={`px-4 py-1.5 rounded-full text-sm border transition-colors ${
                time === s
                  ? "bg-brand text-white border-brand"
                  : "border-[#cccccc] text-ink-2 hover:border-brand"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm text-ink-2 mb-1">{t("view.notes")}</label>
        <textarea
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={t("view.notesPh")}
          className="w-full border border-[#cccccc] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand resize-none"
        />
      </div>

      <div className="bg-[#f6f3f2] rounded-lg p-3 text-sm text-ink-2">
        {t("view.depositRequired")} <strong className="text-brand-ink">IDR {fmt(depositAmount)}</strong>
        <br />
        <span className="text-xs text-ink-3">{t("view.depositNote")}</span>
      </div>

      <button
        onClick={() => onNext(date, time, notes)}
        disabled={!date || !time}
        className="w-full py-3 bg-brand text-white rounded-lg font-semibold text-sm hover:opacity-90 disabled:opacity-40"
      >
        Continue →
      </button>
    </div>
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
    <div className="bg-white rounded-xl border border-[#cccccc] p-6 space-y-5">
      <h2 className="font-bold text-ink text-lg">{t("view.s2title")}</h2>

      <div className="space-y-2 text-sm">
        {[
          { label: t("view.date"),    value: date },
          { label: t("view.time"),    value: time },
          { label: t("view.deposit"), value: `IDR ${fmt(depositAmount)}` },
        ].map((r) => (
          <div key={r.label} className="flex justify-between border-b border-[#f6f3f2] pb-2">
            <span className="text-ink-2">{r.label}</span>
            <span className="font-semibold text-ink">{r.value}</span>
          </div>
        ))}
        {notes && (
          <div>
            <p className="text-ink-3 text-xs mb-0.5">{t("view.notesShort")}</p>
            <p className="text-sm">{notes}</p>
          </div>
        )}
      </div>

      {/* The terms come before the money, not after it. */}
      <DepositPolicy deposit={depositAmount} />

      <label className="flex items-start gap-3 bg-[#f6f3f2] rounded-lg p-3 cursor-pointer">
        <input
          type="checkbox"
          checked={acknowledged}
          onChange={(e) => onAcknowledge(e.target.checked)}
          className="mt-0.5 w-4 h-4 accent-brand shrink-0"
        />
        <span className="text-sm text-ink-2">
          {t("view.ack")}
        </span>
      </label>

      <div className="flex gap-3">
        <button onClick={onBack} className="flex-1 py-3 border border-[#cccccc] rounded-lg text-sm font-semibold text-ink-2 hover:bg-[#f6f3f2]">
          ← {t("view.back")}
        </button>
        <button
          onClick={onConfirm}
          disabled={loading || !acknowledged}
          className="flex-1 py-3 bg-brand text-white rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? t("view.submitting") : t("view.submit")}
        </button>
      </div>
    </div>
  );
}

// ── Step 3: payment ───────────────────────────────────────────

function StepPayment({ intent }: { intent: Intent }) {
  const t = useT();
  return (
    <div className="bg-white rounded-xl border border-[#cccccc] p-6 space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-brand/10 flex items-center justify-center">
          <span className="material-symbols-outlined text-brand-ink">check_circle</span>
        </div>
        <div>
          <h2 className="font-bold text-ink text-lg">{t("view.requested")}</h2>
          <p className="text-sm text-ink-3">{t("view.requestedSub")}</p>
        </div>
      </div>

      <div className="bg-[#f6f3f2] rounded-lg p-4 space-y-3">
        <p className="font-semibold text-sm text-ink">{t("view.payNow")}</p>
        <div className="space-y-1 text-sm">
          <div className="flex justify-between"><span className="text-ink-3">{t("view.bank")}</span><strong>{intent.bankName}</strong></div>
          <div className="flex justify-between"><span className="text-ink-3">{t("view.account")}</span><strong>{intent.accountNumber}</strong></div>
          <div className="flex justify-between"><span className="text-ink-3">{t("view.accountName")}</span><strong>{intent.accountHolder}</strong></div>
          <div className="flex justify-between text-brand-ink font-bold border-t border-[#cccccc] pt-2 mt-2">
            <span>{t("view.transferExactly")}</span>
            <span>IDR {fmt(intent.totalAmount + Number(intent.transferCode))}</span>
          </div>
        </div>
        <p className="text-xs text-ink-3">{intent.instructions}</p>
      </div>

      <a
        href="/dashboard/viewings"
        className="block w-full py-3 bg-ink text-white rounded-lg text-sm font-semibold text-center hover:opacity-90"
      >
        {t("view.myViewings")}
      </a>
    </div>
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
  const [intent, setIntent] = useState<Intent | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);

  function handleStep1(d: string, t: string, n: string) {
    setDate(d); setTime(t); setNotes(n);
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
    <div className="space-y-4">
      {/* Progress */}
      <div className="flex items-center gap-2 text-xs text-ink-3 mb-2">
        {[t("view.stepSchedule"), t("view.stepConfirm"), t("view.stepPayment")].map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${step === i + 1 ? "bg-brand text-white" : step > i + 1 ? "bg-brand-light text-ink" : "bg-[#e4e2e1] text-ink-3"}`}>
              {step > i + 1 ? "✓" : i + 1}
            </span>
            <span className={step === i + 1 ? "font-semibold text-ink" : ""}>{label}</span>
            {i < 2 && <span className="text-[#cccccc]">›</span>}
          </div>
        ))}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-600">{error}</div>
      )}

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
