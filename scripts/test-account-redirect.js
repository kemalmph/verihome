#!/usr/bin/env node
/**
 * /dashboard → /account (28 Nov 2026): the customer area was renamed.
 *
 * Checks, against a running build:
 *   1. /dashboard and /dashboard/* answer 308 to the same path under /account,
 *      query string intact.
 *   2. No variant leaves the origin. Raw HTTP requests are used so the path
 *      reaches the server exactly as written — fetch() and browsers normalise
 *      a backslash to a slash before sending, which would test the client,
 *      not the redirect.
 *   3. Followed to the end in a real browser, signed in and signed out, every
 *      hop stays on this origin and a signed-in guest lands on the page.
 *   4. src/ no longer links to /dashboard for the customer area (the only
 *      "/dashboard" left in src/ are the coworking operator pages under
 *      /site/<id>/dashboard; the redirect rule itself lives in next.config.ts).
 *
 *   npm run build && npm run start
 *   NODE_PATH=/opt/node-tools/node_modules node scripts/test-account-redirect.js
 * Env: SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY for the signed-in part.
 */
const http = require("http");
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");
const { createClient } = require("@supabase/supabase-js");
const { createServerClient } = require("@supabase/ssr");

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const SUPA = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
const ANON = process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const origin = new URL(BASE);

const pass = [];
const fail = [];
const check = (ok, what) => { (ok ? pass : fail).push(what); if (!ok) console.log("  FAIL", what); };

/** One request, path sent byte for byte, redirect not followed. */
function raw(rawPath, method = "GET") {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { host: origin.hostname, port: origin.port, method, path: rawPath, headers: { host: origin.host } },
      (res) => { res.resume(); res.on("end", () => resolve({ status: res.statusCode, location: res.headers.location ?? "" })); },
    );
    req.on("error", reject);
    req.end();
  });
}

/** Where a Location header actually sends a browser, resolved against the request URL. */
const target = (location, from) => new URL(location, new URL(from, BASE));

/**
 * Follow a redirect chain with raw requests (at most 6 hops). Next.js may
 * first normalise the path itself — collapse "//", turn "\" into "/", drop a
 * trailing slash — with a redirect to the cleaned /dashboard path, and only
 * then apply ours. Every hop is returned so each one can be checked.
 */
async function chain(start) {
  const hops = [];
  let cur = start;
  for (let i = 0; i < 6; i++) {
    const r = await raw(cur);
    hops.push({ from: cur, ...r });
    if (!(r.status >= 300 && r.status < 400) || !r.location) break;
    const t = target(r.location, cur);
    if (t.origin !== origin.origin) break; // stop: the check below fails it
    cur = t.pathname + t.search;
  }
  return hops;
}
/** The hop where the redirect arrives under /account; everything before it is path normalisation + ours. */
const arrival = (hops) => {
  const i = hops.findIndex((h) => h.status >= 300 && h.status < 400 && target(h.location, h.from).pathname.startsWith("/account"));
  return i < 0 ? null : { i, hop: hops[i], upTo: hops.slice(0, i + 1) };
};
const isSafeLocation = (loc, from) =>
  !/^\s*(\/\/|\\\\|\/\\|[a-z][a-z0-9+.-]*:)/i.test(loc) && target(loc, from).origin === origin.origin;

