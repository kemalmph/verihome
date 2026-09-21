"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveDefaultCommission } from "@/lib/actions/settings-actions";

interface Props {
  initialPct: number | null;
  updatedAt: string | null;
  updatedByName: string | null;
  /** Bookings already carrying a frozen rate, which a change here cannot touch. */
  unaffectedBookings: number;
}

export function CommissionSettingsForm({
  initialPct, updatedAt, updatedByName, unaffectedBookings,
}: Props) {
  const router = useRouter();
  const [pct, setPct]     = useState(initialPct === null ? "" : String(initialPct));
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  const dirty = pct !== (initialPct === null ? "" : String(initialPct));

  const parsed = pct.trim() === "" ? null : Number(pct.replace(",", "."));
  const valid  = parsed === null || (Number.isFinite(parsed) && parsed >= 0 && parsed <= 100);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(""); setSaved(false);

    const fd = new FormData();
    fd.set("default_commission_pct", pct.trim());
    const res = await saveDefaultCommission(fd);

    if (res?.error) { setError(res.error); return; }
    setSaved(true);
    startTransition(() => router.refresh());
  }

  // A worked example beats a percentage sign. 1,600,000 is the real value of
  // the booking that exposed all of this.
  const example = 1_600_000;
  const margin  = parsed === null ? null : Math.round((example * parsed) / 100);

  return (
    <form onSubmit={onSubmit} className="bg-white rounded-xl border border-[#cccccc] shadow-sm">
      <div className="p-6 border-b border-[#e4e2e1]">
        <h2 className="text-lg font-semibold text-[#0d2137]">Komisi platform bawaan</h2>
        <p className="text-sm text-[#3e4944] mt-1 max-w-2xl">
          Bagian VeriHome dari harga sewa untuk properti yang belum punya komisi
          sendiri. Properti dengan komisi khusus tetap memakai angka miliknya.
        </p>
      </div>

      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label
              htmlFor="default_commission_pct"
              className="block text-xs font-bold text-[#3e4944] uppercase tracking-wider mb-1.5"
            >
              Komisi bawaan (%)
            </label>
            <div className="relative">
              <input
                id="default_commission_pct"
                name="default_commission_pct"
                type="number" min={0} max={100} step="0.01"
                value={pct}
                onChange={(e) => { setPct(e.target.value); setSaved(false); setError(""); }}
                placeholder="mis. 15"
                className="w-full border border-[#cccccc] rounded-lg px-3 py-2 pr-9 text-[#0d2137] focus:outline-none focus:border-[#1a7a5e]"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6e7a74] text-sm">%</span>
            </div>

            {!valid && (
              <p className="text-xs text-red-600 mt-1.5">Harus antara 0 dan 100.</p>
            )}

            {valid && parsed === null && (
              <p className="text-xs text-amber-700 mt-1.5">
                Dikosongkan berarti tidak ada bawaan. Pemesanan pada properti tanpa
                komisi akan tercatat seluruhnya sebagai hak pemilik.
              </p>
            )}
          </div>

          {valid && parsed !== null && margin !== null && (
            <div className="border border-[#e4e2e1] rounded-lg overflow-hidden text-sm self-start">
              <div className="bg-[#f6f3f2] px-4 py-2 text-xs font-semibold text-[#3e4944] uppercase tracking-wider">
                Contoh — sewa {example.toLocaleString("id-ID")}
              </div>
              <div className="divide-y divide-[#f0eeed]">
                <div className="px-4 py-2.5 flex justify-between">
                  <span className="text-[#3e4944]">VeriHome</span>
                  <span className="font-semibold text-[#1a7a5e] tabular-nums">
                    {margin.toLocaleString("id-ID")}
                  </span>
                </div>
                <div className="px-4 py-2.5 flex justify-between">
                  <span className="text-[#3e4944]">Pemilik</span>
                  <span className="font-semibold text-[#0d2137] tabular-nums">
                    {(example - margin).toLocaleString("id-ID")}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* The question everyone asks first, answered with a number. */}
        <div className="bg-[#f6f3f2] border border-[#e4e2e1] rounded-lg p-4 flex items-start gap-3">
          <span className="material-symbols-outlined text-[#3e4944] text-lg">lock_clock</span>
          <div className="text-sm text-[#3e4944]">
            <p className="font-semibold text-[#0d2137]">
              Perubahan di sini tidak mengubah pemesanan yang sudah ada.
            </p>
            <p className="mt-1 max-w-2xl">
              Komisi dikunci pada saat pemesanan dibuat, jadi menginap yang sudah
              dijual tetap dihitung dengan angka yang berlaku waktu itu.{" "}
              {unaffectedBookings > 0 ? (
                <>
                  Saat ini ada{" "}
                  <strong className="text-[#0d2137]">{unaffectedBookings} pemesanan berjalan</strong>{" "}
                  yang tidak akan terpengaruh.
                </>
              ) : (
                <>Belum ada pemesanan berjalan yang terpengaruh.</>
              )}
            </p>
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-4 py-2.5">
            {error}
          </p>
        )}
      </div>

      <div className="px-6 py-4 border-t border-[#e4e2e1] flex items-center gap-4 flex-wrap">
        <button
          type="submit"
          disabled={!dirty || !valid || isPending}
          className="px-4 py-2 bg-[#1a7a5e] text-white text-sm font-semibold rounded-lg hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isPending ? "Menyimpan…" : "Simpan"}
        </button>

        {saved && !dirty && (
          <span className="text-sm text-[#1a7a5e] font-medium flex items-center gap-1">
            <span className="material-symbols-outlined text-base">check_circle</span>
            Tersimpan
          </span>
        )}

        {updatedAt && (
          <span className="text-xs text-[#6e7a74]">
            Terakhir diubah {new Date(updatedAt).toLocaleDateString("id-ID", {
              day: "numeric", month: "long", year: "numeric",
            })}
            {updatedByName ? ` oleh ${updatedByName}` : ""}
          </span>
        )}
      </div>
    </form>
  );
}
