#!/usr/bin/env node
/**
 * The desktop sidebar of /admin, /site and the tenant /dashboard folds to an
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
 *   npm run build && npm run start
 *   node scripts/test-sidebar-collapse.js
 */
const { chromium } = require("playwright");

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
    const main = document.querySelector("main");
    return {
      aside: aside ? Math.round(aside.getBoundingClientRect().width) : null,
      main: main ? Math.round(main.getBoundingClientRect().left) : null,
      attr: document.documentElement.dataset.sidebar ?? null,
    };
  });
}

const sidebarCookie = async (ctx) =>
  (await ctx.cookies()).find((c) => c.name === "cosystem_sidebar")?.value ?? null;

async function run(browser, cookies, js, { start, other, wide }) {
  const tag = `${js ? "JS" : "tanpa JS"} ${start}`;
  const WIDE = wide;
  const ctx = await browser.newContext({ viewport: DESKTOP, javaScriptEnabled: js });
  await ctx.addCookies(cookies);
  const page = await ctx.newPage();

  // "load", not "networkidle": /dashboard pulls placeholder images from an
  // outside host, which never settles where that host is unreachable.
  await page.goto(`${BASE}${start}`, { waitUntil: "load" });
  if (js) await page.waitForTimeout(1500); // let React hydrate
  let m = await measure(page);
  check(m.aside === WIDE && m.main === WIDE, `${tag}: awalnya lebar (aside=${m.aside}, main=${m.main})`);

  const collapse = page.getByRole("button", { name: "Collapse sidebar" });
  const expand = page.getByRole("button", { name: "Expand sidebar" });
  check(await collapse.isVisible(), `${tag}: tombol ciutkan terlihat`);
  check(!(await expand.isVisible()), `${tag}: tombol lebarkan tersembunyi saat lebar`);

  await collapse.click();
  if (!js) await page.waitForLoadState("load");
  m = await measure(page);
  check(m.aside === RAIL && m.main === RAIL, `${tag}: setelah diciutkan (aside=${m.aside}, main=${m.main})`);
  check((await sidebarCookie(ctx)) === "collapsed", `${tag}: cookie tersimpan`);

  const label = page.locator("aside:visible").getByText("Bookings", { exact: true });
  // sr-only leaves a 1x1px box, which isVisible counts as visible — and
  // should, since a screen reader still reads it. Width is the real test.
  const lw = Math.round((await label.boundingBox())?.width ?? 0);
  check(lw <= 1, `${tag}: label tautan tidak tampak di rail (lebar ${lw}px)`);
  check(
    (await page.getByRole("link", { name: "Bookings" }).count()) >= 1,
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

async function phone(browser, cookies, path) {
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
  const label = page.locator("aside:visible").getByText("Bookings", { exact: true });
  check(await label.isVisible(), `ponsel ${path}: laci tetap berlabel walau cookie ciut`);
  const m = await page.evaluate(() => Math.round(document.querySelector("main").getBoundingClientRect().left));
  check(m === 0, `ponsel ${path}: konten tidak bergeser (main x=${m})`);
  await ctx.close();
}

(async () => {
  const browser = await chromium.launch();
  try {
    const cookies = await signIn(browser);
    const areas = [
      { start: "/admin", other: "/site", wide: 256 },
      { start: "/dashboard", other: "/dashboard/bookings", wide: 288 },
    ];
    for (const a of areas) {
      await run(browser, cookies, true, a);
      await run(browser, cookies, false, a);
      await phone(browser, cookies, a.start);
    }
  } finally {
    await browser.close();
  }
  for (const p of pass) console.log(`  ok   ${p}`);
  for (const f of fail) console.log(`  FAIL ${f}`);
  console.log(`\n${pass.length} ok, ${fail.length} gagal`);
  process.exit(fail.length ? 1 : 0);
})();
