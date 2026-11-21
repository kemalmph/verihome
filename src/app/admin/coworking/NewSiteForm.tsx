"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSite } from "@/lib/actions/coworking-actions";
import { SITE_STATUSES, SITE_TYPES } from "@/lib/coworking/taxonomy";

interface Props {
  owners: { id: string; name: string }[];
}

export function NewSiteForm({ owners }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    const fd = new FormData(e.currentTarget);
    const res = await createSite(fd);

    if (res?.error) {
      setError(res.error);
      return;
    }
    startTransition(() => {
      if (res.id) router.push(`/admin/coworking/${res.id}`);
      else router.refresh();
    });
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="px-4 py-2 rounded-lg bg-[#1a7a5e] text-white text-sm font-medium hover:bg-[#166750]"
      >
        Tambah site
      </button>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="bg-white border border-[#ddd7d4] rounded-lg p-6 max-w-2xl"
    >
      <h2 className="text-lg font-semibold text-[#0d2137] mb-1">Site baru</h2>
      <p className="text-sm text-[#6e7a74] mb-5">
        Gedungnya saja. Unit yang disewakan ditambahkan setelah ini.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Nama" className="sm:col-span-2">
          <input name="name" required autoFocus className={inputCls} placeholder="Cosystem Kemang" />
        </Field>

        <Field label="Tipe">
          <select name="site_type" defaultValue="coworking" className={inputCls}>
            {SITE_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </Field>

        <Field label="Area">
          <input name="area" className={inputCls} placeholder="Kemang" />
        </Field>

        <Field label="Status">
          <select name="status" defaultValue="draft" className={inputCls}>
            {SITE_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </Field>

        <Field label="Alamat" className="sm:col-span-2">
          <input name="address" className={inputCls} placeholder="Jl. Kemang Raya No. 88, Jakarta Selatan" />
        </Field>

        <Field label="Pemilik" hint="Opsional. Dipakai bersama dengan sisi sewa.">
          <select name="owner_id" defaultValue="" className={inputCls}>
            <option value="">— belum ditentukan —</option>
            {owners.map((o) => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </select>
        </Field>

        <Field label="Google Maps" hint="Opsional">
          <input name="google_maps_url" className={inputCls} placeholder="https://maps.app.goo.gl/…" />
        </Field>

        <Field label="Jam buka" hint="Kosongkan keduanya kalau buka 24 jam">
          <input type="time" name="opening_time" className={inputCls} />
        </Field>

        <Field label="Jam tutup">
          <input type="time" name="closing_time" className={inputCls} />
        </Field>

        <Field label="Catatan" className="sm:col-span-2">
          <textarea name="notes" rows={2} className={inputCls} />
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
          className="px-4 py-2 rounded-lg bg-[#1a7a5e] text-white text-sm font-medium hover:bg-[#166750] disabled:opacity-60"
        >
          {isPending ? "Menyimpan…" : "Simpan site"}
        </button>
        <button
          type="button"
          onClick={() => { setOpen(false); setError(""); }}
          className="px-4 py-2 rounded-lg border border-[#ddd7d4] text-sm text-[#3e4944] hover:bg-[#f6f3f2]"
        >
          Batal
        </button>
      </div>
    </form>
  );
}

const inputCls =
  "w-full border border-[#ddd7d4] rounded-lg px-3 py-2 text-sm text-[#0d2137] focus:outline-none focus:ring-2 focus:ring-[#1a7a5e]/30 focus:border-[#1a7a5e]";

function Field({
  label, hint, className = "", children,
}: {
  label: string; hint?: string; className?: string; children: React.ReactNode;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="block text-sm font-medium text-[#0d2137] mb-1">{label}</span>
      {children}
      {hint && <span className="block text-xs text-[#6e7a74] mt-1">{hint}</span>}
    </label>
  );
}
