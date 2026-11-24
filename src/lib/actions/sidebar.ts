"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import {
  SIDEBAR_COLLAPSED,
  SIDEBAR_COOKIE,
  SIDEBAR_COOKIE_MAX_AGE,
} from "@/lib/sidebar/config";

/**
 * Fold or unfold the desktop sidebar.
 *
 * This is the path taken before React hydrates (or with JavaScript off).
 * Once hydrated, SidebarCollapseToggle handles the submit in the browser
 * and never reaches here, so the rail moves without a round trip.
 *
 * The form says which state it wants rather than asking for a flip. A flip
 * pressed twice by an impatient hand on a slow connection lands back where
 * it started; a target value is the same answer however often it arrives.
 */
export async function setSidebar(formData: FormData): Promise<void> {
  const want = String(formData.get("sidebar") ?? "");
  const jar = await cookies();

  if (want === SIDEBAR_COLLAPSED) {
    jar.set(SIDEBAR_COOKIE, SIDEBAR_COLLAPSED, {
      path: "/",
      maxAge: SIDEBAR_COOKIE_MAX_AGE,
      sameSite: "lax",
    });
  } else if (want === "expanded") {
    jar.delete(SIDEBAR_COOKIE);
  } else {
    return;
  }

  // The attribute lives on <html>, rendered by the root layout.
  revalidatePath("/", "layout");
}
