/**
 * Language is a cookie, not a path segment.
 *
 * The alternative — moving every route under app/[lang]/ — buys shareable
 * /en URLs and separate indexing, at the cost of rewriting every link in
 * the app including /admin, /site and /account, which have nothing to do
 * with the public site's language. That trade was weighed and declined.
 *
 * What this cannot do, and no amount of plumbing would: listing
 * descriptions, property names and area names live in single Indonesian
 * columns in the database. Switching to English changes the interface
 * around the catalogue, not the catalogue.
 */
export const LOCALES = ["id", "en"] as const;

export type Locale = (typeof LOCALES)[number];

/**
 * What a visitor sees before choosing, unless their browser's first
 * language is Indonesian (then Indonesian). Owner's decision, 28 Nov 2026;
 * the full order is in getLocale().
 */
export const DEFAULT_LOCALE: Locale = "en";

export const LOCALE_COOKIE = "cosystem_locale";

/** A year: long enough that a returning visitor is never re-asked. */
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function isLocale(value: string | undefined | null): value is Locale {
  return value === "id" || value === "en";
}
