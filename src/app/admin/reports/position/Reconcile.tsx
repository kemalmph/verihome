"use client";

import { useState } from "react";

const fmt = (n: number) => new Intl.NumberFormat("id-ID").format(Math.round(n));

/**
 * Bank reconciliation. The ledger says what should be in the account; this asks
 * what is actually there. A variance is not a rounding issue — it means a real
 * movement was never recorded, so it is stated plainly rather than tucked away.
 */
export function Reconcile({ ledgerCash }: { ledgerCash: number }) {
  const [entered, setEntered] = useState("");
  const actual = entered === "" ? null : Number(entered.replace(/\D/g, ""));
  const variance = actual === null ? null : actual - ledgerCash;

  return (
    <div className="bg-white rounded-xl border border-[#cccccc] p-6">
      <h2 className="font-bold text-[#0d2137]">Rekonsiliasi bank</h2>
      <p className="text-sm text-[#6e7a74] mt-1 mb-5">
        Masukkan saldo rekening sebenarnya. Selisih berarti ada transaksi yang belum tercatat.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
        <div>
          <label className="text-xs font-semibold text-[#3e4944] uppercase tracking-wider block mb-1"
                 htmlFor="bank-balance">
            Saldo bank sebenarnya
          </label>
          <input
            id="bank-balance" type="text" inputMode="numeric"
            value={entered}
            onChange={(e) => setEntered(e.target.value.replace(/\D/g, ""))}
            placeholder="0"
            className="w-full h-11 px-4 rounded-lg border border-[#cccccc] focus:border-[#1a7a5e] focus:outline-none focus:ring-2 focus:ring-[#9cf4d1]/40 text-sm bg-white tabular-nums"
          />
        </div>

        <div>
          <p className="text-xs font-semibold text-[#3e4944] uppercase tracking-wider mb-1">Menurut buku besar</p>
          <p className="h-11 flex items-center text-sm font-semibold text-[#0d2137] tabular-nums">
            IDR {fmt(ledgerCash)}
          </p>
        </div>

        <div>
          <p className="text-xs font-semibold text-[#3e4944] uppercase tracking-wider mb-1">Selisih</p>
          <p className={`h-11 flex items-center text-sm font-bold tabular-nums ${
            variance === null ? "text-[#6e7a74]"
              : variance === 0 ? "text-[#0d8f66]" : "text-[#cf2f52]"
          }`}>
            {variance === null ? "—"
              : variance === 0 ? "Cocok"
              : `${variance > 0 ? "+" : "−"} IDR ${fmt(Math.abs(variance))}`}
          </p>
        </div>
      </div>

      {variance !== null && variance !== 0 && (
        <div className="mt-4 flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          <span className="material-symbols-outlined text-red-500 text-base">error</span>
          <span>
            {variance > 0
              ? "Ada uang di rekening yang belum tercatat di buku besar — kemungkinan pembayaran masuk yang belum diverifikasi."
              : "Buku besar mencatat lebih banyak kas daripada yang ada di rekening — kemungkinan pengeluaran yang belum dicatat."}
          </span>
        </div>
      )}
    </div>
  );
}
