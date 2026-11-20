/**
 * Restricts a post-auth redirect target to same-origin paths.
 *
 * Anything else — an absolute URL, a protocol-relative "//host", a scheme like
 * javascript: — falls back to the dashboard. Left unchecked, a `next` taken
 * from the query string turns any auth entry point into an open redirect: a
 * link that genuinely starts on VeriHome and finishes on someone else's login
 * form, which is exactly the shape a credential phish wants.
 *
 * Shared by every place that reads `next` so the rule cannot drift between them.
 */
export function safeNext(raw: string | null | undefined, fallback = "/dashboard"): string {
  if (!raw) return fallback;
  if (!raw.startsWith("/")) return fallback;  // absolute URLs and schemes
  if (raw.startsWith("//")) return fallback;  // protocol-relative
  return raw;
}
