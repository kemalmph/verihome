"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createEvent, setEventStatus, bookRoomForEvent } from "@/lib/actions/event-actions";

const inputCls =
  "w-full border border-line-strong rounded-lg px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand";

function Field({
  label, hint, className = "", children,
}: { label: string; hint?: string; className?: string; children: React.ReactNode }) {
  return (
    <label className={`block ${className}`}>
      <span className="block text-sm font-medium text-ink mb-1">{label}</span>
      {children}
      {hint && <span className="block text-xs text-ink-3 mt-1">{hint}</span>}
    </label>
  );
}

export function NewEventForm({
  siteId, units, defaultDay,
}: {
  siteId: string;
  units: { id: string; name: string; unit_type: string }[];
  defaultDay: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");
  const [isPending, startTransition] = useTransition();

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(""); setWarning("");
    const res = await createEvent(siteId, new FormData(e.currentTarget));
    if (res?.error) { setError(res.error); return; }
    if (res?.warning) setWarning(res.warning);
    setOpen(false);
    startTransition(() => router.refresh());
  }

  if (!open) {
    return (
      <div>
        {warning && (
          <p className="mb-3 text-sm text-[#8a6416] bg-[#fdf4e3] border border-[#e6d09a] rounded px-3 py-2">
            {warning}
          </p>
        )}
        <button
          onClick={() => setOpen(true)}
          className="px-4 py-2 rounded-lg bg-brand text-white text-sm font-medium hover:bg-brand-strong"
        >
          Tambah event
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="bg-white border border-line rounded-2xl p-6 max-w-3xl shadow-card">
      <h2 className="text-lg font-semibold text-ink mb-1">Event baru</h2>
      <p className="text-sm text-ink-3 mb-5">
        Jam event adalah jam acaranya. Ruangan dipesan terpisah, biasanya lebih
        lebar untuk persiapan dan beres-beres.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Judul" className="sm:col-span-2">
          <input name="title" required autoFocus className={inputCls} placeholder="Founder Friday" />
        </Field>

        <Field label="Mulai" hint="Waktu Jakarta">
          <input
            type="datetime-local"
            name="starts_at"
            required
            defaultValue={`${defaultDay}T18:00`}
            className={inputCls}
          />
        </Field>
        <Field label="Selesai">
          <input
            type="datetime-local"
            name="ends_at"
            required
            defaultValue={`${defaultDay}T21:00`}
            className={inputCls}
          />
        </Field>

        <Field label="Penyelenggara">
          <input name="host_name" className={inputCls} placeholder="Tim Cosystem" />
        </Field>
        <Field label="Perkiraan peserta">
          <input name="expected_attendees" type="number" min="0" className={inputCls} />
        </Field>

        <Field
          label="Pesan ruangan"
          className="sm:col-span-2"
          hint="Opsional sekarang, tapi event tidak bisa dikonfirmasi sebelum ruangannya dipesan"
        >
          <select name="unit_id" defaultValue="" className={inputCls}>
            <option value="">— belum pesan ruangan —</option>
            {units.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        </Field>

        <Field label="Waktu persiapan (menit)" hint="Ditambahkan sebelum dan sesudah acara">
          <select name="setup_minutes" defaultValue="60" className={inputCls}>
            <option value="0">Tanpa persiapan</option>
            <option value="30">30 menit</option>
            <option value="60">1 jam</option>
            <option value="120">2 jam</option>
          </select>
        </Field>

        <Field label="Visibilitas">
          <select name="visibility" defaultValue="internal" className={inputCls}>
            <option value="internal">Internal</option>
            <option value="members">Member</option>
            <option value="public">Publik</option>
          </select>
        </Field>

        <Field label="Deskripsi" className="sm:col-span-2">
          <textarea name="description" rows={2} className={inputCls} />
        </Field>
      </div>

      {error && (
        <p className="mt-4 text-sm text-[#8c3a2c] bg-[#fbeeec] border border-[#e2b3ab] rounded px-3 py-2">
          {error}
        </p>
      )}

      <div className="flex gap-3 mt-6">
        <button
          type="submit"
          disabled={isPending}
          className="px-4 py-2 rounded-lg bg-brand text-white text-sm font-medium hover:bg-brand-strong disabled:opacity-60"
        >
          {isPending ? "Menyimpan…" : "Simpan event"}
        </button>
        <button
          type="button"
          onClick={() => { setOpen(false); setError(""); }}
          className="px-4 py-2 rounded-lg border border-line-strong text-sm text-ink-2 hover:bg-canvas"
        >
          Batal
        </button>
      </div>
    </form>
  );
}

export function EventControls({
  siteId, eventId, status, hasGaps, units,
}: {
  siteId: string; eventId: string; status: string; hasGaps: boolean;
  units: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [booking, setBooking] = useState(false);
  const [, startTransition] = useTransition();

  const refresh = () => startTransition(() => router.refresh());

  async function change(status: string) {
    setBusy(true); setMsg("");
    const res = await setEventStatus(siteId, eventId, status);
    setBusy(false);
    if (res?.error) { setMsg(res.error); return; }
    refresh();
  }

  async function book(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const unitId = fd.get("unit_id") as string;
    const starts = fd.get("starts_at") as string;
    const ends = fd.get("ends_at") as string;
    if (!unitId || !starts || !ends) { setMsg("Pilih ruangan dan jamnya."); return; }
    setBusy(true); setMsg("");
    const res = await bookRoomForEvent(
      siteId, eventId, unitId,
      `${starts}:00+07:00`, `${ends}:00+07:00`, 0,
    );
    setBusy(false);
    if (res?.error) { setMsg(res.error); return; }
    setBooking(false);
    refresh();
  }

  return (
    <div className="mt-2">
      <div className="flex flex-wrap items-center gap-2">
        {status !== "confirmed" && (
          <button
            onClick={() => change("confirmed")}
            disabled={busy}
            className="text-xs px-2 py-1 rounded border border-success-line bg-success-soft text-success-ink hover:bg-[#d9eee5] disabled:opacity-60"
          >
            Konfirmasi
          </button>
        )}
        {status !== "cancelled" && (
          <button
            onClick={() => {
              if (confirm("Batalkan event ini? Booking ruangannya ikut dilepas.")) change("cancelled");
            }}
            disabled={busy}
            className="text-xs px-2 py-1 rounded border border-[#e2b3ab] bg-[#fbeeec] text-[#8c3a2c] hover:bg-[#f7e0dc] disabled:opacity-60"
          >
            Batalkan
          </button>
        )}
        {hasGaps && !booking && (
          <button
            onClick={() => { setBooking(true); setMsg(""); }}
            disabled={busy}
            className="text-xs px-2 py-1 rounded border border-line-strong bg-white text-ink-2 hover:bg-canvas"
          >
            Pesan ruangan
          </button>
        )}
      </div>

      {booking && (
        <form onSubmit={book} className="mt-2 flex flex-wrap items-end gap-2">
          <select name="unit_id" defaultValue="" className="text-xs border border-line-strong rounded px-2 py-1.5 bg-white">
            <option value="">— ruangan —</option>
            {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
          <input type="datetime-local" name="starts_at" className="text-xs border border-line-strong rounded px-2 py-1.5" />
          <input type="datetime-local" name="ends_at" className="text-xs border border-line-strong rounded px-2 py-1.5" />
          <button
            type="submit"
            disabled={busy}
            className="text-xs px-2 py-1.5 rounded bg-brand text-white hover:bg-brand-strong disabled:opacity-60"
          >
            Pesan
          </button>
          <button
            type="button"
            onClick={() => { setBooking(false); setMsg(""); }}
            className="text-xs px-2 py-1.5 rounded border border-line-strong text-ink-2"
          >
            Batal
          </button>
        </form>
      )}

      {msg && (
        <p className="mt-2 text-xs text-[#8c3a2c] bg-[#fbeeec] border border-[#e2b3ab] rounded px-2 py-1.5">
          {msg}
        </p>
      )}
    </div>
  );
}
