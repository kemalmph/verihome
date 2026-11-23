"use client";

import Link from "next/link";
import { useRef } from "react";

interface AdminSidebarProps {
  activeHref: string;
}

/**
 * Grouped by which module owns the page, not by how often it is clicked.
 *
 * A flat list of thirteen made the reader do the sorting every time. The
 * groups are the two businesses plus the things both of them need.
 *
 * Where each one landed, and why — these were checked rather than guessed:
 *
 *   Inventory     reads `properties`, so it is marketplace, despite a name
 *                 that sounds like it could belong to either.
 *   Owners        is referenced by properties.owner_id AND sites.owner_id.
 *                 It genuinely serves both, so it sits in General rather
 *                 than being claimed by whichever module is older.
 *   Owner Requests is the property owner portal's change queue — marketplace.
 *   Daily Jobs    is where you check that scheduled work ran. Today every job
 *                 is a marketplace job, but the page answers "did the
 *                 schedule fire", which is a question about the system.
 */
const groups: {
  heading: string;
  items: { href: string; icon: string; label: string }[];
}[] = [
  {
    heading: "General",
    items: [
      { href: "/admin", icon: "dashboard", label: "Dashboard" },
      { href: "/admin/users", icon: "group", label: "Users" },
      { href: "/admin/owners", icon: "real_estate_agent", label: "Owners" },
      { href: "/admin/cron", icon: "schedule", label: "Daily Jobs" },
      { href: "/admin/settings", icon: "settings", label: "Settings" },
    ],
  },
  {
    heading: "Marketplace",
    items: [
      { href: "/admin/listings", icon: "apartment", label: "Listings" },
      { href: "/admin/bookings", icon: "hotel", label: "Bookings" },
      { href: "/admin/viewings", icon: "location_on", label: "Viewings" },
      { href: "/admin/consultations", icon: "calendar_today", label: "Consultations" },
      { href: "/admin/placements", icon: "handshake", label: "Placements" },
      { href: "/admin/inventory", icon: "inventory_2", label: "Inventory" },
      { href: "/admin/surveys/pending", icon: "assignment", label: "Survey Imports" },
      { href: "/admin/owner-requests", icon: "rule", label: "Owner Requests" },
    ],
  },
  {
    heading: "Site management",
    items: [
      { href: "/site", icon: "desk", label: "Site" },
    ],
  },
  {
    /**
     * Four pages had no nav entry at all and were only reachable by typing
     * the URL: /admin/expenses, /admin/placements, /admin/reports/sales and
     * /admin/reports/position. They exist, they render, and nothing linked
     * to them — found while auditing every activeHref the app passes in.
     *
     * Three are finance, which is neither marketplace nor site: the ledger
     * these read from carries both businesses.
     */
    heading: "Finance",
    items: [
      { href: "/admin/reports/position", icon: "account_balance", label: "Financial Position" },
      { href: "/admin/reports/sales", icon: "trending_up", label: "Sales Report" },
      { href: "/admin/expenses", icon: "payments", label: "Expenses" },
    ],
  },
];

/**
 * The drawer on a phone is a <details>, not a useState panel.
 *
 * It was a button with onClick, and it worked — once React had hydrated.
 * Before that the menu was the one thing on screen that did nothing, on the
 * one screen where it is the only way to reach any other page. Measured at
 * 390px: with JavaScript the drawer slid from x=-256 to 0; with JavaScript
 * off it stayed at -256. A phone on a slow connection sees the second case
 * for real, and taps again, and concludes the panel does not collapse.
 *
 * The drawer starts below the top bar rather than under it, so the same
 * control that opened it is still reachable to close it — otherwise, with no
 * JavaScript, the backdrop tap is gone and there is no way back out.
 *
 * Desktop renders its own static aside. Two elements rather than one shared
 * one because a closed <details> hides its contents outright, which is
 * exactly wrong for a sidebar that must always show from 768px up. The
 * links come from one function, so there is no second copy to keep in step.
 */
export function AdminSidebar({ activeHref }: AdminSidebarProps) {
  const drawer = useRef<HTMLDetailsElement>(null);

  // Enhancement, not a dependency: without JavaScript a link is a full page
  // load, which resets the drawer anyway. With client-side navigation the
  // DOM survives, so it has to be closed by hand.
  const closeDrawer = () => {
    if (drawer.current) drawer.current.open = false;
  };

  /* Thirteen items plus four headings outgrow a short laptop screen, so the
     nav scrolls on its own rather than pushing "Back to site" off the
     bottom. */
  const nav = (
    <>
      <nav className="flex-1 px-4 pb-2 overflow-y-auto">
        {groups.map((group) => (
          <div key={group.heading} className="mb-5 last:mb-0">
            <p className="px-4 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-white/35">
              {group.heading}
            </p>
            <div className="space-y-0.5">
              {group.items.map((link) => {
                const active =
                  activeHref === link.href ||
                  (link.href !== "/admin" && activeHref.startsWith(link.href));
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={closeDrawer}
                    className={`flex items-center gap-3 px-4 py-2.5 rounded-md transition-colors ${
                      active
                        ? "text-[#80d7b6] bg-white/5"
                        : "text-white/70 hover:text-white hover:bg-white/5"
                    }`}
                  >
                    <span className="material-symbols-outlined text-lg">{link.icon}</span>
                    <span className="text-sm font-medium">{link.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="px-6 py-6 border-t border-white/10">
        <Link
          href="/"
          onClick={closeDrawer}
          className="flex items-center gap-2 text-white/50 hover:text-white text-xs transition-colors"
        >
          <span className="material-symbols-outlined text-sm">arrow_back</span>
          Back to site
        </Link>
      </div>
    </>
  );

  return (
    <>
      {/* ── Phone: top bar that is itself the toggle ──────────────────── */}
      <details ref={drawer} className="md:hidden">
        <summary
          aria-label="Menu"
          className="list-none cursor-pointer fixed top-0 left-0 right-0 h-14 bg-[#0d2137] flex items-center px-4 z-50 gap-3 [&::-webkit-details-marker]:hidden"
        >
          <span aria-hidden className="material-symbols-outlined text-white text-xl p-1.5">
            menu
          </span>
          <p className="text-[#9cf4d1] font-bold text-lg">Cosystem</p>
          <p className="text-white/50 text-xs mt-0.5">Admin</p>
        </summary>

        <div
          onClick={closeDrawer}
          className="fixed top-14 left-0 right-0 bottom-0 bg-black/50 z-40"
        />

        <aside className="fixed top-14 left-0 bottom-0 w-64 bg-[#0d2137] text-white flex flex-col z-50">
          {nav}
        </aside>
      </details>

      {/* ── Desktop: always there ─────────────────────────────────────── */}
      <aside className="hidden md:flex fixed top-0 left-0 h-full w-64 bg-[#0d2137] text-white flex-col z-50">
        <div className="px-6 py-8">
          <p className="text-[#9cf4d1] font-bold text-xl">Cosystem</p>
          <p className="text-white/50 text-xs mt-1">Admin Panel</p>
        </div>
        {nav}
      </aside>
    </>
  );
}
