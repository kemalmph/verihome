"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { removeSaved } from "@/lib/actions/saved-actions";
import { t } from "@/lib/i18n/strings";

const rp = (n: number) => `Rp ${new Intl.NumberFormat("id-ID").format(Math.round(n))}`;

interface Saved {
  id: string; propertyId: string; name: string; area: string | null; slug: string | null;
  isLive: boolean; isShortStay: boolean;
  currentPrice: number; savedPrice: number; delta: number;
  savedAt: string; nextAvailable: string | null;
}

export function SavedList({ items }: { items: Saved[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [, startTransition] = useTransition();

  async function drop(id: string) {
    setBusy(id); setError("");
    const res = await removeSaved(id);
    setBusy("");
    if (res?.error) { setError(res.error); return; }
    startTransition(() => router.refresh());
  }

  if (items.length === 0) {
    return <p className="text-[#3e4944] bg-white rounded-xl border border-[#cccccc] p-6">{t("saved.none")}</p>;
  }

  return (
    <>
      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {items.map((s) => (
          <article key={s.id} className="bg-white rounded-xl border border-[#cccccc] p-5 flex flex-col">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="font-semibold text-[#0d2137]">{s.name}</h3>
                {s.area && <p className="text-xs text-[#6e7a74] mt-0.5">{s.area}</p>}
              </div>
              {!s.isLive && (
                <span className="px-2 py-1 rounded-full text-[10px] font-bold bg-gray-200 text-gray-600 shrink-0 uppercase">
                  {t("saved.noLongerLive")}
                </span>
              )}
            </div>

            <div className="mt-3 flex items-baseline gap-2 flex-wrap">
              <span className="text-lg font-bold text-[#0d2137] tabular-nums">
                {rp(s.currentPrice)}
                <span className="text-xs font-normal text-[#6e7a74]">{s.isShortStay ? "/malam" : "/bulan"}</span>
              </span>
              {s.delta !== 0 && (
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                  s.delta > 0 ? "bg-red-50 text-red-700" : "bg-[#e8f5f0] text-[#12614a]"
                }`}>
                  {s.delta > 0 ? "↑" : "↓"} {rp(Math.abs(s.delta))} {s.delta > 0 ? t("saved.priceUp") : t("saved.priceDown")}
                </span>
              )}
            </div>
            {s.delta !== 0 && (
              <p className="text-[11px] text-[#6e7a74] mt-0.5">
                {t("saved.priceSaved")} {rp(s.savedPrice)}
              </p>
            )}

            {s.isShortStay && s.nextAvailable && (
              <p className="text-xs text-[#3e4944] mt-2">
                {t("saved.nextAvailable")} {new Date(`${s.nextAvailable}T00:00:00`).toLocaleDateString("id-ID", { day: "numeric", month: "long" })}
              </p>
            )}

            <div className="mt-4 pt-3 border-t border-[#f0eeed] flex gap-2 flex-wrap">
              {s.isLive && s.slug && (
                <>
                  {s.isShortStay && (
                    <Link href={`/listings/${s.slug}/book`}
                          className="px-3 py-1.5 bg-[#1a7a5e] text-white text-xs font-semibold rounded-lg hover:opacity-90">
                      {t("saved.book")}
                    </Link>
                  )}
                  <Link href={`/listings/${s.slug}/viewing`}
                        className="px-3 py-1.5 border border-[#1a7a5e] text-[#1a7a5e] text-xs font-semibold rounded-lg hover:bg-[#e8f5f0]">
                    {t("saved.requestViewing")}
                  </Link>
                </>
              )}
              <button onClick={() => drop(s.id)} disabled={busy === s.id}
                      className="px-3 py-1.5 border border-[#cccccc] text-[#3e4944] text-xs font-semibold rounded-lg hover:bg-[#f6f3f2] disabled:opacity-50 ml-auto">
                {busy === s.id ? "…" : t("saved.remove")}
              </button>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
