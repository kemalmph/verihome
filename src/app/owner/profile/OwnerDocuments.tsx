"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { t } from "@/lib/i18n/strings";

interface Doc { id: string; kind: string; originalName: string; uploadedAt: string }

const KINDS: [string, Parameters<typeof t>[0]][] = [
  ["right_to_let", "owner.profile.docRightToLet"],
  ["cooperation_agreement", "owner.profile.docAgreement"],
];

export function OwnerDocuments({ documents }: { documents: Doc[] }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [, startTransition] = useTransition();

  async function upload(kind: string, file: File) {
    setBusy(kind); setError("");
    const fd = new FormData();
    fd.set("file", file);
    fd.set("kind", kind);
    const res = await fetch("/api/owner/documents", { method: "POST", body: fd });
    setBusy("");
    if (!res.ok) { setError((await res.json()).error ?? "Gagal mengunggah."); return; }
    startTransition(() => router.refresh());
  }

  async function view(id: string) {
    const res = await fetch(`/api/owner/documents?id=${id}`);
    if (!res.ok) { setError("Tidak ditemukan."); return; }
    const { url } = await res.json();
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <section className="bg-white rounded-xl border border-[#cccccc] p-5">
      <h2 className="text-xs font-bold text-[#3e4944] uppercase tracking-wider mb-3">
        {t("owner.profile.documents")}
      </h2>

      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

      <div className="space-y-4">
        {KINDS.map(([kind, labelKey]) => {
          const mine = documents.filter((d) => d.kind === kind);
          return (
            <div key={kind}>
              <p className="text-sm font-medium text-[#0d2137] mb-1.5">{t(labelKey)}</p>

              {mine.length > 0 && (
                <ul className="mb-2 space-y-1">
                  {mine.map((d) => (
                    <li key={d.id} className="flex items-center justify-between gap-3 text-sm">
                      <span className="text-[#3e4944] truncate">{d.originalName}</span>
                      <button onClick={() => view(d.id)}
                              className="text-[#1a7a5e] text-xs font-semibold hover:underline shrink-0">
                        Lihat
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <label className="inline-block">
                <span className="px-3 py-1.5 border border-[#cccccc] text-[#3e4944] text-xs font-semibold rounded-lg hover:bg-[#f6f3f2] cursor-pointer inline-block">
                  {busy === kind ? t("common.loading") : t("owner.profile.upload")}
                </span>
                <input
                  type="file" accept="application/pdf,image/*" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(kind, f); }}
                />
              </label>
            </div>
          );
        })}
      </div>

      <p className="text-[11px] text-[#6e7a74] mt-4">
        Dokumen disimpan terenkripsi dan hanya dapat dibuka lewat tautan sementara.
      </p>
    </section>
  );
}
