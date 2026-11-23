"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

/**
 * The first three nav items, folded into one.
 *
 * "Fitur Kelola", "Cara Monetisasi" and "Workspace & Hunian" are three
 * labels for what a visitor reads as one question — what does this thing
 * do — and spending three of six nav slots on it left "Harga" and
 * "Jelajahi Listing" competing for attention with their own prefixes.
 *
 * They are folded rather than dropped: each still points at a real section,
 * and a link nobody can reach is not a simpler menu, it is a missing one.
 */
const ITEMS: { href: string; label: string; blurb: string }[] = [
  {
    href: "/#fitur-kelola",
    label: "Fitur Kelola",
    blurb: "Jadwal, kontrak, dan tagihan dalam satu dashboard",
  },
  {
    href: "/#monetisasi",
    label: "Cara Monetisasi",
    blurb: "Dari unit kosong ke listing yang menghasilkan",
  },
  {
    href: "/#workspace-hunian",
    label: "Workspace & Hunian",
    blurb: "Satu sistem untuk dua jenis aset",
  },
];

export function NavFeaturesMenu() {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  // Escape closes it, and focus goes back where it came from. A menu that
  // traps a keyboard user is worse than no menu.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        wrap.current?.querySelector("button")?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="relative" ref={wrap}>
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 text-sm font-medium text-[#3e4944] hover:text-[#1a7a5e] transition-colors"
      >
        Fitur
        <span
          aria-hidden
          className={`material-symbols-outlined text-[18px] transition-transform ${
            open ? "rotate-180" : ""
          }`}
        >
          expand_more
        </span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 mt-3 w-72 bg-white border border-[#cccccc] rounded-xl shadow-lg z-20 overflow-hidden py-1">
            {ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="block px-4 py-3 hover:bg-[#f6f3f2] transition-colors"
              >
                <span className="block text-sm font-semibold text-[#0d2137]">
                  {item.label}
                </span>
                <span className="block mt-0.5 text-xs text-[#6e7a74] leading-snug">
                  {item.blurb}
                </span>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
