"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createMembership, createPlan, setMembershipStatus, setMembershipPayment,
  type PlanRow,
} from "@/lib/actions/membership-actions";
import { RESERVATION_STATUSES, PAYMENT_STATUSES } from "@/lib/coworking/taxonomy";

const inputCls =
  "w-full border border-[#ddd7d4] rounded-lg px-3 py-2 text-sm text-[#0d2137] focus:outline-none focus:ring-2 focus:ring-[#1a7a5e]/30 focus:border-[#1a7a5e]";

function Field({
  label, hint, className = "", children,
}: { label: string; hint?: string; className?: string; children: React.ReactNode }) {
  return (
    <label className={`block ${className}`}>
      <span className="block text-sm font-medium text-[#0d2137] mb-1">{label}</span>
      {children}
      {hint && <span className="block text-xs text-[#6e7a74] mt-1">{hint}</span>}
    </label>
  );
}

function Check({ name, label }: { name: string; label: string }) {
  return (
    <label className="flex items-center gap-2 text-sm text-[#3e4944]">
      <input type="checkbox" name={name} className="rounded border-[#ddd7d4]" />
      {label}
    </label>
  );
}

/** Membership statuses reuse the reservation vocabulary where it overlaps. */
const MEMBERSHIP_STATUSES = RESERVATION_STATUSES.filter((s) =>
  ["pending", "cancelled"].includes(s.value),
);

