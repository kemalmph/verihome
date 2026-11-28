#!/usr/bin/env node
/**
 * The desktop sidebar of /admin, /site and the customer /account (formerly /dashboard) folds to an
 * icon rail, and stays folded.
 *
 * What has to hold, each checked rather than assumed:
 *
 *   - Folding narrows the aside AND the page margin. They are set in
 *     different files (the sidebar, and 30-odd page files), so one moving
 *     without the other is the likely way for this to break: content
 *     sliding under the rail, or a 184px gap beside it.
 *   - It works before hydration. The control is a form, like the language
 *     switch; with JavaScript off it posts and the page comes back folded.
 *   - It survives a reload and a move to another page, because the server
 *     renders the width from the cookie — no wide-then-snap on load.
 *   - Folded links keep their accessible names (sr-only, not display:none).
 *   - The phone drawer never folds, whatever the cookie says.
 *
 * The shared sidebar serves five kinds of viewer (superadmin, admin_finance,
 * surveyor, property owner, and the tenant dashboard's own sidebar), so each
 * is folded, reloaded and unfolded in turn. Fixture users are made with the
 * service role and removed afterwards (SUPABASE_ANON_KEY,
 * SUPABASE_SERVICE_ROLE_KEY, DATABASE_URL; local only).
 *
 *   npm run build && npm run start
 *   node scripts/test-sidebar-collapse.js
 */
const { chromium } = require("playwright");
const { createClient } = require("@supabase/supabase-js");
const { createServerClient } = require("@supabase/ssr");
const { Client } = require("pg");

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const EMAIL = process.env.ADMIN_EMAIL ?? "admin@verihome.id";
const PASSWORD = process.env.ADMIN_PASSWORD ?? "LocalAdmin!123";

const DESKTOP = { width: 1280, height: 800 };
const PHONE = { width: 390, height: 844 };
const RAIL = 72;

const pass = [];
const fail = [];
const check = (ok, what) => (ok ? pass : fail).push(what);

