import "server-only";
import { cookies, headers } from "next/headers";
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, type Locale } from "./config";

/**
 * The locale for this request, in this order (owner's decision, 28 Nov 2026):
 *
 *   1. the visitor's saved choice (the EN/ID switch sets a cookie);
 *   2. Indonesian, if the browser's first language is Indonesian;
 *   3. otherwise English — the site's default, for every other language
 *      and for a browser that sends none.
 *
 * Accept-Language is only a guess and is deliberately outranked by the
 * cookie: someone who reached for the switch has told us something their
 * browser settings did not. Only the FIRST tag counts ("id-ID,en;q=0.9" is
 * Indonesian; "en-US,id;q=0.8" is not).
 *
 * Reading cookies opts the page into dynamic rendering. Every page that
 * calls this is already dynamic (it reads the session to render the navbar),
 * so this costs nothing that was not already being paid.
 */
export async function getLocale(): Promise<Locale> {
  const saved = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(saved)) return saved;

  const accept = (await headers()).get("accept-language") ?? "";
  const first = accept.split(",")[0]?.trim().slice(0, 2).toLowerCase();
  return first === "id" ? "id" : DEFAULT_LOCALE;
}
