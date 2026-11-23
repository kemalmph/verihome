"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useT } from "@/lib/i18n/LocaleProvider";
import type { StringKey } from "@/lib/i18n/strings";

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
const ITEMS: { href: string; label: StringKey; blurb: StringKey }[] = [
  { href: "/#fitur-kelola",    label: "nav.feat.manage",   blurb: "nav.feat.manageBlurb" },
  { href: "/#monetisasi",      label: "nav.feat.monetise", blurb: "nav.feat.monetiseBlurb" },
  { href: "/#workspace-hunian", label: "nav.feat.assets",  blurb: "nav.feat.assetsBlurb" },
];

export function NavFeaturesMenu() {
  const t = useT();
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
        {t("nav.features")}
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
                  {t(item.label)}
                </span>
                <span className="block mt-0.5 text-xs text-[#6e7a74] leading-snug">
                  {t(item.blurb)}
                </span>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