async function signIn(browser) {
  const ctx = await browser.newContext({ viewport: DESKTOP });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/auth/login`, { waitUntil: "networkidle" });
  const form = page
    .locator("form")
    .filter({ has: page.locator('input[name="password"]') })
    .first();
  await form.locator('input[name="email"]').fill(EMAIL);
  await form.locator('input[name="password"]').fill(PASSWORD);
  await form.locator('button[type="submit"]').click();
  await page.waitForTimeout(4000);
  const cookies = await ctx.cookies();
  await ctx.close();
  check(cookies.some((c) => c.name.startsWith("sb-")), `masuk sebagai ${EMAIL}`);
  return cookies;
}

/** Width of the visible aside and the left margin of <main>, after transitions. */
async function measure(page) {
  await page.waitForTimeout(400);
  return page.evaluate(() => {
    const aside = [...document.querySelectorAll("aside")].find(
      (a) => a.getBoundingClientRect().width > 0 && getComputedStyle(a).display !== "none",
    );
    // /survey centres its <main> inside the offset wrapper, so the wrapper is the margin.
    const main = document.querySelector("[data-sidebar-offset]") ?? document.querySelector("main");
    return {
      aside: aside ? Math.round(aside.getBoundingClientRect().width) : null,
      main: main ? Math.round(main.getBoundingClientRect().left) : null,
      attr: document.documentElement.dataset.sidebar ?? null,
    };
  });
}

const sidebarCookie = async (ctx) =>
  (await ctx.cookies()).find((c) => c.name === "cosystem_sidebar")?.value ?? null;

async function run(browser, cookies, js, { start, other, wide, href, who, names = { collapse: "Collapse sidebar", expand: "Expand sidebar" } }) {
  const tag = `${who} ${js ? "JS" : "tanpa JS"} ${start}`;
  const WIDE = wide;
  const ctx = await browser.newContext({ viewport: DESKTOP, javaScriptEnabled: js });
  await ctx.addCookies(cookies);
  const page = await ctx.newPage();

  // "load", not "networkidle": /account pulls placeholder images from an
  // outside host, which never settles where that host is unreachable.
  await page.goto(`${BASE}${start}`, { waitUntil: "load" });
  if (js) await page.waitForTimeout(1500); // let React hydrate
  let m = await measure(page);
  check(m.aside === WIDE && m.main === WIDE, `${tag}: awalnya lebar (aside=${m.aside}, main=${m.main})`);

  const collapse = page.getByRole("button", { name: names.collapse });
  const expand = page.getByRole("button", { name: names.expand });
  check(await collapse.isVisible(), `${tag}: tombol ciutkan terlihat`);
  check(!(await expand.isVisible()), `${tag}: tombol lebarkan tersembunyi saat lebar`);

  await collapse.click();
  if (!js) await page.waitForLoadState("load");
  m = await measure(page);
  check(m.aside === RAIL && m.main === RAIL, `${tag}: setelah diciutkan (aside=${m.aside}, main=${m.main})`);
  check((await sidebarCookie(ctx)) === "collapsed", `${tag}: cookie tersimpan`);

  const link = page.locator(`aside:visible a[href="${href}"]`).first();
  const label = link.locator("span").last();
  // sr-only leaves a 1x1px box, which isVisible counts as visible — and
  // should, since a screen reader still reads it. Width is the real test.
  const lw = Math.round((await label.boundingBox())?.width ?? 0);
  check(lw <= 1, `${tag}: label tautan tidak tampak di rail (lebar ${lw}px)`);
  check(
    ((await label.textContent()) ?? "").trim().length > 0,
    `${tag}: tautan masih punya nama aksesibel`,
  );
  check(await expand.isVisible(), `${tag}: tombol lebarkan terlihat di rail`);

  await page.goto(`${BASE}${other}`, { waitUntil: "load" });
  m = await measure(page);
  check(m.aside === RAIL && m.main === RAIL, `${tag}: tetap ciut di halaman lain (${other}: ${m.aside}/${m.main})`);

  await page.reload({ waitUntil: "load" });
  m = await measure(page);
  check(m.attr === "collapsed" && m.aside === RAIL, `${tag}: tetap ciut setelah reload, dari HTML server`);

  await expand.click();
  if (!js) await page.waitForLoadState("load");
  m = await measure(page);
  check(m.aside === WIDE && m.main === WIDE, `${tag}: dilebarkan lagi (aside=${m.aside}, main=${m.main})`);
  check((await sidebarCookie(ctx)) === null, `${tag}: cookie dihapus`);

  await ctx.close();
}

async function phone(browser, cookies, path, href) {
  const ctx = await browser.newContext({ viewport: PHONE });
  await ctx.addCookies([
    ...cookies,
    { name: "cosystem_sidebar", value: "collapsed", url: BASE },
  ]);
  const page = await ctx.newPage();
  await page.goto(`${BASE}${path}`, { waitUntil: "load" });
  await page.waitForTimeout(1500);
  await page.locator("summary").first().click();
  await page.waitForTimeout(300);
  const label = page.locator(`aside:visible a[href="${href}"] span`).last();
  check(await label.isVisible(), `ponsel ${path}: laci tetap berlabel walau cookie ciut`);
  const m = await page.evaluate(() => Math.round((document.querySelector("[data-sidebar-offset]") ?? document.querySelector("main")).getBoundingClientRect().left));
  check(m === 0, `ponsel ${path}: konten tidak bergeser (main x=${m})`);
  await ctx.close();
}

const PERSONA_PASSWORD = "CollapseTest!12345";
const RUN = Date.now().toString(36);

(async () => {
  const SUPA = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
  const ANON = process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const DB = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
  if (!/127\.0\.0\.1|localhost/.test(SUPA)) { console.error("Refusing: SUPABASE_URL is not local."); process.exit(1); }
  if (!ANON || !SERVICE) { console.error("Set SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY."); process.exit(1); }
  const svc = createClient(SUPA, SERVICE, { auth: { persistSession: false } });
  const db = new Client({ connectionString: DB });
  await db.connect();

  const made = { users: [], owners: [] };
  async function persona(key, { roles = [], owner = false }) {
    const email = `collapse-${key}-${RUN}@test.invalid`;
    const { data, error } = await svc.auth.admin.createUser({ email, password: PERSONA_PASSWORD, email_confirm: true, user_metadata: { full_name: key } });
    if (error) throw new Error(`createUser ${key}: ${error.message}`);
    await svc.from("users").upsert({ id: data.user.id, name: key, email }, { onConflict: "id" });
    made.users.push(data.user.id);
    for (const r of roles) await db.query("insert into staff_roles(user_id, role) values ($1,$2)", [data.user.id, r]);
    if (owner) {
      const { data: o, error: oe } = await svc.from("owners").insert({
        name: `Collapse ${key}`, email: `o-${key}-${RUN}@test.invalid`, phone_whatsapp: "628000000000",
        user_id: data.user.id, portal_access: "active",
      }).select("id").single();
      if (oe) throw new Error(`owner ${key}: ${oe.message}`);
      made.owners.push(o.id);
      // Phase 3: the property portal is in the menu only for an owner with a property.
      const { rows: [p] } = await db.query("insert into properties(name, slug, owner_id) values ($1,$2,$3) returning id",
        [`Collapse ${key}`, `collapse-${key}-${RUN}`, o.id]);
      (made.properties ??= []).push(p.id);
    }
    const jar = new Map();
    const sb = createServerClient(SUPA, ANON, {
      cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: (c) => c.forEach(({ name, value }) => jar.set(name, value)) },
    });
    const { error: se } = await sb.auth.signInWithPassword({ email, password: PERSONA_PASSWORD });
    if (se) throw new Error(`sign-in ${key}: ${se.message}`);
    return [...jar].map(([name, value]) => ({ name, value, url: BASE }));
  }

  const browser = await chromium.launch();
  try {
    const cookies = await signIn(browser);
    const finance = await persona("finance", { roles: ["admin_finance"] });
    const surveyor = await persona("surveyor", { roles: ["surveyor"] });
    const owner = await persona("owner", { owner: true });
    const ownerStaff = await persona("ownerstaff", { roles: ["admin_finance"], owner: true });

    const areas = [
      { who: "superadmin", cookies, start: "/admin", other: "/site", wide: 256, href: "/admin/bookings" },
      { who: "admin_finance", cookies: finance, start: "/admin", other: "/admin/expenses", wide: 256, href: "/admin/expenses" },
      { who: "surveyor", cookies: surveyor, start: "/survey", other: "/survey", wide: 256, href: "/survey" },
      // An owner who is not staff gets the language switch; the default is Indonesian.
      { who: "pemilik", cookies: owner, start: "/owner", other: "/owner/properties", wide: 256, href: "/owner/properties", names: { collapse: "Ciutkan sidebar", expand: "Lebarkan sidebar" } },
      { who: "pemilik+staf", cookies: ownerStaff, start: "/owner", other: "/admin/expenses", wide: 256, href: "/owner/earnings" },
      { who: "account", cookies, start: "/account", other: "/account/bookings", wide: 288, href: "/account/bookings" },
    ];
    for (const a of areas) {
      await run(browser, a.cookies, true, a);
      await run(browser, a.cookies, false, a);
      await phone(browser, a.cookies, a.start, a.href);
    }
  } finally {
    await browser.close();
    for (const id of made.properties ?? []) await svc.from("properties").delete().eq("id", id);
    for (const id of made.owners) await svc.from("owners").delete().eq("id", id);
    for (const id of made.users) {
      await db.query("delete from staff_roles where user_id=$1", [id]).catch(() => {});
      await svc.auth.admin.deleteUser(id).catch(() => {});
    }
    await db.end();
  }
  for (const p of pass) console.log(`  ok   ${p}`);
  for (const f of fail) console.log(`  FAIL ${f}`);
  console.log(`\n${pass.length} ok, ${fail.length} gagal`);
  process.exit(fail.length ? 1 : 0);
})();
