"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { confirmCreditRefund } from "@/lib/actions/credit-actions";

const rp = (n: number) => `Rp ${n.toLocaleString("id-ID")}`;

interface Pending {
  id: string;
  amount: number;
  requestedAt: string | null;
  who: string;
}

/**
 * Credit the guest has asked to have back as cash. It sits beside the other
 * pending refunds because it is the same obligation: money owed, waiting on a
 * transfer someone has to actually make.
 */
export function PendingCreditRefunds({ pending }: { pending: Pending[] }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  if (pending.length === 0) return null;

  async function onConfirm(id: string) {
    setError(""); setBusyId(id);
    const res = await confirmCreditRefund(id);
    setBusyId(null);
    if (res?.error) { setError(res.error); return; }
    startTransition(() => router.refresh());
  }

  const total = pending.reduce((s, p) => s + p.amount, 0);

  return (
    <div className="mb-10 bg-blue-50 border border-blue-200 rounded-xl p-5">
      <div className="flex items-start gap-3">
        <span className="material-symbols-outlined text-blue-600">currency_exchange</span>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-blue-900">
            {pending.length} penukaran kredit menunggu transfer — {rp(total)}
          </p>
          <p className="text-sm text-blue-800 mt-1 max-w-2xl">
            Kredit sudah dibekukan dan tidak bisa dipakai. Tandai lunas hanya
            setelah transfer benar-benar dikirim — konfirmasi inilah yang mencatat
            uang keluar di buku besar.
          </p>

          {error && (
            <p className="mt-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <ul className="mt-4 space-y-2">
            {pending.map((p) => (
              <li key={p.id} className="bg-white rounded-lg px-4 py-2.5 flex items-center justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[#0d2137]">
                    {p.who} — <span className="tabular-nums">{rp(p.amount)}</span>
                  </p>
                  {p.requestedAt && (
                    <p className="text-xs text-[#6e7a74]">
                      diminta {new Date(p.requestedAt).toLocaleDateString("id-ID", {
                        day: "numeric", month: "long", year: "numeric",
                      })}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => onConfirm(p.id)}
                  disabled={busyId === p.id}
                  className="px-3 py-1.5 bg-[#1a7a5e] text-white text-xs font-semibold rounded-lg hover:opacity-90 disabled:opacity-50 shrink-0"
                >
                  {busyId === p.id ? "Menyimpan…" : "Transfer sudah dikirim"}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