export function NewMembershipForm({ siteId, plans }: { siteId: string; plans: PlanRow[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");
  const [isPending, startTransition] = useTransition();

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(""); setWarning("");
    const res = await createMembership(siteId, new FormData(e.currentTarget));
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
          className="px-4 py-2 rounded-lg bg-[#1a7a5e] text-white text-sm font-medium hover:bg-[#166750]"
        >
          Tambah member
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="bg-white border border-[#ddd7d4] rounded-lg p-6 max-w-3xl">
      <h2 className="text-lg font-semibold text-[#0d2137] mb-1">Member baru</h2>
      <p className="text-sm text-[#6e7a74] mb-5">
        Member adalah orang. Kalau yang membayar perusahaan, isi nama orangnya di
        atas dan nama perusahaan di kolom penagihan.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Nama member" className="sm:col-span-2">
          <input name="member_name" required autoFocus className={inputCls} placeholder="Budi Santoso" />
        </Field>

        <Field label="Kontak" hint="Telepon atau email">
          <input name="member_contact" className={inputCls} placeholder="0812-…" />
        </Field>

        <Field label="Ditagihkan ke" hint="Opsional — kalau dibayar perusahaan">
          <input name="company_name" className={inputCls} placeholder="PT Contoh Nusantara" />
        </Field>

        <Field label="Paket" className="sm:col-span-2" hint="Entitlement disalin dari paket saat disimpan, dan tidak ikut berubah kalau paketnya nanti diubah">
          <select name="plan_id" defaultValue="" className={inputCls}>
            <option value="">— tanpa paket —</option>
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · Rp{p.price.toLocaleString("id-ID")}/{p.period === "yearly" ? "tahun" : "bulan"}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Mulai">
          <input type="date" name="starts_on" required className={inputCls} />
        </Field>
        <Field label="Selesai">
          <input type="date" name="ends_on" required className={inputCls} />
        </Field>

        <Field label="Harga" hint="Kosongkan untuk memakai harga paket">
          <input name="price" type="number" min="0" className={inputCls} />
        </Field>

        <Field label="Status pembayaran">
          <select name="payment_status" defaultValue="unpaid" className={inputCls}>
            {PAYMENT_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </Field>

        <Field label="No. kontrak" hint="Opsional">
          <input name="contract_ref" className={inputCls} />
        </Field>

        <Field label="Status">
          <select name="status" defaultValue="pending" className={inputCls}>
            <option value="pending">Menunggu</option>
            <option value="active">Aktif</option>
          </select>
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
          {isPending ? "Menyimpan…" : "Simpan member"}
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

export function NewPlanForm({ siteId }: { siteId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const res = await createPlan(siteId, new FormData(e.currentTarget));
    if (res?.error) { setError(res.error); return; }
    setOpen(false);
    startTransition(() => router.refresh());
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="px-3 py-1.5 rounded-lg border border-[#ddd7d4] text-sm text-[#3e4944] bg-white hover:bg-[#f6f3f2]"
      >
        Tambah paket
      </button>
    );
  }

  return (
    <form onSubmit={onSubmit} className="bg-white border border-[#ddd7d4] rounded-lg p-6 max-w-3xl mt-4">
      <h3 className="text-base font-semibold text-[#0d2137] mb-4">Paket baru</h3>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Field label="Nama paket" className="sm:col-span-2">
          <input name="name" required autoFocus className={inputCls} placeholder="Virtual Office 3" />
        </Field>
        <Field label="Periode">
          <select name="period" defaultValue="yearly" className={inputCls}>
            <option value="monthly">Bulanan</option>
            <option value="yearly">Tahunan</option>
          </select>
        </Field>

        <Field label="Harga">
          <input name="price" type="number" min="0" required className={inputCls} placeholder="7200000" />
        </Field>
        <Field label="Day pass / bulan">
          <input name="day_passes_per_month" type="number" min="0" defaultValue={0} className={inputCls} />
        </Field>
        <Field label="Jam ruang rapat / bulan">
          <input name="meeting_room_hours_per_month" type="number" min="0" step="0.5" defaultValue={0} className={inputCls} />
        </Field>

        <Field label="Diskon (%)" hint="Untuk event & ruang rapat">
          <input name="discount_pct" type="number" min="0" max="100" defaultValue={0} className={inputCls} />
        </Field>

        <div className="sm:col-span-2 grid grid-cols-2 gap-2 pt-7">
          <Check name="hot_desk_included" label="Hot desk termasuk" />
          <Check name="mail_handling" label="Terima surat" />
          <Check name="address_use" label="Alamat perusahaan" />
          <Check name="all_sites" label="Berlaku di semua site" />
        </div>

        <Field label="Catatan" className="sm:col-span-3">
          <textarea name="notes" rows={2} className={inputCls} />
        </Field>
      </div>

      {error && (
        <p className="mt-4 text-sm text-[#8c3a2c] bg-[#fbeeec] border border-[#e2b3ab] rounded px-3 py-2">
          {error}
        </p>
      )}

      <div className="flex gap-3 mt-5">
        <button
          type="submit"
          disabled={isPending}
          className="px-4 py-2 rounded-lg bg-[#1a7a5e] text-white text-sm font-medium hover:bg-[#166750] disabled:opacity-60"
        >
          {isPending ? "Menyimpan…" : "Simpan paket"}
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

export function MembershipControls({
  siteId, membershipId, status, paymentStatus,
}: {
  siteId: string; membershipId: string; status: string; paymentStatus: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();

  const change = async (fn: () => Promise<{ error?: string }>) => {
    setBusy(true);
    const res = await fn();
    setBusy(false);
    if (res?.error) { alert(res.error); return; }
    startTransition(() => router.refresh());
  };

  return (
    <div className="flex gap-1.5">
      <select
        value={status}
        disabled={busy}
        onChange={(e) => change(() => setMembershipStatus(siteId, membershipId, e.target.value))}
        className="text-xs border border-[#ddd7d4] rounded px-1.5 py-1 bg-white"
      >
        <option value="pending">Menunggu</option>
        <option value="active">Aktif</option>
        <option value="expired">Berakhir</option>
        <option value="cancelled">Dibatalkan</option>
      </select>
      <select
        value={paymentStatus}
        disabled={busy}
        onChange={(e) => change(() => setMembershipPayment(siteId, membershipId, e.target.value))}
        className="text-xs border border-[#ddd7d4] rounded px-1.5 py-1 bg-white"
      >
        {PAYMENT_STATUSES.map((s) => (
          <option key={s.value} value={s.value}>{s.label}</option>
        ))}
      </select>
    </div>
  );
}

export { MEMBERSHIP_STATUSES };
