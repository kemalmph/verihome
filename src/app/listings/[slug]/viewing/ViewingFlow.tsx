"use client";

import { useState } from "react";

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
  const [date,  setDate]  = useState("");
  const [time,  setTime]  = useState("");
  const [notes, setNotes] = useState("");

  const today = new Date().toISOString().slice(0, 10);
  const slots = ["09:00", "10:00", "11:00", "13:00", "14:00", "15:00", "16:00"];

  return (
    <div className="bg-white rounded-xl border border-[#cccccc] p-6 space-y-5">
      <h2 className="font-bold text-[#0d2137] text-lg">1. Choose a date &amp; time</h2>

      <div>
        <label className="block text-sm text-[#3e4944] mb-1">Preferred date</label>
        <input
          type="date"
          min={today}
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full border border-[#cccccc] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#1a7a5e]"
        />
      </div>

      <div>
        <label className="block text-sm text-[#3e4944] mb-2">Preferred time</label>
        <div className="flex flex-wrap gap-2">
          {slots.map((s) => (
            <button
              key={s}
              onClick={() => setTime(s)}
              className={`px-4 py-1.5 rounded-full text-sm border transition-colors ${
                time === s
                  ? "bg-[#1a7a5e] text-white border-[#1a7a5e]"
                  : "border-[#cccccc] text-[#3e4944] hover:border-[#1a7a5e]"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm text-[#3e4944] mb-1">Notes (optional)</label>
        <textarea
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Any specific questions or accessibility needs?"
          className="w-full border border-[#cccccc] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#1a7a5e] resize-none"
        />
      </div>

      <div className="bg-[#f6f3f2] rounded-lg p-3 text-sm text-[#3e4944]">
        Deposit required: <strong className="text-[#1a7a5e]">IDR {fmt(depositAmount)}</strong>
        <br />
        <span className="text-xs text-[#6e7a74]">Refunded or credited after you attend the viewing.</span>
      </div>

      <button
        onClick={() => onNext(date, time, notes)}
        disabled={!date || !time}
        className="w-full py-3 bg-[#1a7a5e] text-white rounded-lg font-semibold text-sm hover:opacity-90 disabled:opacity-40"
      >
        Continue →
      </button>
    </div>
  );
}

// ── Step 2: confirm ───────────────────────────────────────────

function StepConfirm({
  date, time, notes, depositAmount,
  onBack, onConfirm, loading,
}: {
  date: string; time: string; notes: string; depositAmount: number;
  onBack: () => void; onConfirm: () => void; loading: boolean;
}) {
  return (
    <div className="bg-white rounded-xl border border-[#cccccc] p-6 space-y-5">
      <h2 className="font-bold text-[#0d2137] text-lg">2. Confirm viewing request</h2>

      <div className="space-y-2 text-sm">
        {[
          { label: "Date",    value: date },
          { label: "Time",    value: time },
          { label: "Deposit", value: `IDR ${fmt(depositAmount)}` },
        ].map((r) => (
          <div key={r.label} className="flex justify-between border-b border-[#f6f3f2] pb-2">
            <span className="text-[#3e4944]">{r.label}</span>
            <span className="font-semibold text-[#1b1c1c]">{r.value}</span>
          </div>
        ))}
        {notes && (
          <div>
            <p className="text-[#6e7a74] text-xs mb-0.5">Notes</p>
            <p className="text-sm">{notes}</p>
          </div>
        )}
      </div>

      <div className="flex gap-3">
        <button onClick={onBack} className="flex-1 py-3 border border-[#cccccc] rounded-lg text-sm font-semibold text-[#3e4944] hover:bg-[#f6f3f2]">
          ← Back
        </button>
        <button
          onClick={onConfirm}
          disabled={loading}
          className="flex-1 py-3 bg-[#1a7a5e] text-white rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50"
        >
          {loading ? "Submitting…" : "Submit & get payment details"}
        </button>
      </div>
    </div>
  );
}

// ── Step 3: payment ───────────────────────────────────────────

function StepPayment({ intent }: { intent: Intent }) {
  return (
    <div className="bg-white rounded-xl border border-[#cccccc] p-6 space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-[#1a7a5e]/10 flex items-center justify-center">
          <span className="material-symbols-outlined text-[#1a7a5e]">check_circle</span>
        </div>
        <div>
          <h2 className="font-bold text-[#0d2137] text-lg">Viewing requested!</h2>
          <p className="text-sm text-[#6e7a74]">We&apos;ll confirm your slot within 24 hours.</p>
        </div>
      </div>

      <div className="bg-[#f6f3f2] rounded-lg p-4 space-y-3">
        <p className="font-semibold text-sm text-[#0d2137]">Pay your deposit now:</p>
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

      <a
        href="/dashboard/viewings"
        className="block w-full py-3 bg-[#0d2137] text-white rounded-lg text-sm font-semibold text-center hover:opacity-90"
      >
        View my viewings
      </a>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────

export function ViewingFlow({ propertyId, depositAmount }: Pick<Props, "propertyId" | "depositAmount">) {
  const [step,   setStep]   = useState<1 | 2 | 3>(1);
  const [date,   setDate]   = useState("");
  const [time,   setTime]   = useState("");
  const [notes,  setNotes]  = useState("");
  const [loading,setLoading]= useState(false);
  const [error,  setError]  = useState("");
  const [intent, setIntent] = useState<Intent | null>(null);

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
        body: JSON.stringify({ propertyId, preferredDate: date, preferredTime: time, notes }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setIntent(data.intent);
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
        {(["Schedule", "Confirm", "Payment"] as const).map((label, i) => (
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

      {step === 1 && <StepSchedule depositAmount={depositAmount} onNext={handleStep1} />}
      {step === 2 && (
        <StepConfirm
          date={date} time={time} notes={notes} depositAmount={depositAmount}
          onBack={() => setStep(1)} onConfirm={handleConfirm} loading={loading}
        />
      )}
      {step === 3 && intent && <StepPayment intent={intent} />}
    </div>
  );
}
