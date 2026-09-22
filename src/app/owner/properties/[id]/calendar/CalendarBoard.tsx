"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { blockDates, removeBlock } from "@/lib/actions/owner-actions";
import { t } from "@/lib/i18n/strings";

interface Block { id: string; start: string; end: string; reason: string; isBookingHold: boolean; mine: boolean }
interface Booking { start: string; end: string }

type DayState = "available" | "booked" | "blocked" | "buffer";

const LEGEND: [DayState, string, string][] = [
  ["available", "owner.calendar.available", "bg-white border-[#cccccc]"],
  ["booked",    "owner.calendar.booked",    "bg-[#0d2137] text-white border-[#0d2137]"],
  ["blocked",   "owner.calendar.blocked",   "bg-[#c27c00] text-white border-[#c27c00]"],
  ["buffer",    "owner.calendar.buffer",    "bg-[#e4e2e1] text-[#6e7a74] border-[#cccccc]"],
];

const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (s: string, n: number) => {
  const d = new Date(`${s}T00:00:00`);
  d.setDate(d.getDate() + n);
  return iso(d);
};

export function CalendarBoard({
  propertyId, year, month, blocks, bookings, bufferDays,
}: {
  propertyId: string; year: number; month: number;
  blocks: Block[]; bookings: Booking[]; bufferDays: number;
}) {
  const router = useRouter();
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();

  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leading = (first.getDay() + 6) % 7; // Monday-first

  // Half-open ranges: end is the checkout day, which is free again.
  const inRange = (day: string, s: string, e: string) => day >= s && day < e;

  function stateOf(day: string): DayState {
    if (bookings.some((b) => inRange(day, b.start, b.end))) return "booked";
    if (blocks.some((b) => inRange(day, b.start, b.end))) return "blocked";
    if (bufferDays > 0 && bookings.some((b) => inRange(day, b.end, addDays(b.end, bufferDays)))) return "buffer";
    return "available";
  }

  async function submitBlock() {
    setBusy(true); setError("");
    const res = await blockDates(propertyId, start, end, note || undefined);
    setBusy(false);
    if (res?.error) { setError(res.error); return; }
    setStart(""); setEnd(""); setNote("");
    startTransition(() => router.refresh());
  }

  async function drop(blockId: string) {
    setBusy(true); setError("");
    const res = await removeBlock(propertyId, blockId);
    setBusy(false);
    if (res?.error) { setError(res.error); return; }
    startTransition(() => router.refresh());
  }

  const myBlocks = blocks.filter((b) => b.mine && !b.isBookingHold);

  return (
    <div className="space-y-6">
      {/* Legend */}
      <div className="flex flex-wrap gap-3">
        {LEGEND.map(([k, key, cls]) => (
          <span key={k} className="flex items-center gap-1.5 text-xs text-[#3e4944]">
            <span className={`w-4 h-4 rounded border ${cls}`} />
            {t(key as Parameters<typeof t>[0])}
          </span>
        ))}
      </div>

      {/* Month grid */}
      <div className="bg-white rounded-xl border border-[#cccccc] p-4">
        <div className="grid grid-cols-7 gap-1 mb-1">
          {["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"].map((d) => (
            <div key={d} className="text-[11px] text-center text-[#6e7a74] font-semibold py-1">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: leading }).map((_, i) => <div key={`pad-${i}`} />)}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const dayNum = i + 1;
            const day = `${year}-${String(month + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
            const st = stateOf(day);
            const cls =
              st === "booked"  ? "bg-[#0d2137] text-white border-[#0d2137]" :
              st === "blocked" ? "bg-[#c27c00] text-white border-[#c27c00]" :
              st === "buffer"  ? "bg-[#e4e2e1] text-[#6e7a74] border-[#cccccc]" :
                                 "bg-white text-[#0d2137] border-[#cccccc]";
            return (
              <div key={day} className={`aspect-square rounded-lg border flex items-center justify-center text-sm tabular-nums ${cls}`}>
                {dayNum}
              </div>
            );
          })}
        </div>
      </div>

      {/* Block form */}
      <section className="bg-white rounded-xl border border-[#cccccc] p-5">
        <h2 className="font-semibold text-[#0d2137] text-sm">{t("owner.calendar.blockDates")}</h2>
        <p className="text-xs text-[#6e7a74] mt-1 mb-4">{t("owner.calendar.blockNote")}</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="bs" className="block text-xs font-semibold text-[#3e4944] mb-1">Mulai</label>
            <input id="bs" type="date" value={start} onChange={(e) => setStart(e.target.value)}
                   className="w-full h-10 px-3 rounded-lg border border-[#cccccc] text-sm focus:outline-none focus:border-[#1a7a5e]" />
          </div>
          <div>
            <label htmlFor="be" className="block text-xs font-semibold text-[#3e4944] mb-1">Selesai</label>
            <input id="be" type="date" value={end} onChange={(e) => setEnd(e.target.value)}
                   className="w-full h-10 px-3 rounded-lg border border-[#cccccc] text-sm focus:outline-none focus:border-[#1a7a5e]" />
          </div>
        </div>

        <input
          value={note} onChange={(e) => setNote(e.target.value)}
          placeholder="Catatan (opsional)"
          className="w-full h-10 px-3 mt-3 rounded-lg border border-[#cccccc] text-sm focus:outline-none focus:border-[#1a7a5e]"
        />

        {error && <p className="text-sm text-red-600 mt-3">{error}</p>}

        <button
          onClick={submitBlock}
          disabled={busy || !start || !end}
          className="mt-4 px-4 py-2 bg-[#1a7a5e] text-white text-sm font-semibold rounded-lg hover:opacity-90 disabled:opacity-40"
        >
          {busy ? t("common.loading") : t("owner.calendar.blockDates")}
        </button>
      </section>

      {/* My blocks */}
      {myBlocks.length > 0 && (
        <section className="bg-white rounded-xl border border-[#cccccc] divide-y divide-[#f0eeed]">
          <div className="px-5 py-3">
            <p className="text-xs font-bold text-[#3e4944] uppercase tracking-wider">Blokir Anda</p>
            <p className="text-[11px] text-[#6e7a74] mt-0.5">{t("owner.calendar.onlyOwnBlocks")}</p>
          </div>
          {myBlocks.map((b) => (
            <div key={b.id} className="px-5 py-3 flex items-center justify-between gap-3">
              <p className="text-sm text-[#0d2137]">{b.start} → {b.end}</p>
              <button
                onClick={() => drop(b.id)}
                disabled={busy}
                className="px-3 py-1.5 border border-red-200 text-red-600 bg-red-50 text-xs font-semibold rounded-lg hover:bg-red-100 disabled:opacity-50"
              >
                {t("owner.calendar.removeBlock")}
              </button>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
