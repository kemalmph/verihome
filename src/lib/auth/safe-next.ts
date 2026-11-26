/**
 * Restricts a post-auth redirect target to same-origin paths.
 *
 * Anything else — an absolute URL, a protocol-relative "//host", a scheme like
 * javascript: — falls back to the dashboard. Left unchecked, a `next` taken
 * from the query string turns any auth entry point into an open redirect: a
 * link that genuinely starts on Cosystem and finishes on someone else's login
 * form, which is exactly the shape a credential phish wants.
 *
 * Shared by every place that reads `next` so the rule cannot drift between them.
 */
export function safeNext(raw: string | null | undefined, fallback = "/dashboard"): string {
  if (!raw) return fallback;
  if (!raw.startsWith("/")) return fallback;  // absolute URLs and schemes
  if (raw.startsWith("//")) return fallback;  // protocol-relative
  // Browsers treat "\" as "/" in a URL, so "/\\evil.com" is "//evil.com" to
  // them. Control characters (tab, CR, LF, NUL…) are stripped by URL parsers,
  // which turns "/\t/evil.com" into "//evil.com" the same way. Refuse both,
  // and check the percent-decoded form too ("/%5Cevil.com").
  const hostile = (v: string) => v.includes("\\") || /[\u0000-\u001f\u007f]/.test(v) || v.startsWith("//");
  if (hostile(raw)) return fallback;
  let decoded = raw;
  try {
    for (let i = 0; i < 3 && /%/.test(decoded); i++) decoded = decodeURIComponent(decoded);
  } catch {
    return fallback; // malformed escape: not a path we generated
  }
  if (hostile(decoded)) return fallback;
  return raw;
}
