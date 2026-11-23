"use client";

import { createContext, useContext } from "react";
import type { Locale } from "./config";
import { t as translate, type StringKey } from "./strings";

/**
 * The request's locale, handed to client components.
 *
 * Only the locale crosses the boundary, not the dictionary: STRINGS is
 * imported by whichever client component needs it and bundled once, so a
 * switch costs two characters of payload rather than a copy of every
 * string in the app.
 */
const LocaleContext = createContext<Locale>("id");

export function LocaleProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  return <LocaleContext value={locale}>{children}</LocaleContext>;
}

export function useLocale(): Locale {
  return useContext(LocaleContext);
}

/** `const t = useT()` in a client component, then `t("nav.pricing")`. */
export function useT(): (key: StringKey) => string {
  const locale = useContext(LocaleContext);
  return (key: StringKey) => translate(key, locale);
}
