import "server-only";
import { cookies } from "next/headers";
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, type Locale } from "./config";

/**
 * The locale for this request: the visitor's saved choice, else English.
 *
 * Until 28 Nov 2026 a visitor with no saved choice got a guess from
 * Accept-Language. The owner made English the default for everyone, so the
 * browser's language is no longer consulted: an Indonesian phone sees the
 * English site until its owner presses ID, and from then on the cookie
 * keeps that choice.
 *
 * Reading cookies opts the page into dynamic rendering. Every page that
 * calls this is already dynamic (it reads the session to render the navbar),
 * so this costs nothing that was not already being paid.
 */
export async function getLocale(): Promise<Locale> {
  const saved = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(saved) ? saved : DEFAULT_LOCALE;
}