(async () => {
  // ── 1. 308, path and query intact ────────────────────────────────────────
  const CASES = [
    ["/dashboard", "/account"],
    ["/dashboard/", "/account"],
    ["/dashboard/bookings", "/account/bookings"],
    ["/dashboard/receipts/9f1c2d3e-0000-4000-8000-000000000001?x=1", "/account/receipts/9f1c2d3e-0000-4000-8000-000000000001?x=1"],
    ["/dashboard/statement?months=3&a=b%20c", "/account/statement?months=3&a=b%20c"],
    ["/dashboard/unit/abc/def", "/account/unit/abc/def"],
  ];
  // Signed out, the chain continues past /account to the proxy's sign-in
  // redirect; that hop is the proxy's business, checked for safety below.
  const show = (hops) => hops.map((h) => `${h.status} ${h.location || h.from}`).join(" → ");
  for (const [from, want] of CASES) {
    const hops = await chain(from);
    const a = arrival(hops);
    const t = a ? target(a.hop.location, a.hop.from) : null;
    check(!!a && a.upTo.every((h) => h.status === 308), `${from}: 308 to /account (${show(hops)})`);
    check(!!t && t.origin === origin.origin && t.pathname + t.search === want, `${from} → ${want} (${show(hops)})`);
    check(hops.filter((h) => h.location).every((h) => isSafeLocation(h.location, h.from)), `${from}: every hop stays on this origin`);
  }
  {
    const r = await raw("/dashboard/bookings", "POST");
    check(r.status === 308, `POST /dashboard/bookings: 308 keeps the method (got ${r.status})`);
  }

  // ── 2. never off-origin ─────────────────────────────────────────────────
  const HOSTILE = [
    "/dashboard//evil.com",
    "/dashboard///evil.com",
    "/dashboard/\\evil.com",
    "/dashboard/\\\\evil.com",
    "/dashboard/%2F%2Fevil.com",
    "/dashboard/%5C%5Cevil.com",
    "/dashboard/%5Cevil.com",
    "/dashboard/https://evil.com",
    "/dashboard/https:%2F%2Fevil.com",
    "/dashboard/..%2F..%2F%2Fevil.com",
    "/dashboard/%09/evil.com",
    "/dashboard?next=//evil.com",
  ];
  for (const p of HOSTILE) {
    let hops;
    try { hops = await chain(p); } catch (e) { hops = [{ from: p, status: 0, location: "" }]; }
    const allSafe = hops.filter((h) => h.location).every((h) => isSafeLocation(h.location, h.from));
    const a = arrival(hops);
    // Arrives under /account on this origin, or was refused outright.
    const refusedOutright = hops[0].status === 0 || hops[0].status >= 400;
    check(allSafe && (!!a || refusedOutright), `${p}: every hop stays on this origin, via /account (${show(hops)})`);
  }

  // ── 3. followed in a browser ────────────────────────────────────────────
  const browser = await chromium.launch();
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const hops = [];
    page.on("request", (rq) => { if (rq.isNavigationRequest()) hops.push(rq.url()); });
    for (const p of ["/dashboard//evil.com", "/dashboard/receipts/x?y=1", "/dashboard"]) {
      hops.length = 0;
      await page.goto(BASE + p, { waitUntil: "domcontentloaded" }).catch(() => {});
      check(hops.every((h) => new URL(h).origin === origin.origin),
        `signed out, ${p}: every hop stays on this origin (${hops.map((h) => new URL(h).pathname).join(" → ")})`);
      check(new URL(page.url()).origin === origin.origin, `signed out, ${p}: ends on this origin`);
    }
    await ctx.close();
  }
  if (ANON && SERVICE) {
    const svc = createClient(SUPA, SERVICE, { auth: { persistSession: false } });
    const email = `acct-redirect-${Date.now().toString(36)}@test.invalid`;
    const password = "AcctRedirect!2468";
    const { data, error } = await svc.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: "Acct Redirect" } });
    if (error) throw new Error(error.message);
    const jar = new Map();
    const sb = createServerClient(SUPA, ANON, { cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: (c) => c.forEach(({ name, value }) => jar.set(name, value)) } });
    await sb.auth.signInWithPassword({ email, password });
    const ctx = await browser.newContext();
    await ctx.addCookies([...jar].map(([name, value]) => ({ name, value, url: BASE })));
    const page = await ctx.newPage();
    await page.goto(BASE + "/dashboard", { waitUntil: "domcontentloaded" });
    check((await page.locator("aside").count()) >= 1, "signed in: /account renders its own sidebar");
    const label = await page.locator('aside nav a[href="/account"]').first().textContent().catch(() => "");
    check(/Akun Saya|My Account/.test(label ?? ""), `sidebar names the area "Akun Saya" / "My Account" (got "${(label ?? "").trim()}")`);
    for (const [p, want] of [["/dashboard", "/account"], ["/dashboard/bookings", "/account/bookings"], ["/dashboard/statement?months=6", "/account/statement"]]) {
      const res = await page.goto(BASE + p, { waitUntil: "domcontentloaded" });
      const u = new URL(page.url());
      check(u.pathname === want && res && res.status() === 200, `signed in, ${p}: lands on ${want} with 200 (at ${u.pathname}${u.search}, ${res && res.status()})`);
      if (p.includes("?")) check(u.search === "?months=6", `signed in, ${p}: query kept (${u.search})`);
    }
    await ctx.close();
    await svc.auth.admin.deleteUser(data.user.id).catch(() => {});
  } else {
    console.log("  (skipped the signed-in part: set SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY)");
  }
  await browser.close();

  // ── 4. nothing in src/ links to the old customer area ───────────────────
  const offenders = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const f = path.join(dir, e.name);
      if (e.isDirectory()) walk(f);
      else if (/\.(ts|tsx)$/.test(e.name)) {
        fs.readFileSync(f, "utf8").split("\n").forEach((line, i) => {
          // A path that starts with /dashboard — quoted, templated, after "=",
          // or after an origin variable. /site/<id>/dashboard never matches:
          // there the segment follows a slug, not one of these.
          if (/(["'`=]|_URL\}|origin\})\/dashboard\b/.test(line)) offenders.push(`${path.relative(process.cwd(), f)}:${i + 1}: ${line.trim()}`);
        });
      }
    }
  };
  walk(path.join(process.cwd(), "src"));
  // menu.ts names the site page "/dashboard" as a path *suffix* under /site/<slug>.
  const real = offenders.filter((o) => !/src\/lib\/nav\/menu\.ts:.*path: "\/dashboard".*site\.view/.test(o));
  check(real.length === 0, `src/ has no link to the customer /dashboard (${real.length ? real.join(" | ") : "none"})`);
  check(!fs.existsSync(path.join(process.cwd(), "src/app/dashboard")), "src/app/dashboard is gone (moved to src/app/account)");

  console.log(`\n${pass.length} passed, ${fail.length} failed`);
  process.exit(fail.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
