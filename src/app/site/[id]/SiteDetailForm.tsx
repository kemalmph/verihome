"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateSite } from "@/lib/actions/coworking-actions";
import { SITE_STATUSES, SITE_TYPES } from "@/lib/coworking/taxonomy";

interface Site {
  id: string;
  name: string;
  status: string;
  site_type: string;
  area: string | null;
  address: string | null;
  google_maps_url: string | null;
  owner_id: string | null;
  opening_time: string | null;
  closing_time: string | null;
  notes: string | null;
}

export function SiteDetailForm({
  site, owners,
}: {
  site: Site;
  owners: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(""); setSaved(false);

    const fd = new FormData(e.currentTarget);
    fd.set("id", site.id);
    const res = await updateSite(fd);

    if (res?.error) { setError(res.error); return; }
    setSaved(true);
    startTransition(() => router.refresh());
  }

  // <input type="time"> wants HH:MM; Postgres hands back HH:MM:SS.
  const hhmm = (t: string | null) => (t ? t.slice(0, 5) : "");

  return (
    <form
      onSubmit={onSubmit}
      className="bg-white border border-line rounded-2xl p-6 mb-10 shadow-card"
    >
      <h2 className="text-lg font-semibold text-ink mb-5">Detail site</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Nama" className="sm:col-span-2">
          <input name="name" required defaultValue={site.name} className={inputCls} />
        </Field>

        <Field label="Tipe">
          <select name="site_type" defaultValue={site.site_type} className={inputCls}>
            {SITE_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </Field>

        <Field label="Area">
          <input name="area" defaultValue={site.area ?? ""} className={inputCls} />
        </Field>

        <Field label="Status">
          <select name="status" defaultValue={site.status} className={inputCls}>
            {SITE_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </Field>

        <Field label="Alamat" className="sm:col-span-2">
          <input name="address" defaultValue={site.address ?? ""} className={inputCls} />
        </Field>

        <Field label="Pemilik">
          <select name="owner_id" defaultValue={site.owner_id ?? ""} className={inputCls}>
            <option value="">— belum ditentukan —</option>
            {owners.map((o) => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </select>
        </Field>

        <Field label="Google Maps">
          <input name="google_maps_url" defaultValue={site.google_maps_url ?? ""} className={inputCls} />
        </Field>

        <Field label="Jam buka" hint="Kosongkan keduanya kalau buka 24 jam">
          <input type="time" name="opening_time" defaultValue={hhmm(site.opening_time)} className={inputCls} />
        </Field>

        <Field label="Jam tutup">
          <input type="time" name="closing_time" defaultValue={hhmm(site.closing_time)} className={inputCls} />
        </Field>

        <Field label="Catatan" className="sm:col-span-2">
          <textarea name="notes" rows={2} defaultValue={site.notes ?? ""} className={inputCls} />
        </Field>
      </div>

      {error && (
        <p className="mt-4 text-sm text-[#8c3a2c] bg-[#fbeeec] border border-[#e2b3ab] rounded px-3 py-2">
          {error}
        </p>
      )}
      {saved && !error && (
        <p className="mt-4 text-sm text-success-ink bg-success-soft border border-success-line rounded px-3 py-2">
          Tersimpan.
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="mt-6 px-4 py-2 rounded-lg bg-brand text-white text-sm font-medium hover:bg-brand-strong disabled:opacity-60"
      >
        {isPending ? "Menyimpan…" : "Simpan perubahan"}
      </button>
    </form>
  );
}

const inputCls =
  "w-full border border-line-strong rounded-lg px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand";

function Field({
  label, hint, className = "", children,
}: {
  label: string; hint?: string; className?: string; children: React.ReactNode;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="block text-sm font-medium text-ink mb-1">{label}</span>
      {children}
      {hint && <span className="block text-xs text-ink-3 mt-1">{hint}</span>}
    </label>
  );
}
