#!/usr/bin/env node
/**
 * The one shared sidebar (/admin, /site, /survey, /owner), checked against the
 * app it claims to navigate and against the permission model.
 *
 * What has to hold, each checked rather than assumed:
 *
 *   SHOWN == ALLOWED. For every role (superadmin, admin_general,
 *   admin_listings, admin_finance, surveyor), for a property owner, and for an
 *   owner who is also staff, the links in the sidebar are EXACTLY the set the
 *   hand-written matrix below says. The matrix is written out here, not read
 *   from src/lib/nav/menu.ts, so the test fails when the menu drifts.
 *
 *   HIDDEN == REFUSED. Every nav URL a viewer is not shown is requested
 *   directly with their real session cookie and must be refused (redirected).
 *   Hiding a link is a courtesy; the page's own guard is the control, and
 *   this is the check that it exists on every one of them. Every URL a viewer
 *   IS shown must open (200).
 *
 *   Sections with nothing in them are not drawn (a surveyor sees one section,
 *   not three headings over nothing).
 *
 *   It works with JavaScript off, and the phone drawer opens without it.
 *
 *   The default page after sign-in: staff -> the first item they have, a
 *   property owner who is not staff -> /owner, a guest -> /dashboard.
 *
 *   The two older checks stay: no link goes nowhere (superadmin walks the
 *   whole menu, no 5xx), and no page is missing from the menu (every literal
 *   activeHref a page passes has a nav entry).
 *
 *   npm run build && npm run start   (local Supabase env)
 *   NODE_PATH=/opt/node-tools/node_modules node scripts/test-admin-nav.js
 *
 * Env: SUPABASE_ANON_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY),
 * SUPABASE_SERVICE_ROLE_KEY, DATABASE_URL; optional SUPABASE_URL, BASE_URL.
 * Local only. Nothing is written to a file.
 */
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");
const { Client } = require("pg");
const { createClient } = require("@supabase/supabase-js");
const { createServerClient } = require("@supabase/ssr");
const { execFileSync } = require("child_process");

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const SUPA = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
const ANON = process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DB = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const PASSWORD = "NavTest!12345";
const RUN = Date.now().toString(36);

if (!/127\.0\.0\.1|localhost/.test(SUPA)) { console.error("Refusing: SUPABASE_URL is not local."); process.exit(1); }
if (!ANON || !SERVICE) { console.error("Set SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY."); process.exit(1); }

const pass = [];
const fail = [];
const check = (ok, what) => { (ok ? pass : fail).push(what); if (!ok) console.log(`  FAIL ${what}`); };
const same = (a, b) => a.length === b.length && [...a].sort().join("|") === [...b].sort().join("|");
const fmt = (a) => `[${[...a].sort().join(", ")}]`;

// ── The matrix, by hand ─────────────────────────────────────────────────────
const OWNER_ITEMS = [
  "/owner", "/owner/properties", "/owner/bookings", "/owner/viewings",
  "/owner/earnings", "/owner/placements", "/owner/profile",
];
// Every staff-facing nav URL that exists; each row says who may open it.
// (An item is shown iff its page accepts the viewer — see menu.ts.)
const SITE_SLUG = `navtest-${RUN}`;
const STAFF_URLS = {
  "/admin": ["superadmin", "admin_general", "admin_listings", "admin_finance"],
  "/admin/users": ["superadmin", "admin_general"],
  "/admin/users?tab=admins": ["superadmin"],
  "/admin/reports/position": ["superadmin", "admin_finance"],
  "/admin/reports/sales": ["superadmin", "admin_finance"],
  "/admin/expenses": ["superadmin", "admin_finance"],
  "/admin/placements": ["superadmin", "admin_finance"],
  "/admin/cron": ["superadmin"],
  "/admin/settings": ["superadmin"],
  "/site": ["superadmin", "admin_general", "admin_finance"],
  "/admin/listings": ["superadmin", "admin_general", "admin_listings"],
  "/admin/inventory": ["superadmin", "admin_general", "admin_listings"],
  "/admin/bookings": ["superadmin", "admin_general", "admin_listings", "admin_finance"],
  "/admin/viewings": ["superadmin", "admin_general", "admin_listings", "admin_finance"],
  "/admin/consultations": ["superadmin", "admin_general", "admin_listings"],
  "/admin/owners": ["superadmin", "admin_general", "admin_listings", "admin_finance"],
  "/admin/owner-requests": ["superadmin", "admin_general", "admin_listings", "admin_finance"],
  "/survey": ["superadmin", "admin_general", "admin_listings", "surveyor"],
  "/admin/surveys/pending": ["superadmin", "admin_general", "admin_listings"],
};
/**
 * Phase 3: each site is a group of pages, each shown iff the viewer's site
 * permission for that page holds there (site-permissions.ts). By hand, for the
 * global roles: operate_all and finance_all both read every page; only a
 * superadmin manages site staff. Site owners and site staff are covered in
 * scripts/test-site-isolation.js.
 */
