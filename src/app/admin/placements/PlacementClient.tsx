"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { recordPlacement, markPlacementPaid, updatePlacementStatus } from "@/lib/actions/placement-actions";

const input = "w-full h-11 px-4 rounded-lg border border-[#cccccc] focus:border-[#1a7a5e] focus:outline-none focus:ring-2 focus:ring-[#9cf4d1]/40 text-sm bg-white";
const labelCls = "text-xs font-semibold text-[#3e4944] uppercase tracking-wider block mb-1";
const fmt = (n: number) => new Intl.NumberFormat("id-ID").format(n);

const STATUS_LABEL: Record<string, string> = {
  reported: "Dilaporkan", invoiced: "Ditagih", paid: "Lunas",
  disputed: "Disengketakan", written_off: "Dihapusbukukan",
};
const STATUS_STYLE: Record<string, string> = {
  reported: "bg-blue-100 text-blue-800", invoiced: "bg-amber-100 text-amber-800",
  paid: "bg-green-100 text-green-800", disputed: "bg-red-100 text-red-700",
  written_off: "bg-[#f6f3f2] text-[#3e4944]",
};

export function PlacementForm({ properties }: { properties: { id: string; name: string; area: string | null }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [rent, setRent] = useState("");
  const [pct, setPct] = useState("");
  const [error, setError] = useState("");
  const [isPending, start] = useTransition();

  const preview = Math.round((Number(rent || 0) * Number(pct || 0)) / 100);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const formData = new FormData(e.currentTarget);
    start(async () => {
      const res = await recordPlacement(formData);
      if (res?.error) { setError(res.error); return; }
      setOpen(false); setRent(""); setPct("");
      router.refresh();
    });
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="px-5 py-2.5 bg-[#1a7a5e] text-white rounded-lg font-semibold text-sm hover:opacity-90 flex items-center gap-2"
      >
        <span className="material-symbols-outlined text-lg">add</span>
        Catat penempatan
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-[#cccccc] p-6 space-y-5">
      <h2 className="font-semibold text-[#0d2137]">Catat penempatan baru</h2>

      {error && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          <span className="material-symbols-outlined text-red-500 text-base">error</span>{error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <label className={labelCls} htmlFor="property_id">Properti *</label>
          <select id="property_id" name="property_id" required className={input} defaultValue="">
            <option value="" disabled>Pilih properti</option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>{p.name}{p.area ? ` — ${p.area}` : ""}</option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelCls} htmlFor="monthly_rent">Sewa per bulan (IDR) *</label>
          <input id="monthly_rent" name="monthly_rent" type="text" inputMode="numeric" required
            value={rent} onChange={(e) => setRent(e.target.value.replace(/\D/g, ""))}
            placeholder="15000000" className={input} />
        </div>

        <div>
          <label className={labelCls} htmlFor="commission_pct">Komisi (%) *</label>
          <input id="commission_pct" name="commission_pct" type="number" min={0} max={100} step="0.01" required
            value={pct} onChange={(e) => setPct(e.target.value)}
            placeholder="8" className={input} />
        </div>

        <div>
          <label className={labelCls} htmlFor="lease_start_date">Mulai sewa</label>
          <input id="lease_start_date" name="lease_start_date" type="date" className={input} />
        </div>

        <div>
          <label className={labelCls} htmlFor="reported_by">Dilaporkan oleh</label>
          <select id="reported_by" name="reported_by" className={input} defaultValue="team">
            <option value="team">Tim VeriHome</option>
            <option value="owner">Pemilik</option>
            <option value="tenant">Penyewa</option>
          </select>
        </div>

        <div className="md:col-span-2">
          <label className={labelCls} htmlFor="notes">Catatan</label>
          <textarea id="notes" name="notes" rows={2}
            className="w-full px-4 py-3 rounded-lg border border-[#cccccc] focus:border-[#1a7a5e] focus:outline-none text-sm bg-white" />
        </div>
      </div>

      {preview > 0 && (
        <div className="bg-[#e8f5f0] border border-[#9cf4d1] rounded-lg px-4 py-3 text-sm">
          <span className="text-[#12614a]">Komisi tercatat sebagai piutang: </span>
          <strong className="text-[#12614a] tabular-nums">IDR {fmt(preview)}</strong>
        </div>
      )}

      <div className="flex gap-3">
        <button type="submit" disabled={isPending}
          className="flex-1 py-3 bg-[#1a7a5e] text-white rounded-lg font-semibold text-sm hover:opacity-90 disabled:opacity-50">
          {isPending ? "Menyimpan…" : "Simpan penempatan"}
        </button>
        <button type="button" onClick={() => setOpen(false)}
          className="px-5 py-3 border border-[#cccccc] text-[#3e4944] rounded-lg font-semibold text-sm hover:border-[#1a7a5e]">
          Batal
        </button>
      </div>
    </form>
  );
}

export function PlacementRow({ placement }: {
  placement: {
    id: string; propertyName: string; area: string | null;
    monthlyRent: number; commissionPct: number; commissionAmount: number;
    status: string; leaseStart: string | null;
  };
}) {
  const router = useRouter();
  const [isPending, start] = useTransition();
  const [error, setError] = useState("");

  function act(fn: () => Promise<{ error?: string } | undefined>) {
    setError("");
    start(async () => {
      const res = await fn();
      if (res?.error) { setError(res.error); return; }
      router.refresh();
    });
  }

  return (
    <tr className="hover:bg-[#f6f3f2]">
      <td className="px-5 py-3">
        <p className="font-semibold text-[#0d2137]">{placement.propertyName}</p>
        {placement.area && <p className="text-xs text-[#6e7a74]">{placement.area}</p>}
        {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
      </td>
      <td className="px-5 py-3 text-right tabular-nums text-[#3e4944]">IDR {fmt(placement.monthlyRent)}</td>
      <td className="px-5 py-3 text-right tabular-nums">
        <span className="font-semibold text-[#0d2137]">IDR {fmt(placement.commissionAmount)}</span>
        <span className="block text-xs text-[#6e7a74]">{placement.commissionPct}%</span>
      </td>
      <td className="px-5 py-3 text-xs text-[#6e7a74]">{placement.leaseStart ?? "—"}</td>
      <td className="px-5 py-3">
        <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${STATUS_STYLE[placement.status] ?? ""}`}>
          {STATUS_LABEL[placement.status] ?? placement.status}
        </span>
      </td>
      <td className="px-5 py-3 text-right whitespace-nowrap">
        {placement.status !== "paid" && placement.status !== "written_off" && (
          <div className="flex items-center gap-2 justify-end">
            {placement.status === "reported" && (
              <button disabled={isPending}
                onClick={() => act(() => updatePlacementStatus(placement.id, "invoiced"))}
                className="text-xs font-semibold text-[#3e4944] hover:text-[#1a7a5e] disabled:opacity-50">
                Tandai ditagih
              </button>
            )}
            <button disabled={isPending}
              onClick={() => act(() => markPlacementPaid(placement.id))}
              className="text-xs font-semibold text-[#1a7a5e] hover:underline disabled:opacity-50">
              Tandai lunas
            </button>
          </div>
        )}
      </td>
    </tr>
  );
}
