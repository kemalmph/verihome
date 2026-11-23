"use server";

import { cookies } from "next/headers";
import {
  LOCALE_COOKIE,
  LOCALE_COOKIE_MAX_AGE,
  isLocale,
} from "@/lib/i18n/config";

/**
 * Remember the visitor's language choice.
 *
 * `isLocale` is a guard, not a formality: this value arrives from the
 * browser, and writing it into a cookie unchecked would let a crafted
 * request park arbitrary text where every later request reads it.
 *
 * Not httpOnly — nothing here is a secret, and the preference is more
 * useful if client code can read it. It is `lax` and not `secure` only
 * so the switch keeps working over plain HTTP in local development;
 * in production the whole site is HTTPS anyway.
 */
export async function setLocale(next: string): Promise<void> {
  if (!isLocale(next)) return;

  const jar = await cookies();
  jar.set(LOCALE_COOKIE, next, {
    path: "/",
    maxAge: LOCALE_COOKIE_MAX_AGE,
    sameSite: "lax",
  });
}