const SITE_READERS = ["superadmin", "admin_general", "admin_finance"];
function addSitePages(slug) {
  for (const sub of ["", "/dashboard", "/members", "/calendar"]) STAFF_URLS[`/site/${slug}${sub}`] = SITE_READERS;
  STAFF_URLS[`/site/${slug}/staff`] = ["superadmin"];
}
addSitePages(SITE_SLUG);
const ROLES = ["superadmin", "admin_general", "admin_listings", "admin_finance", "surveyor"];
const SECTIONS_OF = (href) =>
  href.startsWith("/owner") ? "marketplace"
  : href.startsWith("/site") ? "site"
  : ["/admin/listings", "/admin/inventory", "/admin/bookings", "/admin/viewings", "/admin/consultations",
     "/admin/owners", "/admin/owner-requests", "/survey", "/admin/surveys/pending"].includes(href) ? "marketplace"
  : "admin";

/** Who -> {roles, owner}; the expected set follows from the table above. */
const PEOPLE = {
  superadmin:     { roles: ["superadmin"], owner: false },
  admin_general:  { roles: ["admin_general"], owner: false },
  admin_listings: { roles: ["admin_listings"], owner: false },
  admin_finance:  { roles: ["admin_finance"], owner: false },
  surveyor:       { roles: ["surveyor"], owner: false },
  owner:          { roles: [], owner: true },
  owner_finance:  { roles: ["admin_finance"], owner: true },
  guest:          { roles: [], owner: false },
  invited_owner:  { roles: [], owner: false, invited: true },
  // Phase 3: an active owners row with NO property, owning a coworking site.
  // Sees Site Management only; the property portal items stay hidden.
  site_owner:     { roles: [], owner: false, siteOwner: true },
};
const SITE_OWNER_SLUG = `navsiteowner-${RUN}`;
const SITE_OWNER_PAGES = ["", "/dashboard", "/members", "/calendar", "/staff"].map((p) => `/site/${SITE_OWNER_SLUG}${p}`);
const LANDING = {
  superadmin: "/admin", admin_general: "/admin", admin_listings: "/admin", admin_finance: "/admin",
  surveyor: "/survey", owner: "/owner", owner_finance: "/admin", guest: "/dashboard", invited_owner: "/dashboard",
  site_owner: `/site/${SITE_OWNER_SLUG}`,
};
function expectedFor(who) {
  const p = PEOPLE[who];
  const staff = Object.entries(STAFF_URLS)
    .filter(([, allowed]) => p.roles.some((r) => allowed.includes(r)))
    .map(([h]) => h);
  // /site/<slug> exists only because the fixture site does.
  return [...staff, ...(p.owner ? OWNER_ITEMS : []), ...(p.siteOwner ? SITE_OWNER_PAGES : [])];
}

