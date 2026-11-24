"use client";

import type { FormEvent } from "react";
import { setSidebar } from "@/lib/actions/sidebar";
import {
  SIDEBAR_COLLAPSED,
  SIDEBAR_COOKIE,
  SIDEBAR_COOKIE_MAX_AGE,
} from "@/lib/sidebar/config";

/**
 * The fold/unfold control at the foot of the desktop sidebar.
 *
 * A form, like the language switch, so it works before hydration: the
 * server action sets the cookie and the page comes back at the new width.
 *
 * It holds no state of its own. Both buttons are always rendered and CSS
 * shows the one that fits the current <html data-sidebar>, so the server's
 * HTML is right on first paint and there is nothing to keep in step.
 *
 * Once hydrated, the submit is handled here instead: flip the attribute,
 * write the cookie, done. Waiting on a server round trip to move a panel
 * the browser can move by itself would make the control feel broken in the
 * opposite way.
 */
export function SidebarCollapseToggle({
  collapseLabel,
  expandLabel,
}: {
  collapseLabel: string;
  expandLabel: string;
}) {
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const want = submitter?.value;
    if (want !== SIDEBAR_COLLAPSED && want !== "expanded") return;
    e.preventDefault();

    const root = document.documentElement;
    if (want === SIDEBAR_COLLAPSED) {
      root.dataset.sidebar = SIDEBAR_COLLAPSED;
      document.cookie = `${SIDEBAR_COOKIE}=${SIDEBAR_COLLAPSED}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}; samesite=lax`;
    } else {
      delete root.dataset.sidebar;
      document.cookie = `${SIDEBAR_COOKIE}=; path=/; max-age=0; samesite=lax`;
    }
  };

  const button =
    "w-full flex items-center gap-3 px-3 py-2 rounded-md text-white/50 hover:text-white hover:bg-white/5 text-xs transition-colors collapsed:justify-center collapsed:px-0";

  return (
    <form action={setSidebar} onSubmit={onSubmit}>
      <button
        type="submit"
        name="sidebar"
        value={SIDEBAR_COLLAPSED}
        title={collapseLabel}
        aria-expanded="true"
        className={`${button} collapsed:hidden`}
      >
        <span aria-hidden className="material-symbols-outlined text-lg">left_panel_close</span>
        <span>{collapseLabel}</span>
      </button>
      <button
        type="submit"
        name="sidebar"
        value="expanded"
        title={expandLabel}
        aria-expanded="false"
        className={`${button} hidden collapsed:flex`}
      >
        <span aria-hidden className="material-symbols-outlined text-lg">left_panel_open</span>
        <span className="sr-only">{expandLabel}</span>
      </button>
    </form>
  );
}
