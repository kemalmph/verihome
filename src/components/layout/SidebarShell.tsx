"use client";

import Link from "next/link";
import { useRef } from "react";
import { SidebarCollapseToggle } from "./SidebarCollapseToggle";

/** What the shell draws. Labels are already resolved (language included) by AppSidebar. */
export interface ShellItem {
  href: string;
  icon: string;
  label: string;
  active: boolean;
}
export interface ShellGroup {
  label?: string;
  items: ShellItem[];
}
export interface ShellSection {
  id: string;
  heading: string;
  groups: ShellGroup[];
}

interface SidebarShellProps {
  sections: ShellSection[];
  /** Second line under "Cosystem": the area or role. */
  subtitle: string;
  /** Who is signed in; shown under the subtitle on desktop. */
  person?: string;
  labels: { menu: string; collapse: string; expand: string; home: string };
}

/**
 * The one sidebar for /admin, /site, /survey and /owner.
 *
 * It only draws. Which sections and items exist for this viewer is decided on
 * the server (buildMenu); each page enforces its own permission regardless of
 * what is drawn here.
 *
 * The behaviours the three older sidebars earned are kept as they were:
 *
 *  - The phone drawer is a <details>, not useState + onClick, so it opens
 *    with JavaScript off or before hydration (§19.14). It starts below the top
 *    bar so the control that opened it can also close it.
 *  - Desktop is a separate static aside that folds to a 72px icon rail
 *    (SidebarCollapseToggle: a <form>, cookie cosystem_sidebar,
 *    <html data-sidebar>, --sidebar-w). Two elements rather than one because
 *    a closed <details> hides its contents outright, wrong for a sidebar that
 *    must always show from 768px up; the links come from one function so
 *    there is no second copy to keep in step.
 *  - `rail` is true only for the desktop aside. The collapsed: classes key off
 *    an attribute on <html>, which the phone drawer sits under too; they must
 *    not reach the drawer's copy.
 *  - Headings give way to a rule when folded, so sections still read as
 *    sections with no room for their names.
 */
export function SidebarShell({ sections, subtitle, person, labels }: SidebarShellProps) {
  const drawer = useRef<HTMLDetailsElement>(null);

  // Enhancement, not a dependency: without JavaScript a link is a full page
  // load, which resets the drawer anyway.
  const closeDrawer = () => {
    if (drawer.current) drawer.current.open = false;
  };

  const renderNav = (rail: boolean) => {
    const r = (cls: string) => (rail ? cls : "");
    return (
      <>
        <nav
          aria-label="Main"
          className={`flex-1 px-4 pb-2 overflow-y-auto overflow-x-hidden ${r("collapsed:px-2")}`}
        >
          {sections.map((section) => (
            <div key={section.id} data-nav-section={section.id} className="mb-5 last:mb-0">
              <p
                className={`px-4 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-white/35 whitespace-nowrap ${r("collapsed:sr-only")}`}
              >
                {section.heading}
              </p>
              {rail && (
                <div aria-hidden className="hidden collapsed:block mx-2 mb-2 border-t border-white/10" />
              )}
              {section.groups.map((group, gi) => (
                <div key={gi} className="space-y-0.5">
                  {group.label && section.groups.length > 1 && (
                    <p
                      className={`px-4 pt-2 pb-1 text-[10px] font-medium uppercase tracking-wide text-white/25 whitespace-nowrap ${r("collapsed:sr-only")}`}
                    >
                      {group.label}
                    </p>
                  )}
                  {group.items.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={closeDrawer}
                      title={rail ? item.label : undefined}
                      aria-current={item.active ? "page" : undefined}
                      className={`flex items-center gap-3 px-4 py-2.5 rounded-md transition-colors ${r("collapsed:justify-center collapsed:px-0")} ${
                        item.active
                          ? "text-[#80d7b6] bg-white/5"
                          : "text-white/70 hover:text-white hover:bg-white/5"
                      }`}
                    >
                      <span aria-hidden className="material-symbols-outlined text-lg">{item.icon}</span>
                      {/* sr-only rather than hidden: the label is the link's
                          accessible name, folded or not. */}
                      <span className={`text-sm font-medium whitespace-nowrap ${r("collapsed:sr-only")}`}>
                        {item.label}
                      </span>
                    </Link>
                  ))}
                </div>
              ))}
            </div>
          ))}
        </nav>

        <div className={`border-t border-white/10 ${rail ? "px-3 py-3 space-y-1" : "px-6 py-6"}`}>
          {rail && (
            <SidebarCollapseToggle collapseLabel={labels.collapse} expandLabel={labels.expand} />
          )}
          <Link
            href="/"
            onClick={closeDrawer}
            title={rail ? labels.home : undefined}
            className={`flex items-center text-white/50 hover:text-white text-xs transition-colors ${rail ? "gap-3 px-3 py-2 rounded-md hover:bg-white/5 collapsed:justify-center collapsed:px-0" : "gap-2"}`}
          >
            <span aria-hidden className={`material-symbols-outlined ${rail ? "text-lg" : "text-sm"}`}>arrow_back</span>
            <span className={`whitespace-nowrap ${r("collapsed:sr-only")}`}>{labels.home}</span>
          </Link>
        </div>
      </>
    );
  };

  return (
    <>
      {/* ── Phone: top bar that is itself the toggle ──────────────────── */}
      <details ref={drawer} className="md:hidden">
        <summary
          aria-label={labels.menu}
          className="list-none cursor-pointer fixed top-0 left-0 right-0 h-14 bg-ink flex items-center px-4 z-50 gap-3 [&::-webkit-details-marker]:hidden"
        >
          <span aria-hidden className="material-symbols-outlined text-white text-xl p-1.5">
            menu
          </span>
          <p className="text-brand font-bold text-lg">Cosystem</p>
          <p className="text-white/50 text-xs mt-0.5">{subtitle}</p>
        </summary>

        <div
          onClick={closeDrawer}
          className="fixed top-14 left-0 right-0 bottom-0 bg-black/50 z-40"
        />

        <aside className="fixed top-14 left-0 bottom-0 w-64 bg-ink text-white flex flex-col z-50">
          {renderNav(false)}
        </aside>
      </details>

      {/* ── Desktop: always there, full or folded to an icon rail ─────── */}
      <aside
        data-app-sidebar
        className="hidden md:flex fixed top-0 left-0 h-full w-(--sidebar-w) transition-[width] bg-ink text-white flex-col z-50 overflow-hidden"
      >
        <div className="px-6 py-8 collapsed:px-0 collapsed:text-center whitespace-nowrap">
          <p className="text-brand font-bold text-xl collapsed:hidden">Cosystem</p>
          <p aria-hidden className="text-brand font-bold text-xl hidden collapsed:block">C</p>
          <p className="text-white/50 text-xs mt-1 collapsed:hidden">{subtitle}</p>
          {person && (
            <p className="text-white text-sm mt-3 font-medium truncate collapsed:hidden">{person}</p>
          )}
        </div>
        {renderNav(true)}
      </aside>
    </>
  );
}
