"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { requestCreditRefund } from "@/lib/actions/credit-actions";
import type { RefundableCredit } from "@/lib/actions/credit-actions";

const rp = (n: number) => `Rp ${n.toLocaleString("id-ID")}`;

/**
 * "Tukar jadi uang" — shown only while a credit is genuinely exchangeable.
 * The server checks the same conditions; this decides what is visible, not
 * what is permitted.
 */
export function CreditCashbackCard({ credits }: { credits: RefundableCredit[] }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  if (credits.length === 0) return null;

  async function onRequest(id: string) {
    setError(""); setBusyId(id);
    const res = await requestCreditRefund(id);
    setBusyId(null);
    if (res?.error) { setError(res.error); return; }
    startTransition(() => router.refresh());
  }

  return (
    <section className="bg-white rounded-xl border border-[#cccccc] shadow-sm overflow-hidden">
      <div className="px-5 py-3 border-b border-[#e4e2e1]">
        <p className="font-semibold text-sm text-[#0d2137]">
          Tukar kredit jadi uang
          <span className="font-normal text-[#6e7a74]"> / Exchange credit for cash</span>
        </p>
        <p className="text-xs text-[#6e7a74] mt-0.5">
          Kredit dari titipan viewing yang belum terpakai.
        </p>
      </div>

      {error && (
        <p className="mx-5 mt-4 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <ul className="divide-y divide-[#f0eeed]">
        {credits.map((c) => {
          const pending = c.status === "refund_requested";
          return (
            <li key={c.id} className="px-5 py-4 flex items-center justify-between gap-4 flex-wrap">
              <div className="min-w-0">
                <p className="font-semibold text-[#0d2137] tabular-nums">{rp(c.amount)}</p>
                <p className="text-xs text-[#6e7a74] mt-0.5">
                  {pending ? (
                    "Menunggu transfer dari VeriHome / Awaiting transfer"
                  ) : c.daysLeft > 0 ? (
                    <>Sisa {c.daysLeft} hari untuk menukar / {c.daysLeft} days left</>
                  ) : (
                    "Batas penukaran sudah lewat / Window closed"
                  )}
                </p>
              </div>

              {pending ? (
                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 shrink-0">
                  diproses
                </span>
              ) : (
                <button
                  onClick={() => onRequest(c.id)}
                  disabled={busyId === c.id || c.daysLeft === 0}
                  className="px-3 py-1.5 border border-[#1a7a5e] text-[#1a7a5e] text-xs font-semibold rounded-lg hover:bg-[#e8f5f0] disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                >
                  {busyId === c.id ? "Mengirim…" : "Tukar jadi uang"}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
