"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { removeDocument, type ResDocument } from "@/lib/actions/reservation-detail-actions";

const KINDS: [value: string, label: string][] = [
  ["contract", "Kontrak"],
  ["amendment", "Adendum"],
  ["invoice", "Invoice"],
  ["receipt", "Kuitansi"],
  ["id_card", "KTP / identitas"],
  ["floor_plan", "Denah"],
  ["certificate", "Sertifikat / izin"],
  ["other", "Lainnya"],
];

const kindLabel = (v: string) => KINDS.find(([k]) => k === v)?.[1] ?? v;
const size = (b: number) => (b < 1024 * 1024 ? `${Math.round(b / 1024)} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`);
const tanggal = (iso: string) =>
  new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta", day: "numeric", month: "short", year: "numeric",
  }).format(new Date(iso));

export function BookingDocuments({
  reservationId, documents,
}: { reservationId: string; documents: ResDocument[] }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();

  async function onUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const form = e.currentTarget;
    const fd = new FormData(form);
    if (!(fd.get("file") as File)?.size) { setError("Pilih berkasnya dulu."); return; }
    fd.set("reservation_id", reservationId);

    setBusy(true);
    const res = await fetch("/api/admin/coworking/documents", { method: "POST", body: fd });
    setBusy(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? `Gagal mengunggah (${res.status}).`);
      return;
    }
    form.reset();
    if (fileRef.current) fileRef.current.value = "";
    startTransition(() => router.refresh());
  }

  /**
   * The link is made when you click, not when the page renders.
   *
   * A presigned URL rendered into the page would be minted for everyone who
   * loads it and would sit in the HTML, in history and in any copy of the
   * page, long after the fifteen minutes it is meant to last.
   */
  async function open(id: string) {
    setError("");
    const res = await fetch(`/api/admin/coworking/documents?id=${encodeURIComponent(id)}`);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Gagal membuka dokumen.");
      return;
    }
    const { url } = await res.json();
    window.open(url, "_blank", "noopener,noreferrer");
  }

  async function remove(id: string, name: string) {
    if (!confirm(`Hapus "${name}" dari daftar dokumen kontrak ini?`)) return;
    setBusy(true);
    const res = await removeDocument(reservationId, id);
    setBusy(false);
    if (res?.error) { setError(res.error); return; }
    startTransition(() => router.refresh());
  }

  return (
    <section className="bg-white border border-line rounded-2xl shadow-card overflow-hidden mt-8">
      <h2 className="px-5 py-3 bg-[#efeae8] text-sm font-semibold text-ink">
        Dokumen kontrak
      </h2>

      {documents.length === 0 ? (
        <p className="px-5 py-6 text-sm text-ink-3">
          Belum ada dokumen. Kontrak yang ditandatangani, adendum, KTP penanggung
          jawab — simpan di sini supaya tidak tercecer di percakapan.
        </p>
      ) : (
        <ul className="divide-y divide-[#f0ecea]">
          {documents.map((d) => (
            <li key={d.id} className="px-5 py-3 flex items-center justify-between gap-4 text-sm">
              <div className="min-w-0">
                <button
                  onClick={() => open(d.id)}
                  className="font-medium text-brand-ink hover:underline text-left truncate block max-w-md"
                >
                  {d.title || d.file_name}
                </button>
                <div className="text-xs text-ink-3">
                  {kindLabel(d.kind)} · {size(d.size_bytes)} · diunggah {tanggal(d.created_at)}
                  {d.title && ` · ${d.file_name}`}
                </div>
              </div>
              <button
                onClick={() => remove(d.id, d.title || d.file_name)}
                disabled={busy}
                className="text-xs text-[#8c3a2c] hover:underline disabled:opacity-50 whitespace-nowrap"
              >
                hapus
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={onUpload} className="px-5 py-4 border-t border-[#e8e3e0] flex flex-wrap items-end gap-2">
        <label className="block">
          <span className="block text-xs text-ink-3 mb-1">Jenis</span>
          <select name="kind" defaultValue="contract" className="border border-line-strong rounded-lg px-3 py-2 text-sm bg-white">
            {KINDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="block text-xs text-ink-3 mb-1">Judul</span>
          <input
            name="title"
            placeholder="Opsional"
            className="border border-line-strong rounded-lg px-3 py-2 text-sm w-56"
          />
        </label>
        <label className="block">
          <span className="block text-xs text-ink-3 mb-1">Berkas</span>
          <input
            ref={fileRef}
            type="file"
            name="file"
            accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
            className="text-sm file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border file:border-line-strong file:bg-white file:text-ink-2 file:text-sm"
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="px-4 py-2 rounded-lg bg-brand text-white text-sm font-medium hover:bg-brand-strong disabled:opacity-60"
        >
          {busy ? "Mengunggah…" : "Unggah"}
        </button>
        <p className="w-full text-xs text-ink-3 mt-1">
          PDF, gambar, atau Word, maksimal 20 MB. Disimpan di penyimpanan privat —
          tautannya dibuat saat diklik dan hanya berlaku 15 menit.
        </p>
      </form>

      {error && (
        <p className="mx-5 mb-4 text-sm text-[#8c3a2c] bg-[#fbeeec] border border-[#e2b3ab] rounded px-3 py-2">
          {error}
        </p>
      )}
    </section>
  );
}
