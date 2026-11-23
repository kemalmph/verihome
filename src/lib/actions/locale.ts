"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import {
  LOCALE_COOKIE,
  LOCALE_COOKIE_MAX_AGE,
  isLocale,
} from "@/lib/i18n/config";

/**
 * Remember the visitor's language choice.
 *
 * Takes FormData so the switch can be a plain <form action={...}>. That is
 * not ceremony: a button wired with onClick does nothing until React has
 * hydrated, and on a phone over a slow connection that window is long
 * enough to tap in. The visitor presses EN, the page does not change, and
 * the only available conclusion is that the control is broken — which,
 * for that second, it is. As a form it posts and works with no JavaScript
 * at all; once hydrated, Next.js intercepts the submit and the change is
 * seamless either way.
 *
 * `isLocale` is a guard, not a formality: this value arrives from the
 * browser, and writing it into a cookie unchecked would let a crafted
 * request park arbitrary text where every later request reads it.
 *
 * Not httpOnly — nothing here is a secret, and the preference is more
 * useful if client code can read it. `lax` so it survives ordinary
 * navigation; not `secure`, so the switch still works over plain HTTP in
 * local development. In production the whole site is HTTPS regardless.
 */
export async function setLocale(formData: FormData): Promise<void> {
  const next = String(formData.get("locale") ?? "");
  if (!isLocale(next)) return;

  const jar = await cookies();
  jar.set(LOCALE_COOKIE, next, {
    path: "/",
    maxAge: LOCALE_COOKIE_MAX_AGE,
    sameSite: "lax",
  });

  // Every page reads the cookie through the root layout, so the whole tree
  // is stale once it changes — not just the page that was showing.
  revalidatePath("/", "layout");
}
