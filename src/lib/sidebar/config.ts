/**
 * Whether the desktop sidebar of /admin, /site and /owner is folded down to
 * an icon rail.
 *
 * A cookie, read by the root layout and written to <html data-sidebar>, for
 * the same reason the language is: the first HTML the server sends must
 * already be the right width. State held only in the browser would paint a
 * full sidebar and then snap it shut on every page load.
 *
 * One cookie for all three areas. They are the same component shape used by
 * the same people; someone who wants more room for a table wants it on the
 * next page too, whichever tree that page lives in.
 */
export const SIDEBAR_COOKIE = "cosystem_sidebar";

export const SIDEBAR_COLLAPSED = "collapsed";

/** A year, like the language choice: a layout preference, not a session. */
export const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
