#!/usr/bin/env node
/**
 * The admin and owner sidebars must open on a phone — before JavaScript.
 *
 * Both were a fixed top bar with a `menu` button wired to onClick and
 * useState. That works, once React has hydrated. Before that the menu is
 * the one thing on screen that does nothing, on the one screen where it is
 * the only way to reach any other page. Measured at 390px before the fix:
 *
 *   with JavaScript     aside slid from x=-256 to x=0
 *   JavaScript disabled aside stayed at x=-256
 *
 * A phone on a slow connection sees the second case for real, taps again,
 * and concludes the panel does not collapse — which is exactly how it was
 * reported.
 *
 * Disabling JavaScript reproduces the pre-hydration window deterministically,
 * which a timing-based test never could: hydration is usually fast enough to
 * hide the bug, and a test that only sometimes fails is a test people learn
 * to rerun.
 *
 *   npm run build && npm run start
 *   node scripts/test-admin-drawer.js
 */
const { chromium } = require("playwright");

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const EMAIL = process.env.ADMIN_EMAIL ?? "admin@verihome.id";
const PASSWORD = process.env.ADMIN_PASSWORD ?? "LocalAdmin!123";

const PHONE = { width: 390, height: 844 };

const pass = [];
const fail = [];
const check = (ok, what) => (ok ? pass : fail).push(what);

/** Signs in with JavaScript on, and hands back the cookies. */
async function signIn(browser) {
  const ctx = await browser.newContext({ viewport: PHONE });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/auth/login`, { waitUntil: "networkidle" });
  // Scoped to the form holding the password: since the EN/ID switch became a
  // form, every page carries two submit buttons ahead of this one.
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
  check(
    cookies.some((c) => c.name.startsWith("sb-")),
    `masuk sebagai ${EMAIL} (${cookies.length} cookie)`,
  );
  return cookies;
}

(async () => {
  const browser = await chromium.launch();
  const cookies = await signIn(browser);

  for (const js of [true, false]) {
    const label = js ? "dengan JS" : "tanpa JS";

    for (const path of ["/admin", "/owner"]) {
      const ctx = await browser.newContext({ viewport: PHONE, javaScriptEnabled: js });
      await ctx.addCookies(cookies);
      const page = await ctx.newPage();

      const res = await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" });
      const landed = new URL(page.url()).pathname;

      // /owner is only reachable by an account linked to an owner record. An
      // admin is not one, so a redirect there is correct, not a failure —
      // skip rather than assert something false.
      if (landed !== path) {
        check(true, `${label} ${path}: dialihkan ke ${landed}, dilewati`);
        await ctx.close();
        continue;
      }
      check(res?.status() === 200, `${label} ${path} → ${res?.status()}`);

      // The drawer is the aside inside <details>; the desktop one is a
      // sibling hidden by the media query.
      const drawer = page.locator("details aside").first();
      check(await drawer.count() === 1, `${label} ${path}: laci ada di dalam <details>`);

      // isVisible, not boundingBox: current Chrome hides a closed <details>
      // with content-visibility rather than display:none, so the contents
      // keep a layout box at x=0 while being unpainted. Measuring geometry
      // here reports an open drawer that is not open.
      check(
        !(await drawer.isVisible()),
        `${label} ${path}: laci tertutup saat halaman dibuka`,
      );

      const toggle = page.locator("details > summary").first();
      check(await toggle.isVisible(), `${label} ${path}: tombol menu terlihat`);

      await toggle.click();
      await page.waitForTimeout(500);
      const after = await drawer.boundingBox();
      check(
        (await drawer.isVisible()) && after !== null && Math.round(after.x) === 0,
        `${label} ${path}: menekan menu membuka laci (x=${after && Math.round(after.x)})`,
      );

      // The link that proves the drawer is usable, not just visible.
      const firstLink = drawer.locator("a").first();
      check(await firstLink.isVisible(), `${label} ${path}: tautan di laci bisa dilihat`);

      // And the same control closes it again. Without JavaScript the backdrop
      // tap is gone, so if the bar were covered by the drawer there would be
      // no way back out — which is why the drawer starts below it.
      await toggle.click();
      await page.waitForTimeout(500);
      check(
        !(await drawer.isVisible()),
        `${label} ${path}: menekan menu lagi menutup laci`,
      );

      await ctx.close();
    }
  }

  // ── desktop is untouched ─────────────────────────────────────────────────
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await ctx.addCookies(cookies);
    const page = await ctx.newPage();
    await page.goto(`${BASE}/admin`, { waitUntil: "domcontentloaded" });

    const desktop = page.locator("aside").filter({ hasNot: page.locator("summary") });
    const visible = page.locator("aside:visible");
    check(await visible.count() === 1, `desktop: tepat satu sidebar terlihat (${await visible.count()})`);
    const box = await visible.first().boundingBox();
    check(
      box !== null && Math.round(box.x) === 0 && box.width === 256,
      `desktop: sidebar di tempatnya (x=${box && Math.round(box.x)}, lebar=${box && box.width})`,
    );
    check(await desktop.count() >= 1, "desktop: sidebar statis masih dirender");
    await ctx.close();
  }

  await browser.close();

  console.log(`\nPASS ${pass.length}`);
  for (const p of pass) console.log(`  ok   ${p}`);
  if (fail.length) {
    console.log(`\nFAIL ${fail.length}`);
    for (const f of fail) console.log(`  FAIL ${f}`);
  }
  process.exit(fail.length ? 1 : 0);
})().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(2);
});
