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
