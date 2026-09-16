"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { recordSpend } from "@/lib/actions/expense-actions";

const input = "w-full h-11 px-4 rounded-lg border border-[#cccccc] focus:border-[#1a7a5e] focus:outline-none focus:ring-2 focus:ring-[#9cf4d1]/40 text-sm bg-white";
const labelCls = "text-xs font-semibold text-[#3e4944] uppercase tracking-wider block mb-1";
const fmt = (n: number) => new Intl.NumberFormat("id-ID").format(Math.round(n));

export function SpendForm({ available }: { available: number }) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");
  const [isPending, start] = useTransition();

  const value = Number(amount || 0);
  // Warn before the fact rather than only showing red on the statement after.
  const wouldOverdraw = value > 0 && value > available;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const res = await recordSpend(fd);
      if (res?.error) { setError(res.error); return; }
      setAmount("");
      (e.target as HTMLFormElement).reset();
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-[#cccccc] p-6 space-y-5">
      <h2 className="font-bold text-[#0d2137]">Catat pengeluaran</h2>

      {error && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          <span className="material-symbols-outlined text-red-500 text-base">error</span>{error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className={labelCls} htmlFor="kind">Jenis</label>
          <select id="kind" name="kind" className={input} defaultValue="operating">
            <option value="operating">Biaya operasional</option>
            <option value="drawing">Penarikan pemilik</option>
          </select>
        </div>
        <div>
          <label className={labelCls} htmlFor="amount">Jumlah (IDR)</label>
          <input id="amount" name="amount" type="text" inputMode="numeric" required
            value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))}
            placeholder="0" className={input} />
        </div>
        <div className="md:col-span-2">
          <label className={labelCls} htmlFor="description">Keterangan</label>
          <input id="description" name="description" required
            placeholder="mis. Gaji tim September" className={input} />
        </div>
      </div>

      {wouldOverdraw && (
        <div className="flex items-start gap-2 bg-[#cf2f52] text-white rounded-lg px-4 py-3 text-sm">
          <span className="material-symbols-outlined text-base">warning</span>
          <span>
            Jumlah ini melebihi dana milik VeriHome (IDR {fmt(Math.max(0, available))}).
            Mencatatnya berarti memakai uang jaminan, kredit pengguna, atau hak pemilik properti.
          </span>
        </div>
      )}

      <button type="submit" disabled={isPending}
        className="px-6 py-2.5 bg-[#1a7a5e] text-white rounded-lg font-semibold text-sm hover:opacity-90 disabled:opacity-50">
        {isPending ? "Menyimpan…" : "Catat pengeluaran"}
      </button>
    </form>
  );
}
