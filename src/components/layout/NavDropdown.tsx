"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useT } from "@/lib/i18n/LocaleProvider";
import type { NavLink } from "./nav-items";
import type { StringKey } from "@/lib/i18n/strings";

/**
 * One desktop header dropdown (Product, Solutions, Resources).
 *
 * Escape closes it and returns focus to the trigger; a click outside closes
 * it. The phone header does not use this — it has its own <details> panel
 * that works before hydration (NavMobileMenu).
 */
export function NavDropdown({ label, items }: { label: StringKey; items: NavLink[] }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

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
        className="flex items-center gap-0.5 text-sm font-semibold text-ink-2 hover:text-ink transition-colors"
      >
        {t(label)}
        <span
          aria-hidden
          className={`material-symbols-outlined text-[18px] text-ink-3 transition-transform ${open ? "rotate-180" : ""}`}
        >
          expand_more
        </span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-1/2 -translate-x-1/2 mt-4 w-72 bg-white border border-line rounded-2xl shadow-lift z-20 overflow-hidden p-1.5">
            {items.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                onClick={() => setOpen(false)}
                className="block px-3.5 py-2.5 rounded-xl hover:bg-cream transition-colors"
              >
                <span className="block text-sm font-semibold text-ink">{t(item.label)}</span>
                {item.blurb && (
                  <span className="block mt-0.5 text-xs text-ink-3 leading-snug">{t(item.blurb)}</span>
                )}
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
