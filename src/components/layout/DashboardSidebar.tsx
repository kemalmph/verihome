"use client";

import Link from "next/link";
import { useRef } from "react";
import { signOut } from "@/lib/supabase/auth-actions";
import { SidebarCollapseToggle } from "./SidebarCollapseToggle";
import { Logo } from "@/components/brand/Logo";

interface SidebarLink {
  href: string;
  label: string;
  icon: string;
  badge?: number;
}

const mainLinks: SidebarLink[] = [
  { href: "/dashboard", label: "Dashboard", icon: "home" },
  { href: "/dashboard/unit", label: "Unit Saya", icon: "apartment" },
  { href: "/dashboard/saved", label: "Saved Listings", icon: "favorite" },
  { href: "/dashboard/appointments", label: "Appointments", icon: "calendar_today", badge: 1 },
  { href: "/dashboard/viewings",  label: "Viewings",  icon: "location_on" },
  { href: "/dashboard/bookings",  label: "Bookings",  icon: "hotel" },
  { href: "/dashboard/support", label: "Support & Services", icon: "headset_mic" },
];

interface DashboardSidebarProps {
  activeHref?: string;
  userName?: string;
  isActiveClient?: boolean;
}

/**
 * The tenant dashboard's sidebar, built the same way as AdminSidebar.
 *
 * It used to be one always-visible fixed aside, 288px wide at every screen
 * size, and half the pages beside it left `ml-72` unprefixed — so on a phone
 * the menu covered the left of the screen and the content was pushed past
 * the right edge. Now: a <details> drawer under a top bar on phones (opens
 * without JavaScript), and on desktop a static aside that folds to a 72px
 * icon rail through the shared cookie (see src/lib/sidebar/config.ts).
 *
 * Its width is --dash-sidebar-w, not the admin's --sidebar-w: this sidebar
 * has always been 288px, and the fold should not quietly resize it too.
 */
