import "server-only";
import { cookies, headers } from "next/headers";
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, type Locale } from "./config";

/**
 * The locale for this request: the visitor's saved choice, else a guess from
 * the browser, else Indonesian.
 *
 * Accept-Language is only a guess and is deliberately outranked by the
 * cookie. Someone who reached for the EN/ID switch has told us something
 * their browser settings did not, and a site that keeps overriding that
 * choice on the next page is a site that does not listen.
 *
 * Reading cookies opts the page into dynamic rendering. Every page that
 * calls this is already dynamic (it reads the session to render the navbar),
 * so this costs nothing that was not already being paid.
 */
export async function getLocale(): Promise<Locale> {
  const jar = await cookies();
  const saved = jar.get(LOCALE_COOKIE)?.value;
  if (isLocale(saved)) return saved;

  // "en-GB,en;q=0.9,id;q=0.8" — the first tag is the one that counts.
  const accept = (await headers()).get("accept-language") ?? "";
  const first = accept.split(",")[0]?.trim().slice(0, 2).toLowerCase();
  if (first === "en") return "en";
  if (first === "id") return "id";

  return DEFAULT_LOCALE;
}
