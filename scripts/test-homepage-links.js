#!/usr/bin/env node
/**
 * Every link on the public pages must land somewhere.
 *
 * The copy this homepage was written from pointed at /listing — singular,
 * and a route that has never existed. The old footer pointed at /about,
 * /terms, /privacy and /cookies, none of which existed either: four 404s
 * sitting at the bottom of every page, for months, because nobody clicks
 * their own footer.
 *
 * So this walks every internal link the public pages render and asks for it.
 * A marketing page whose buttons 404 is worse than no marketing page: the
 * visitor concludes the product is broken, and they are not wrong to.
 *
 *   npm run build && npm run start
 *   node scripts/test-homepage-links.js
 */
const { chromium } = require("playwright");

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const PAGES = ["/", "/contact", "/listings", "/terms", "/privacy"];

const pass = [];
const fail = [];
const check = (ok, what) => (ok ? pass : fail).push(what);

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const serverErrors = [];
  page.on("response", (r) => { if (r.status() >= 500) serverErrors.push(`${r.status()} ${r.url()}`); });

  const seen = new Set();

  for (const path of PAGES) {
    const res = await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" });
    check(res?.status() === 200, `${path} → ${res?.status()}`);

    const hrefs = await page.locator("a[href]").evaluateAll((as) =>
      as.map((a) => a.getAttribute("href")).filter(Boolean),
    );
    for (const h of hrefs) {
      // Internal paths only. An anchor is checked as a target id below, and
      // external links are not this test's business.
      if (!h.startsWith("/") || h.startsWith("//")) continue;
      seen.add(h.split("#")[0] || "/");
    }
  }

  check(seen.size > 5, `mengumpulkan ${seen.size} tautan internal yang berbeda`);

  for (const href of [...seen].sort()) {
    const res = await page.goto(`${BASE}${href}`, { waitUntil: "domcontentloaded" });
    const landed = new URL(page.url()).pathname;
    const ok = res?.status() === 200 || (res?.status() === 307 && landed === "/admin-login");
    check(ok, `${href} → ${res?.status()}${landed !== href ? ` (${landed})` : ""}`);
  }

  // ── anchors in the nav must point at ids that exist ───────────────────────
  //
  // The previous menu linked #how-it-works and #neighborhoods; neither id was
  // on the page, so both scrolled nowhere and looked like a dead button.
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  const anchors = await page.locator('a[href^="/#"], a[href^="#"]').evaluateAll((as) =>
    [...new Set(as.map((a) => a.getAttribute("href").split("#")[1]).filter(Boolean))],
  );
  check(anchors.length > 0, `menemukan ${anchors.length} anchor di halaman depan`);
  for (const id of anchors) {
    // Attribute selector, not `#id`: an id with a hyphen or digit start
    // needs escaping in CSS, and CSS.escape lives in the browser, not here.
    const exists = await page.locator(`[id="${id}"]`).count().catch(() => 0);
    check(exists > 0, `anchor #${id} punya target di halaman`);
  }

  // The two busiest buttons, by name, go where the brief says.
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  const kontak = await page.locator('a:has-text("Kontak Kami")').first().getAttribute("href");
  const listing = await page.locator('a:has-text("Lihat Listing Tersedia")').first().getAttribute("href");
  check(kontak === "/contact", `"Kontak Kami" → ${kontak}`);
  check(listing === "/listings", `"Lihat Listing Tersedia" → ${listing} (bukan /listing)`);

  check(serverErrors.length === 0, `tidak ada 5xx (${serverErrors.slice(0, 3).join(" | ") || "none"})`);

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
