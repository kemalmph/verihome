"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addReservationItem, removeReservationItem, setReservationUtilities, createItem,
  type ResItem,
} from "@/lib/actions/reservation-detail-actions";

const rupiah = (n: number) => `Rp${Math.round(n).toLocaleString("id-ID")}`;
const inputCls =
  "w-full border border-[#ddd7d4] rounded-lg px-3 py-2 text-sm text-[#0d2137] focus:outline-none focus:ring-2 focus:ring-[#1a7a5e]/30 focus:border-[#1a7a5e]";

interface CatalogItem {
  id: string; name: string; unit: string; cost_price: number; sell_price: number; kind: string;
}

export function BookingItems({
  reservationId, siteId, items, catalog,
}: {
  reservationId: string; siteId: string; items: ResItem[]; catalog: CatalogItem[];
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [newItem, setNewItem] = useState(false);
  const [, startTransition] = useTransition();
  const refresh = () => startTransition(() => router.refresh());

  async function onAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(""); setBusy(true);
    const form = e.currentTarget;
    const res = await addReservationItem(reservationId, new FormData(form));
    setBusy(false);
    if (res?.error) { setError(res.error); return; }
    form.reset();
    refresh();
  }

  async function onRemove(rowId: string) {
    setBusy(true);
    const res = await removeReservationItem(reservationId, rowId);
    setBusy(false);
    if (res?.error) { setError(res.error); return; }
    refresh();
  }

  async function onNewItem(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(""); setBusy(true);
    const res = await createItem(siteId, new FormData(e.currentTarget));
    setBusy(false);
    if (res?.error) { setError(res.error); return; }
    setNewItem(false);
    refresh();
  }

  return (
    <section className="bg-white border border-[#ddd7d4] rounded-lg overflow-hidden">
      <h2 className="px-5 py-3 bg-[#efeae8] text-sm font-semibold text-[#0d2137]">
        Konsumsi &amp; barang
      </h2>

      {items.length === 0 ? (
        <p className="px-5 py-6 text-sm text-[#6e7a74]">
          Belum ada. Air mineral, kopi, cetak — apa pun yang keluar bersama booking ini.
        </p>
      ) : (
        <table className="w-full text-sm">
          <thead className="text-left">
            <tr className="border-b border-[#e8e3e0]">
              <Th>Item</Th><Th className="text-right">Jml</Th>
              <Th className="text-right">HPP</Th><Th className="text-right">Jual</Th><Th />
            </tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.id} className="border-b border-[#f0ecea] last:border-0">
                <td className="px-4 py-2.5">
                  <span className="text-[#0d2137]">{i.name}</span>
                  {i.included && (
                    <span className="ml-2 text-xs px-1.5 py-0.5 rounded-full border bg-[#eef2fb] text-[#2d4a86] border-[#b6c6e8]">
                      termasuk
                    </span>
                  )}
                  {i.notes && <div className="text-xs text-[#6e7a74]">{i.notes}</div>}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums text-[#3e4944]">{i.qty}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-[#3e4944]">
                  {rupiah(i.qty * i.cost_price)}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums text-[#3e4944]">
                  {i.included ? "—" : rupiah(i.qty * i.sell_price)}
                </td>
                <td className="px-3 py-2.5 text-right">
                  <button
                    onClick={() => onRemove(i.id)}
                    disabled={busy}
                    className="text-xs text-[#8c3a2c] hover:underline disabled:opacity-50"
                  >
                    hapus
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <form onSubmit={onAdd} className="px-5 py-4 border-t border-[#e8e3e0] flex flex-wrap items-end gap-2">
        <label className="block">
          <span className="block text-xs text-[#6e7a74] mb-1">Item</span>
          <select name="item_id" defaultValue="" className="border border-[#ddd7d4] rounded-lg px-3 py-2 text-sm bg-white min-w-48">
            <option value="">— pilih dari katalog —</option>
            {catalog.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} · HPP {rupiah(c.cost_price)} / jual {rupiah(c.sell_price)}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="block text-xs text-[#6e7a74] mb-1">Jumlah</span>
          <input name="qty" type="number" min="1" defaultValue={1} className="border border-[#ddd7d4] rounded-lg px-3 py-2 text-sm w-24" />
        </label>
        <label className="flex items-center gap-2 text-sm text-[#3e4944] pb-2.5">
          <input type="checkbox" name="included" className="rounded border-[#ddd7d4]" />
          Termasuk harga sewa
        </label>
        <button
          type="submit"
          disabled={busy}
          className="px-4 py-2 rounded-lg bg-[#1a7a5e] text-white text-sm font-medium hover:bg-[#166750] disabled:opacity-60"
        >
          Tambah
        </button>
        <button
          type="button"
          onClick={() => { setNewItem((v) => !v); setError(""); }}
          className="px-3 py-2 rounded-lg border border-[#ddd7d4] text-sm text-[#3e4944] hover:bg-[#f6f3f2]"
        >
          {newItem ? "Tutup" : "Item baru"}
        </button>
      </form>

      {newItem && (
        <form onSubmit={onNewItem} className="px-5 pb-5 flex flex-wrap items-end gap-2 border-t border-[#e8e3e0] pt-4">
          <label className="block">
            <span className="block text-xs text-[#6e7a74] mb-1">Nama</span>
            <input name="name" required className={`${inputCls} w-56`} placeholder="Air mineral 600ml" />
          </label>
          <label className="block">
            <span className="block text-xs text-[#6e7a74] mb-1">Satuan</span>
            <input name="unit" defaultValue="pcs" className={`${inputCls} w-24`} placeholder="botol" />
          </label>
          <label className="block">
            <span className="block text-xs text-[#6e7a74] mb-1">HPP</span>
            <input name="cost_price" type="number" min="0" defaultValue={0} className={`${inputCls} w-28`} />
          </label>
          <label className="block">
            <span className="block text-xs text-[#6e7a74] mb-1">Harga jual</span>
            <input name="sell_price" type="number" min="0" defaultValue={0} className={`${inputCls} w-28`} />
          </label>
          <button
            type="submit"
            disabled={busy}
            className="px-4 py-2 rounded-lg border border-[#1a7a5e] text-[#1a7a5e] text-sm font-medium hover:bg-[#e8f5f0] disabled:opacity-60"
          >
            Simpan item
          </button>
          <p className="w-full text-xs text-[#6e7a74] mt-1">
            Katalog ini dipakai bersama — nanti kafe dan merchandise memakai daftar yang sama.
          </p>
        </form>
      )}

      {error && (
        <p className="mx-5 mb-4 text-sm text-[#8c3a2c] bg-[#fbeeec] border border-[#e2b3ab] rounded px-3 py-2">
          {error}
        </p>
      )}
    </section>
  );
}

export function UtilitiesToggle({
  reservationId, included,
}: { reservationId: string; included: boolean }) {
  const router = useRouter();
  const [on, setOn] = useState(included);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [, startTransition] = useTransition();

  /**
   * The box moves when you click it, and moves back only if the save fails.
   *
   * It used to be driven entirely by the server value, so a click did nothing
   * visible until the round-trip and the refresh had both finished — the tick
   * snapped back under your cursor and the control read as broken. A test
   * caught it by clicking and finding the state unchanged, which is exactly
   * what a person would have seen.
   */
  async function toggle(next: boolean) {
    setOn(next);
    setBusy(true);
    setError("");
    const res = await setReservationUtilities(reservationId, next);
    setBusy(false);
    if (res?.error) {
      setOn(!next);                 // the database did not agree; neither should the page
      setError(res.error);
      return;
    }
    startTransition(() => router.refresh());
  }

  return (
    <div>
      <label className="flex items-start gap-2 text-sm text-[#3e4944]">
        <input
          type="checkbox"
          checked={on}
          disabled={busy}
          onChange={(e) => toggle(e.target.checked)}
          className="rounded border-[#ddd7d4] mt-0.5"
        />
        <span>
          Listrik &amp; internet termasuk
          <span className="block text-xs text-[#6e7a74]">
            Matikan kalau penyewa membayar sendiri, seperti kontrak RO6.
          </span>
        </span>
      </label>
      {error && (
        <p className="mt-2 text-sm text-[#8c3a2c] bg-[#fbeeec] border border-[#e2b3ab] rounded px-3 py-2">
          {error}
        </p>
      )}
    </div>
  );
}

function Th({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return (
    <th className={`px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-[#6e7a74] ${className}`}>
      {children}
    </th>
  );
}