/** Menu catalog, read from the source, for the "no page without a link" check. */
function catalogHrefs() {
  const src = fs.readFileSync(path.join(__dirname, "..", "src", "lib", "nav", "menu.ts"), "utf8");
  return [...src.matchAll(/href:\s*"([^"]+)"/g)].map((m) => m[1]);
}
/** Literal activeHref values the pages pass to the sidebar. */
function claimedHrefs() {
  const root = path.join(__dirname, "..", "src", "app");
  let out = "";
  try {
    // /dashboard is the tenant area and keeps its own sidebar: not in the menu.
    out = execFileSync("grep", ["-rhoE", "--exclude-dir=dashboard", 'activeHref="[^"]+"', root], { encoding: "utf8" });
  } catch { /* none */ }
  return [...new Set(out.split("\n").filter(Boolean).map((l) => l.replace(/activeHref="|"/g, "")))];
}

(async () => {
  const db = new Client({ connectionString: DB });
  await db.connect();
  const q = async (sql, args = []) => (await db.query(sql, args)).rows;
  const svc = createClient(SUPA, SERVICE, { auth: { persistSession: false } });

  // ── fixtures ──────────────────────────────────────────────────────────────
  const users = {};
  const made = { owners: [], sites: [] };
  for (const who of Object.keys(PEOPLE)) {
    const email = `nav-${who}-${RUN}@test.invalid`;
    const { data, error } = await svc.auth.admin.createUser({
      email, password: PASSWORD, email_confirm: true, user_metadata: { full_name: `Nav ${who}` },
    });
    if (error) throw new Error(`createUser ${who}: ${error.message}`);
    await svc.from("users").upsert({ id: data.user.id, name: `Nav ${who}`, email }, { onConflict: "id" });
    users[who] = { id: data.user.id, email };
    for (const role of PEOPLE[who].roles) {
      await q("insert into staff_roles(user_id, role) values ($1,$2)", [data.user.id, role]);
    }
    if (PEOPLE[who].owner || PEOPLE[who].invited || PEOPLE[who].siteOwner) {
      const { data: o, error: oe } = await svc.from("owners").insert({
        name: `Nav Owner ${who}`, email: `owner-${who}-${RUN}@test.invalid`, phone_whatsapp: "628000000000",
        user_id: data.user.id, portal_access: PEOPLE[who].invited ? "invited" : "active",
      }).select("id").single();
      if (oe) throw new Error(`owner ${who}: ${oe.message}`);
      made.owners.push(o.id);
      users[who].ownerId = o.id;
      // The property portal is offered only to an owner with a property.
      if (PEOPLE[who].owner) {
        const [{ id: pid }] = await q("insert into properties(name, slug, owner_id) values ($1,$2,$3) returning id",
          [`Nav Prop ${who}`, `navprop-${who.replace(/_/g, "-")}-${RUN}`, o.id]);
        (made.properties ??= []).push(pid);
      }
      if (PEOPLE[who].siteOwner) {
        const [{ id: sid }] = await q("insert into sites(name, slug, owner_id) values ($1,$2,$3) returning id",
          [`Nav Site Owner ${RUN}`, SITE_OWNER_SLUG, o.id]);
        made.sites.push(sid);
      }
    }
  }
  // Other suites leave sites behind: every one of them is a menu entry too
  // (the site owner's own site included: global staff see it like any other).
  for (const s of await q("select slug from sites")) {
    addSitePages(s.slug);
  }
  {
    const { data: s, error } = await svc.from("sites").insert({ name: `Nav Test Site ${RUN}`, slug: SITE_SLUG }).select("id").single();
    if (error) throw new Error(`site: ${error.message}`);
    made.sites.push(s.id);
  }

  async function sessionFor(u) {
    const jar = new Map();
    const sb = createServerClient(SUPA, ANON, {
      cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: (c) => c.forEach(({ name, value }) => jar.set(name, value)) },
    });
    const { error } = await sb.auth.signInWithPassword({ email: u.email, password: PASSWORD });
    if (error) throw new Error(`sign-in ${u.email}: ${error.message}`);
    return [...jar].map(([name, value]) => ({ name, value }));
  }
  const sessions = {};
  for (const who of Object.keys(PEOPLE)) sessions[who] = await sessionFor(users[who]);
  const header = (who) => sessions[who].map((c) => `${c.name}=${c.value}`).join("; ");

  const browser = await chromium.launch();
  const errors5xx = [];

  /** hrefs in the sidebar's <nav>, from the DOM (visible or not: a hidden link is still a leaked one). */
  async function navFrom(who, urlPath, { js = true, viewport = { width: 1280, height: 800 } } = {}) {
    const ctx = await browser.newContext({ viewport, javaScriptEnabled: js });
    await ctx.addCookies(sessions[who].map((c) => ({ ...c, url: BASE })));
    const page = await ctx.newPage();
    page.on("response", (r) => { if (r.status() >= 500) errors5xx.push(`${r.status()} ${r.url()}`); });
    await page.goto(BASE + urlPath, { waitUntil: "load" });
    if (js) await page.waitForTimeout(800);
    const out = await page.evaluate(() => {
      // The desktop aside and the phone drawer carry the same links; take the
      // desktop one for the set and count the drawer separately.
      const desktop = document.querySelector("aside[data-app-sidebar] nav");
      const drawer = document.querySelector("details.md\\:hidden aside nav");
      const hrefs = (n) => (n ? [...n.querySelectorAll("a[href]")].map((a) => a.getAttribute("href")) : []);
      const sections = (n) => (n ? [...n.querySelectorAll("[data-nav-section]")].map((s) => s.getAttribute("data-nav-section")) : []);
      const current = desktop ? [...desktop.querySelectorAll('a[aria-current="page"]')].map((a) => a.getAttribute("href")) : [];
      return { url: location.pathname, desktop: hrefs(desktop), drawer: hrefs(drawer), sections: sections(desktop), drawerSections: sections(drawer), current };
    });
    await ctx.close();
    return out;
  }

  const fetchAs = async (who, p) => {
    const res = await fetch(BASE + p, { redirect: "manual", headers: who ? { Cookie: header(who) } : {} });
    return { status: res.status, location: res.headers.get("location") ?? "" };
  };
  const opens = (r) => r.status === 200;
  // A site page the viewer may not open is not-found (it does not confirm the
  // site exists); every other hidden page redirects.
  const refused = (r) => (r.status >= 300 && r.status < 400) || r.status === 404;

  // ── 1. the matrix: shown == allowed, hidden == refused ───────────────────
  const landingPage = { surveyor: "/survey", owner: "/owner", owner_finance: "/admin", site_owner: `/site/${SITE_OWNER_SLUG}` };
  for (const who of Object.keys(PEOPLE)) {
    const expected = expectedFor(who);
    if (who === "guest" || who === "invited_owner") {
      // Neither staff nor an active owner: no staff page and no owner page opens.
      for (const p of [...Object.keys(STAFF_URLS), ...OWNER_ITEMS]) {
        const r = await fetchAs(who, p);
        check(refused(r), `${who}: ${p} is refused when opened directly (${r.status})`);
      }
      continue;
    }
    const start = landingPage[who] ?? "/admin";
    const got = await navFrom(who, start);
    check(got.url === start, `${who}: ${start} opens (landed on ${got.url})`);
    check(same(got.desktop, expected), `${who}: sidebar shows exactly the matrix\n      expected ${fmt(expected)}\n      got      ${fmt(got.desktop)}`);
    check(same(got.drawer, expected), `${who}: phone drawer has the same links as the desktop rail`);

    const wantSections = [...new Set(expected.map(SECTIONS_OF))];
    check(same(got.sections, wantSections), `${who}: sections drawn are exactly ${fmt(wantSections)} (got ${fmt(got.sections)})`);
    check(got.sections.length === new Set(got.sections).size, `${who}: no section is drawn twice`);

    // Same answer with JavaScript off: the menu is server-rendered.
    const noJs = await navFrom(who, start, { js: false });
    check(same(noJs.desktop, expected), `${who}: same sidebar with JavaScript off`);

    // Hidden URLs are refused; shown ones open.
    // The /owner gate is unchanged in Phase 3: a site-only owner is still an
    // active owner and may open /owner — the portal is only left out of their
    // menu. Their owner pages are checked separately below.
    const everything = [...Object.keys(STAFF_URLS), ...(who === "site_owner" ? [] : OWNER_ITEMS)];
    for (const p of everything) {
      const r = await fetchAs(who, p);
      if (expected.includes(p)) check(opens(r), `${who}: shown ${p} opens (${r.status})`);
      else check(refused(r), `${who}: hidden ${p} is refused when opened directly (${r.status} ${r.location})`);
    }
  }

  // ── 1b. site-only owner: property portal hidden, gate unchanged ─────────
  {
    const got = await navFrom("site_owner", `/site/${SITE_OWNER_SLUG}`);
    check(!got.desktop.some((h) => h.startsWith("/owner")), "site_owner: no property-portal items in the sidebar");
    check(same(got.sections, ["site"]), `site_owner: Site Management is the only section (got ${fmt(got.sections)})`);
    const r = await fetchAs("site_owner", "/owner");
    check(r.status === 200, `site_owner: the /owner gate is unchanged — /owner still opens (${r.status})`);
    // Give them a property: the portal items appear next to the site.
    const [{ id: pid }] = await q("insert into properties(name, slug, owner_id) values ('Nav SO Prop',$1,$2) returning id",
      [`navprop-so-${RUN}`, users.site_owner.ownerId]);
    made.properties.push(pid);
    const both = await navFrom("site_owner", `/site/${SITE_OWNER_SLUG}`);
    check(same(both.desktop, [...SITE_OWNER_PAGES, ...OWNER_ITEMS]), `site_owner with a property: site pages + property portal (got ${fmt(both.desktop)})`);
    await q("delete from properties where id=$1", [pid]);
    made.properties = made.properties.filter((x) => x !== pid);
  }

  // ── 2. signed-out visitors ────────────────────────────────────────────────
  for (const p of ["/admin", "/site", "/survey", "/owner"]) {
    const r = await fetchAs(null, p);
    check(r.status >= 300 && r.status < 400, `signed out: ${p} redirects (${r.status} ${r.location})`);
  }

  // ── 2b. /admin shows listing data only to those entitled to it ──────────
  {
    const marker = `NAVMARK-${RUN}`;
    const { data: prop, error: pe } = await svc.from("properties").insert({
      name: marker, slug: `navmark-${RUN}`, area: "Navarea", property_type: "apartment",
      price_monthly: 7654321, bedrooms: 1, bathrooms: 1, status: "draft", rental_mode: "short_stay",
    }).select("id").single();
    if (pe) throw new Error(`property: ${pe.message}`);
    (made.properties ??= []).push(prop.id);
    const body = async (who) => {
      const res = await fetch(BASE + "/admin", { redirect: "manual", headers: { Cookie: header(who) } });
      return { status: res.status, location: res.headers.get("location") ?? "", text: res.status === 200 ? await res.text() : "" };
    };
    // Property NAMES may legitimately appear for finance.view inside the
    // commission warning (owner decision); prices and the listing widgets may not.
    const leaks = (t) => t.includes("7.654.321") || /Pending Reviews|Today.s Consultations|Recent Owner Submissions/.test(t);
    const sv = await body("surveyor");
    check(sv.status >= 300 && sv.status < 400 && !leaks(sv.text), `surveyor opens /admin: redirected, no listing data (${sv.status} ${sv.location})`);
    const lst = await body("admin_listings");
    check(lst.status === 200 && lst.text.includes(marker), "admin_listings sees listing data on /admin");
    const gen = await body("admin_general");
    check(gen.status === 200 && gen.text.includes(marker), "admin_general sees listing data on /admin");
    const fin = await body("admin_finance");
    check(fin.status === 200 && !leaks(fin.text), "admin_finance opens /admin and sees no listing, consultation or review widgets");
    const ownerFin = await body("owner_finance");
    check(ownerFin.status === 200 && !leaks(ownerFin.text), "owner+finance sees no listing widgets on /admin");
    // Commission warning (no platform default set locally): listings.manage and finance.view see it.
    const warn = (t) => /belum punya komisi platform/.test(t);
    await q("update platform_settings set default_commission_pct = null where id = 1");
    const w = { listings: warn((await body("admin_listings")).text), finance: warn((await body("admin_finance")).text) };
    check(w.listings && w.finance, `commission warning shows for listings.manage and finance.view (${JSON.stringify(w)})`);
  }

  // ── 3. one person, several relations: union, no role picker ──────────────
  {
    const f = expectedFor("admin_finance");
    const both = expectedFor("owner_finance");
    check(same(both, [...new Set([...f, ...OWNER_ITEMS])]), "matrix: owner+finance is the union of both");
    const got = await navFrom("owner_finance", "/admin");
    check(got.sections.includes("admin") && got.sections.includes("marketplace"), "owner+finance: sees the admin and marketplace sections together");
    const picker = await (async () => {
      const ctx = await browser.newContext();
      await ctx.addCookies(sessions.owner_finance.map((c) => ({ ...c, url: BASE })));
      const page = await ctx.newPage();
      await page.goto(BASE + "/admin", { waitUntil: "load" });
      const n = await page.locator('select, [role="combobox"], [data-role-picker]').count();
      await ctx.close();
      return n;
    })();
    check(picker === 0, "owner+finance: there is no role picker");
  }

  // ── 4. exactly one active item, and it is the right one ──────────────────
  {
    const cases = [
      ["superadmin", "/admin", "/admin"],
      ["superadmin", "/admin/users", "/admin/users"],
      ["superadmin", "/admin/users?tab=admins", "/admin/users?tab=admins"],
      ["superadmin", "/admin/reports/sales", "/admin/reports/sales"],
      ["superadmin", `/site/${SITE_SLUG}`, `/site/${SITE_SLUG}`],
      ["superadmin", "/site", "/site"],
      ["surveyor", "/survey", "/survey"],
      ["owner", "/owner/earnings", "/owner/earnings"],
      ["owner", "/owner", "/owner"],
    ];
    for (const [who, p, want] of cases) {
      const got = await navFrom(who, p);
      check(got.current.length === 1 && got.current[0] === want, `${who}: ${p} highlights exactly ${want} (got ${fmt(got.current)})`);
    }
    // A survey record is under "Surveys".
    const prop = (await q("select id from properties limit 1"))[0];
    if (prop) {
      const got = await navFrom("surveyor", `/survey/${prop.id}`);
      check(got.current.length === 1 && got.current[0] === "/survey", "surveyor: a survey form highlights Surveys");
    }
  }

  // ── 5. no link goes nowhere; no page is missing from the menu ────────────
  {
    for (const p of expectedFor("superadmin")) {
      const r = await fetchAs("superadmin", p);
      check(opens(r), `superadmin walks the menu: ${p} -> ${r.status}`);
    }
    const catalog = catalogHrefs().map((h) => h.split("?")[0]);
    for (const claimed of claimedHrefs()) {
      const ok = catalog.some((c) => c === claimed || (c !== "/admin" && c !== "/owner" && claimed.startsWith(c + "/")));
      check(ok, `a page claims activeHref="${claimed}" and the menu has an entry for it`);
    }
  }

  // ── 6. phone drawer opens (with and without JS) and has the links ────────
  for (const js of [true, false]) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, javaScriptEnabled: js });
    await ctx.addCookies(sessions.admin_finance.map((c) => ({ ...c, url: BASE })));
    const page = await ctx.newPage();
    await page.goto(BASE + "/admin", { waitUntil: "load" });
    if (js) await page.waitForTimeout(800);
    const link = page.locator('details.md\\:hidden aside nav a[href="/admin/expenses"]');
    check(!(await link.isVisible()), `phone ${js ? "JS" : "no JS"}: drawer starts closed`);
    await page.locator("details.md\\:hidden summary").first().click();
    await page.waitForTimeout(300);
    check(await link.isVisible(), `phone ${js ? "JS" : "no JS"}: tapping the bar opens the drawer`);
    const hidden = await page.locator('details.md\\:hidden aside nav a[href="/admin/cron"]').count();
    check(hidden === 0, `phone ${js ? "JS" : "no JS"}: admin_finance's drawer has no Daily Jobs link`);
    await ctx.close();
  }

  // ── 7. where you land after signing in ───────────────────────────────────
  for (const who of Object.keys(PEOPLE)) {
    const staffLogin = PEOPLE[who].roles.length > 0;
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    await page.goto(BASE + (staffLogin ? "/admin-login" : "/auth/login"), { waitUntil: "networkidle" });
    const form = page.locator("form").filter({ has: page.locator('input[name="password"]') }).first();
    await form.locator('input[name="email"]').fill(users[who].email);
    await form.locator('input[name="password"]').fill(PASSWORD);
    await form.locator('button[type="submit"]').click();
    await page.waitForURL((u) => u.pathname === LANDING[who], { timeout: 15000 }).catch(() => {});
    check(new URL(page.url()).pathname === LANDING[who], `${who}: lands on ${LANDING[who]} after signing in (at ${new URL(page.url()).pathname})`);
    await ctx.close();
  }
  {
    // An explicit destination still wins over the default.
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(BASE + "/auth/login?next=/listings", { waitUntil: "networkidle" });
    const form = page.locator("form").filter({ has: page.locator('input[name="password"]') }).first();
    await form.locator('input[name="email"]').fill(users.owner.email);
    await form.locator('input[name="password"]').fill(PASSWORD);
    await form.locator('button[type="submit"]').click();
    await page.waitForURL((u) => u.pathname === "/listings", { timeout: 15000 }).catch(() => {});
    check(new URL(page.url()).pathname === "/listings", "an explicit ?next= beats the default landing");
    await ctx.close();
  }

  // ── 8. the tenant dashboard keeps its own sidebar ────────────────────────
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    await ctx.addCookies(sessions.guest.map((c) => ({ ...c, url: BASE })));
    const page = await ctx.newPage();
    await page.goto(BASE + "/dashboard", { waitUntil: "load" });
    check((await page.locator("aside[data-app-sidebar]").count()) === 0, "/dashboard does not use the shared sidebar");
    check((await page.locator("aside").count()) >= 1, "/dashboard still has its own sidebar");
    await ctx.close();
  }

  check(errors5xx.length === 0, `no 5xx while walking the nav (${errors5xx.slice(0, 3).join(" | ") || "none"})`);
  await browser.close();

  // ── cleanup ───────────────────────────────────────────────────────────────
  for (const id of made.properties ?? []) await svc.from("properties").delete().eq("id", id);
  for (const id of made.sites) await svc.from("sites").delete().eq("id", id);
  for (const id of made.owners) await svc.from("owners").delete().eq("id", id);
  for (const u of Object.values(users)) {
    await db.query("delete from staff_roles where user_id=$1", [u.id]).catch(() => {});
    await svc.auth.admin.deleteUser(u.id).catch(() => {});
  }
  await db.end();

  console.log(`\n${pass.length} passed, ${fail.length} failed`);
  if (fail.length) { for (const f of fail) console.log("  ✗ " + f); process.exit(1); }
})().catch((e) => { console.error(e); process.exit(2); });