export function DashboardSidebar({
  activeHref = "/dashboard",
  userName = "User",
  isActiveClient = false,
}: DashboardSidebarProps) {
  const drawer = useRef<HTMLDetailsElement>(null);
  const closeDrawer = () => {
    if (drawer.current) drawer.current.open = false;
  };

  // `rail` marks the desktop copy; collapsed: classes must not reach the
  // phone drawer (see AdminSidebar).
  const renderBody = (rail: boolean) => {
    const r = (cls: string) => (rail ? cls : "");
    const linkClass = (active: boolean) =>
      `flex items-center justify-between gap-4 px-4 py-3 rounded-xl transition-colors ${r("collapsed:justify-center collapsed:px-0")} ${
        active
          ? "bg-brand text-white font-semibold shadow-brand"
          : "text-white/75 hover:text-white hover:bg-white/[.06]"
      }`;

    return (
      <>
        <div className={`px-8 mb-8 ${r("collapsed:px-3")}`}>
          <div
            title={rail ? userName : undefined}
            className={`flex items-center gap-4 p-3 rounded-2xl bg-white/[.05] border border-white/10 ${r("collapsed:p-1.5 collapsed:justify-center")}`}
          >
            <div className="w-10 h-10 rounded-full bg-brand flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
              {userName.charAt(0).toUpperCase()}
            </div>
            <div className={`min-w-0 ${r("collapsed:hidden")}`}>
              <p className="text-sm font-bold text-white truncate">{userName}</p>
              {isActiveClient && (
                <span className="inline-block px-2 py-0.5 mt-1 rounded-full text-[10px] font-bold bg-brand text-white uppercase tracking-wider">
                  Active Client
                </span>
              )}
            </div>
          </div>
        </div>

        <nav className={`flex-1 px-4 space-y-1 overflow-y-auto overflow-x-hidden ${r("collapsed:px-2")}`}>
          {mainLinks.map((link) => {
            const isActive = activeHref === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={closeDrawer}
                title={rail ? link.label : undefined}
                aria-current={isActive ? "page" : undefined}
                className={linkClass(isActive)}
              >
                <div className="relative flex items-center gap-4">
                  <span aria-hidden className="material-symbols-outlined text-[20px]">
                    {link.icon}
                  </span>
                  <span className={`text-sm font-medium whitespace-nowrap ${r("collapsed:sr-only")}`}>
                    {link.label}
                  </span>
                  {/* Folded, the count rides on the icon instead of the row. */}
                  {rail && link.badge && (
                    <span aria-hidden className="hidden collapsed:block absolute -top-1 -right-1.5 h-2 w-2 rounded-full bg-brand" />
                  )}
                </div>
                {link.badge && (
                  <span className={`bg-white text-brand-ink text-[10px] font-bold h-5 w-5 flex items-center justify-center rounded-full ${r("collapsed:hidden")}`}>
                    {link.badge}
                  </span>
                )}
              </Link>
            );
          })}

          <div className={`pt-6 pb-2 px-4 ${r("collapsed:px-2")}`}>
            <p className={`text-white/30 text-[10px] font-bold uppercase tracking-widest ${r("collapsed:sr-only")}`}>
              Account
            </p>
            {rail && <div aria-hidden className="hidden collapsed:block border-t border-white/10" />}
          </div>

          <Link
            href="/dashboard/settings"
            onClick={closeDrawer}
            title={rail ? "Profile Settings" : undefined}
            className={linkClass(false)}
          >
            <div className="flex items-center gap-4">
              <span aria-hidden className="material-symbols-outlined text-[20px]">settings</span>
              <span className={`text-sm font-medium whitespace-nowrap ${r("collapsed:sr-only")}`}>
                Profile Settings
              </span>
            </div>
          </Link>
        </nav>

        <div className={`p-4 mt-auto space-y-1 ${r("collapsed:px-2")}`}>
          {rail && (
            <SidebarCollapseToggle collapseLabel="Collapse sidebar" expandLabel="Expand sidebar" />
          )}
          {/* A link here would navigate without ending the session — it has to
              invoke signOut, which clears the cookie and redirects. */}
          <form action={signOut}>
            <button
              type="submit"
              title={rail ? "Logout" : undefined}
              className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl text-red-300/60 hover:text-red-300 hover:bg-red-500/10 transition-colors ${r("collapsed:justify-center collapsed:px-0")}`}
            >
              <span aria-hidden className="material-symbols-outlined text-[20px]">logout</span>
              <span className={`text-sm font-medium whitespace-nowrap ${r("collapsed:sr-only")}`}>Logout</span>
            </button>
          </form>
        </div>
      </>
    );
  };

  return (
    <>
      {/* ── Phone: top bar that is itself the toggle ──────────────────── */}
      <details ref={drawer} className="md:hidden">
        <summary
          aria-label="Menu"
          className="list-none cursor-pointer fixed top-0 left-0 right-0 h-14 bg-panel flex items-center px-4 z-50 gap-3 [&::-webkit-details-marker]:hidden"
        >
          <span aria-hidden className="material-symbols-outlined text-white text-xl p-1.5">
            menu
          </span>
          <Logo variant="light" height={20} />
        </summary>

        <div onClick={closeDrawer} className="fixed top-14 left-0 right-0 bottom-0 bg-black/50 z-40" />

        <aside className="fixed top-14 left-0 bottom-0 w-72 bg-panel text-white flex flex-col z-50 pt-6">
          {renderBody(false)}
        </aside>
      </details>

      {/* ── Desktop: full, or folded to an icon rail ──────────────────── */}
      <aside className="hidden md:flex fixed top-0 left-0 h-full w-(--dash-sidebar-w) transition-[width] bg-panel text-white flex-col z-40 overflow-hidden">
        <div className="px-8 py-10 whitespace-nowrap collapsed:px-0 collapsed:text-center">
          <Link href="/" aria-label="Cosystem" className="inline-block collapsed:hidden">
            <Logo variant="light" height={26} />
          </Link>
          <Link
            href="/"
            aria-label="Cosystem"
            className="hidden collapsed:inline text-white font-black text-2xl leading-none tracking-tight"
          >
            c<span className="text-brand">.</span>
          </Link>
        </div>
        {renderBody(true)}
      </aside>
    </>
  );
}
