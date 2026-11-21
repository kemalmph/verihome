"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  setSiteAmenities, setUnitAmenities,
  type Amenity, type AmenityAssignments,
} from "@/lib/actions/amenity-actions";
import { unitTypeLabel } from "@/lib/coworking/taxonomy";

const CATEGORY_LABEL: Record<string, string> = {
  comfort: "Kenyamanan",
  tech: "Teknis",
  service: "Layanan",
  safety: "Keamanan",
  other: "Lainnya",
};

export function AmenityManager({
  siteId, units, assignments,
}: {
  siteId: string;
  units: { id: string; name: string; unit_type: string }[];
  assignments: AmenityAssignments;
}) {
  const router = useRouter();
  const [openUnit, setOpenUnit] = useState<string | null>(null);
  const [siteOpen, setSiteOpen] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();

  const byCategory = assignments.all.reduce<Record<string, Amenity[]>>((acc, a) => {
    (acc[a.category] ??= []).push(a);
    return acc;
  }, {});

  const labelOf = (id: string) => assignments.all.find((a) => a.id === id)?.label ?? id;

  async function save(fn: () => Promise<{ error?: string }>, close: () => void) {
    setBusy(true); setError("");
    const res = await fn();
    setBusy(false);
    if (res?.error) { setError(res.error); return; }
    close();
    startTransition(() => router.refresh());
  }

  const picked = (form: HTMLFormElement) =>
    Array.from(form.querySelectorAll<HTMLInputElement>('input[name="amenity"]:checked')).map((i) => i.value);

  return (
    <section className="bg-white border border-[#ddd7d4] rounded-lg overflow-hidden mt-8">
      <div className="p-6 pb-4">
        <h2 className="text-lg font-semibold text-[#0d2137]">Fasilitas</h2>
        <p className="text-sm text-[#6e7a74] mt-0.5">
          Apa yang melekat pada gedung dan pada tiap ruangan. Bukan barang
          sekali pakai seperti air mineral — itu dicatat per booking.
        </p>
      </div>

      {error && (
        <p className="mx-6 mb-4 text-sm text-[#8c3a2c] bg-[#fbeeec] border border-[#e2b3ab] rounded px-3 py-2">
          {error}
        </p>
      )}

      {/* ── site-wide ──────────────────────────────────────────────── */}
      <div className="px-6 pb-5 border-b border-[#e8e3e0]">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-[#0d2137] mb-1">Seluruh gedung</h3>
            <p className="text-sm text-[#3e4944]">
              {assignments.site.length
                ? assignments.site.map(labelOf).join(" · ")
                : <span className="text-[#6e7a74]">Belum ada</span>}
            </p>
          </div>
          {!siteOpen && (
            <button
              onClick={() => { setSiteOpen(true); setOpenUnit(null); }}
              className="px-3 py-1.5 rounded-lg border border-[#ddd7d4] text-sm text-[#3e4944] hover:bg-[#f6f3f2] whitespace-nowrap"
            >
              Ubah
            </button>
          )}
        </div>

        {siteOpen && (
          <form
            className="mt-4"
            onSubmit={(e) => {
              e.preventDefault();
              const ids = picked(e.currentTarget);
              save(() => setSiteAmenities(siteId, ids), () => setSiteOpen(false));
            }}
          >
            <Picker byCategory={byCategory} checked={assignments.site} />
            <Buttons busy={busy} onCancel={() => { setSiteOpen(false); setError(""); }} />
          </form>
        )}
      </div>

      {/* ── per unit ───────────────────────────────────────────────── */}
      {units.length === 0 ? (
        <p className="p-8 text-center text-[#6e7a74] text-sm">Belum ada unit.</p>
      ) : (
        <ul className="divide-y divide-[#f0ecea]">
          {units.map((u) => {
            const mine = assignments.byUnit[u.id] ?? [];
            const isOpen = openUnit === u.id;
            return (
              <li key={u.id} className="px-6 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="font-medium text-[#0d2137]">
                      {u.name}
                      <span className="text-xs text-[#6e7a74] font-normal ml-2">
                        {unitTypeLabel(u.unit_type)}
                      </span>
                    </div>
                    <p className="text-sm text-[#3e4944] mt-0.5">
                      {mine.length
                        ? mine.map(labelOf).join(" · ")
                        : <span className="text-[#6e7a74]">Belum ada fasilitas</span>}
                    </p>
                  </div>
                  {!isOpen && (
                    <button
                      onClick={() => { setOpenUnit(u.id); setSiteOpen(false); setError(""); }}
                      className="px-3 py-1.5 rounded-lg border border-[#ddd7d4] text-sm text-[#3e4944] hover:bg-[#f6f3f2] whitespace-nowrap"
                    >
                      Ubah
                    </button>
                  )}
                </div>

                {isOpen && (
                  <form
                    className="mt-4"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const ids = picked(e.currentTarget);
                      save(() => setUnitAmenities(siteId, u.id, ids), () => setOpenUnit(null));
                    }}
                  >
                    <Picker byCategory={byCategory} checked={mine} />
                    <Buttons busy={busy} onCancel={() => { setOpenUnit(null); setError(""); }} />
                  </form>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function Picker({
  byCategory, checked,
}: {
  byCategory: Record<string, Amenity[]>;
  checked: string[];
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-4">
      {Object.entries(byCategory).map(([cat, list]) => (
        <div key={cat}>
          <div className="text-xs font-semibold uppercase tracking-wide text-[#6e7a74] mb-2">
            {CATEGORY_LABEL[cat] ?? cat}
          </div>
          <div className="space-y-1.5">
            {list.map((a) => (
              <label key={a.id} className="flex items-center gap-2 text-sm text-[#3e4944]">
                <input
                  type="checkbox"
                  name="amenity"
                  value={a.id}
                  defaultChecked={checked.includes(a.id)}
                  className="rounded border-[#ddd7d4]"
                />
                {a.label}
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function Buttons({ busy, onCancel }: { busy: boolean; onCancel: () => void }) {
  return (
    <div className="flex gap-3 mt-5">
      <button
        type="submit"
        disabled={busy}
        className="px-4 py-2 rounded-lg bg-[#1a7a5e] text-white text-sm font-medium hover:bg-[#166750] disabled:opacity-60"
      >
        {busy ? "Menyimpan…" : "Simpan fasilitas"}
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="px-4 py-2 rounded-lg border border-[#ddd7d4] text-sm text-[#3e4944] hover:bg-[#f6f3f2]"
      >
        Batal
      </button>
    </div>
  );
}
