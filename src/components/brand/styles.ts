/**
 * Class recipes for the V7 design language, for elements that are links as
 * often as buttons (so a component would get in the way of <Link>).
 *
 *   <Link href="/contact" className={pill.primary}>…</Link>
 *
 * Pills are the new button shape. The older pages still use rounded-lg
 * buttons; they move over as each page is redesigned.
 */
const pillBase =
  "inline-flex items-center justify-center gap-2 rounded-full font-bold text-sm transition-all " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 " +
  "disabled:opacity-50 disabled:pointer-events-none";

export const pill = {
  /** Orange, white text. The one main action in a view. */
  primary: `${pillBase} px-[22px] py-3.5 bg-brand text-white shadow-brand hover:bg-brand-strong hover:-translate-y-px`,
  /** White with a hairline border. The second action beside a primary. */
  secondary: `${pillBase} px-[22px] py-3.5 bg-white text-ink border border-black/10 hover:border-black/20`,
  /** Compact primary for headers and toolbars. */
  primarySm: `${pillBase} px-4 py-2.5 bg-brand text-white shadow-brand hover:bg-brand-strong`,
} as const;

/** Small uppercase label above a heading. */
export const kicker = "text-xs font-extrabold uppercase tracking-[0.12em] text-brand-ink";
