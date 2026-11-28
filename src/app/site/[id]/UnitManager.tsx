"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createUnit, updateUnit, retireUnit, type UnitRow,
} from "@/lib/actions/coworking-actions";
import {
  UNIT_TYPES, LETTING_MODES, UNIT_STATUSES,
  lettingModeLabel, unitStatusLabel, pricePeriodLabel,
} from "@/lib/coworking/taxonomy";

const idr = (n: number) => new Intl.NumberFormat("id-ID").format(n);

export function UnitManager({ siteId, units, canEdit = true }: {
  siteId: string; units: UnitRow[];
  /** site.units on this site. Without it the list is read-only (the actions refuse regardless). */
  canEdit?: boolean;
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [, startTransition] = useTransition();

  const refresh = () => startTransition(() => router.refresh());

  async function submit(fd: FormData, fn: (f: FormData) => Promise<{ error?: string }>) {
    setError("");
    fd.set("site_id", siteId);
    const res = await fn(fd);
    if (res?.error) { setError(res.error); return false; }
    refresh();
    return true;
  }

  async function onRetire(unit: UnitRow) {
    if (!confirm(
      `Nonaktifkan "${unit.name}"?\n\nUnit tidak dihapus — ia keluar dari kapasitas dan dashboard, ` +
      `tapi riwayat yang menunjuk padanya tetap utuh.`
    )) return;
    const fd = new FormData();
    fd.set("id", unit.id);
    await submit(fd, retireUnit);
  }

  // Grouped by type so a site with forty desks does not read as forty rows of noise.
  const grouped = UNIT_TYPES
    .map((t) => ({ type: t.value, label: t.label, rows: units.filter((u) => u.unit_type === t.value) }))
    .filter((g) => g.rows.length > 0);

  return (
    <section className="bg-white border border-line rounded-2xl shadow-card overflow-hidden">
      <div className="flex items-center justify-between p-6 pb-4">
        <div>
          <h2 className="text-lg font-semibold text-ink">Unit</h2>
          <p className="text-sm text-ink-3 mt-0.5">
            Apa pun di site ini yang menghasilkan uang dari ruang
          </p>
        </div>
        {canEdit && !adding && (
          <button
            onClick={() => { setAdding(true); setEditingId(null); setError(""); }}
            className="px-3 py-2 rounded-lg bg-brand text-white text-sm font-medium hover:bg-brand-strong"
          >
            Tambah unit
          </button>
        )}
      </div>

      {error && (
        <p className="mx-6 mb-4 text-sm text-[#8c3a2c] bg-[#fbeeec] border border-[#e2b3ab] rounded px-3 py-2">
          {error}
        </p>
      )}

      {adding && (
        <div className="mx-6 mb-6">
          <UnitForm
            mode="create"
            onCancel={() => setAdding(false)}
            onSubmit={async (fd) => { if (await submit(fd, createUnit)) setAdding(false); }}
          />
        </div>
      )}

      {units.length === 0 && !adding ? (
        <div className="px-6 pb-10 pt-4 text-center">
          <p className="text-ink font-semibold">Belum ada unit</p>
          <p className="text-ink-3 text-sm mt-1 max-w-md mx-auto">
            Meja, ruang rapat, lot ritel, atau area kafe. Tipe menyebut wujudnya;
            cara sewa menyebut bagaimana ia disewakan.
          </p>
        </div>
      ) : (
        <div className="border-t border-[#e8e3e0]">
          {grouped.map((g) => (
            <div key={g.type}>
              <div className="px-6 py-2 bg-canvas text-xs font-semibold uppercase tracking-wide text-ink-3">
                {g.label} · {g.rows.length}
              </div>
              {g.rows.map((u) =>
                editingId === u.id ? (
                  <div key={u.id} className="px-6 py-4 bg-[#faf9f8]">
                    <UnitForm
                      mode="edit"
                      unit={u}
                      onCancel={() => setEditingId(null)}
                      onSubmit={async (fd) => {
                        fd.set("id", u.id);
                        if (await submit(fd, updateUnit)) setEditingId(null);
                      }}
                    />
                  </div>
                ) : (
                  <div
                    key={u.id}
                    className="px-6 py-3 border-t border-[#e8e3e0] flex items-center gap-4 hover:bg-[#faf9f8]"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-ink">
                        {u.name}
                        {u.floor && <span className="text-ink-3 font-normal"> · {u.floor}</span>}
                      </div>
                      <div className="text-xs text-ink-3 mt-0.5">
                        {lettingModeLabel(u.letting_mode)} · kapasitas {u.capacity}
                        {u.size_sqm ? ` · ${u.size_sqm} m²` : ""}
                      </div>
                    </div>

                    <div className="text-sm tabular-nums text-ink-2 whitespace-nowrap">
                      {u.price === null
                        ? <span className="text-ink-3">belum ada harga</span>
                        : <>IDR {idr(Number(u.price))}<span className="text-ink-3">{pricePeriodLabel(u.letting_mode)}</span></>}
                    </div>

                    <UnitStatusPill status={u.status} />

                    {canEdit && <div className="flex gap-2">
                      <button
                        onClick={() => { setEditingId(u.id); setAdding(false); setError(""); }}
                        className="text-sm text-brand-ink hover:underline"
                      >
                        Ubah
                      </button>
                      {u.status !== "retired" && (
                        <button
                          onClick={() => onRetire(u)}
                          className="text-sm text-[#8c3a2c] hover:underline"
                        >
                          Nonaktifkan
                        </button>
                      )}
                    </div>}
                  </div>
                )
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function UnitStatusPill({ status }: { status: string }) {
  const tone =
    status === "available" ? "bg-success-soft text-success-ink border-success-line"
    : status === "maintenance" ? "bg-[#fdf4e3] text-[#7a5518] border-[#e4c894]"
    : "bg-[#efeae8] text-ink-3 border-line-strong";
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border whitespace-nowrap ${tone}`}>
      {unitStatusLabel(status)}
    </span>
  );
}

function UnitForm({
  mode, unit, onSubmit, onCancel,
}: {
  mode: "create" | "edit";
  unit?: UnitRow;
  onSubmit: (fd: FormData) => Promise<void>;
  onCancel: () => void;
}) {
  const [busy, setBusy] = useState(false);

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        await onSubmit(new FormData(e.currentTarget));
        setBusy(false);
      }}
      className="border border-line rounded-2xl p-4 bg-white shadow-card"
    >
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <L label="Nama" className="col-span-2">
          <input name="name" required defaultValue={unit?.name ?? ""} placeholder="Desk A-12" className={i} />
        </L>
        <L label="Tipe">
          <select name="unit_type" defaultValue={unit?.unit_type ?? "hot_desk"} className={i}>
            {UNIT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </L>
        <L label="Cara sewa">
          <select name="letting_mode" defaultValue={unit?.letting_mode ?? "monthly"} className={i}>
            {LETTING_MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </L>
        <L label="Kapasitas">
          <input type="number" name="capacity" min={1} step={1} defaultValue={unit?.capacity ?? 1} className={i} />
        </L>
        <L label="Harga (IDR)" hint="Kosongkan bila belum ditentukan">
          <input name="price" inputMode="numeric" defaultValue={unit?.price ?? ""} className={i} />
        </L>
        <L label="Lantai">
          <input name="floor" defaultValue={unit?.floor ?? ""} className={i} />
        </L>
        <L label="Luas (m²)">
          <input name="size_sqm" inputMode="decimal" defaultValue={unit?.size_sqm ?? ""} className={i} />
        </L>
        {mode === "edit" && (
          <L label="Status" hint="Kelayakan disewakan, bukan terisi atau tidak">
            <select name="status" defaultValue={unit?.status ?? "available"} className={i}>
              {UNIT_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </L>
        )}
        <L label="Catatan" className="col-span-2 md:col-span-4">
          <input name="notes" defaultValue={unit?.notes ?? ""} className={i} />
        </L>
      </div>

      <div className="flex gap-3 mt-4">
        <button
          type="submit"
          disabled={busy}
          className="px-3 py-1.5 rounded-lg bg-brand text-white text-sm font-medium hover:bg-brand-strong disabled:opacity-60"
        >
          {busy ? "Menyimpan…" : mode === "create" ? "Tambah" : "Simpan"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 rounded-lg border border-line-strong text-sm text-ink-2 hover:bg-canvas"
        >
          Batal
        </button>
      </div>
    </form>
  );
}

const i =
  "w-full border border-line-strong rounded-lg px-2.5 py-1.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand";

function L({
  label, hint, className = "", children,
}: {
  label: string; hint?: string; className?: string; children: React.ReactNode;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="block text-xs font-medium text-ink mb-1">{label}</span>
      {children}
      {hint && <span className="block text-[11px] text-ink-3 mt-0.5">{hint}</span>}
    </label>
  );
}
