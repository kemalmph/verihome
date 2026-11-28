#!/usr/bin/env node
/**
 * A login form must not put the password in the URL.
 *
 * Found by accident on production: filling the form and clicking submit
 * before React had hydrated sent a plain HTML GET, and the address bar read
 *
 *   /auth/login?email=kemalmph%40yahoo.com&password=kemal284
 *
 * From there the password reaches browser history, the server's access logs,
 * and the Referer header of every later request from that page. The cause was
 * `<form onSubmit={...}>` with no `method`: the HTML default is GET, so until
 * JavaScript takes over, every named field goes into the query string. A
 * person on a slow phone who taps quickly hits exactly this.
 *
 * Disabling JavaScript reproduces the pre-hydration window deterministically,
 * which a timing-based test never could — hydration is usually fast enough to
 * hide the bug, and a test that only sometimes fails is a test people learn
 * to rerun.
 *
 *   npm run build && npm run start
 *   node scripts/test-login-no-js.js
 */
const { chromium } = require("playwright");

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3000";

const pass = [];
const fail = [];
const check = (ok, what) => (ok ? pass : fail).push(what);

const SECRET = "kata-sandi-rahasia-jangan-bocor";

(async () => {
  const browser = await chromium.launch();
  // No JavaScript: the form behaves exactly as it does before hydration.
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();

  for (const [label, path] of [
    ["halaman login umum", "/auth/login"],
    ["halaman login admin", "/admin-login"],
  ]) {
    await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" });

    const form = page.locator("form").filter({ has: page.locator('input[name="password"]') }).first();
    check(await form.count() > 0, `${label}: form password ada`);

    const method = (await form.getAttribute("method")) ?? "get";
    check(
      method.toLowerCase() === "post",
      `${label}: form method="${method}" (harus post)`,
    );

    await form.locator('input[name="email"]').fill("uji@example.invalid");
    await form.locator('input[name="password"]').fill(SECRET);
    await form.locator('button[type="submit"]').click().catch(() => {});
    await page.waitForTimeout(1500);

    const url = page.url();
    check(
      !url.includes(SECRET) && !url.includes(encodeURIComponent(SECRET)),
      `${label}: password TIDAK muncul di URL (${url.slice(0, 90)})`,
    );
    check(
      !url.includes("uji%40example.invalid") && !url.includes("uji@example.invalid"),
      `${label}: email juga tidak bocor ke URL`,
    );
  }

  // ── the way in, from the header, with no JavaScript ──────────────────────
  //
  // "Masuk" and "Daftar" used to be buttons opening a modal, and the modal
  // always opened in sign-in mode. Being onClick, neither did anything before
  // React hydrated. They became links to /auth/login.
  //
  // Since 28 Nov 2026 (owner's call) the header carries one account action:
  // "Masuk", a pill on the bar at every width. "Coba Gratis" left the bar for
  // the hero and the closing CTA. Sign-up is the second tab of /auth/login,
  // reached with ?mode=signup (and from the sign-in form).
  for (const width of [1280, 390]) {
    const ctx = await browser.newContext({ javaScriptEnabled: false, viewport: { width, height: 844 } });
    await ctx.addCookies([{ name: "cosystem_locale", value: "id", url: BASE }]);
    const page = await ctx.newPage();
    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });

    const signIn = page.locator('header a[href="/auth/login"]:visible');
    check(await signIn.count() === 1, `${width}px: "Masuk" terlihat di bilah, sekali`);
    check((await signIn.first().textContent())?.trim() === "Masuk", `${width}px: labelnya "Masuk"`);
    check(
      await page.locator('header a:has-text("Coba Gratis"):visible').count() === 0,
      `${width}px: "Coba Gratis" tidak lagi di bilah`,
    );
    check(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      `${width}px: halaman tidak meluber ke samping`,
    );

    // "Masuk" opens the sign-in form, still without JavaScript.
    await signIn.first().click();
    await page.waitForLoadState("domcontentloaded");
    check(new URL(page.url()).pathname === "/auth/login", `${width}px: "Masuk" membuka /auth/login`);
    check(
      await page.locator('input[name="password"]').first().isVisible(),
      `${width}px: form masuk terbuka tanpa JavaScript`,
    );

    // The sign-up tab is still the one ?mode=signup opens.
    await page.goto(`${BASE}/auth/login?mode=signup`, { waitUntil: "domcontentloaded" });
    check(
      await page.locator('input[name="name"]').isVisible(),
      `${width}px: /auth/login?mode=signup membuka form pendaftaran, bukan form masuk`,
    );

    await ctx.close();
  }

  await context.close();
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
