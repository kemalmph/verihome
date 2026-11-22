#!/usr/bin/env node
/**
 * The admin sidebar, checked against the app it claims to navigate.
 *
 * Two failures this catches, and both had already happened:
 *
 *   A LINK THAT GOES NOWHERE. Easy to introduce by renaming a route and
 *   missing the nav, and invisible until someone clicks it.
 *
 *   A PAGE WITH NO LINK. Harder to notice, because nothing is broken —
 *   /admin/expenses, /admin/placements and both report pages existed, worked,
 *   and could only be reached by typing the URL. Found by comparing the nav
 *   against every activeHref the app passes in, which is what this does.
 *
 * The second check is the reason this file exists. A nav test that only
 * follows its own links can never find a page that is missing from it.
 */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const EMAIL = process.env.ADMIN_EMAIL ?? "admin@verihome.id";
const PASSWORD = process.env.ADMIN_PASSWORD ?? "LocalAdmin!123";

const pass = [];
const fail = [];
const check = (ok, what) => (ok ? pass : fail).push(what);

/** The hrefs the sidebar offers, read from its source. */
function navHrefs() {
  const src = fs.readFileSync(
    path.join(__dirname, "..", "src", "components", "layout", "AdminSidebar.tsx"),
    "utf8",
  );
  return [...src.matchAll(/href:\s*"([^"]+)"/g)].map((m) => m[1]);
}

/**
 * Every activeHref an admin page passes to the sidebar.
 *
 * This is the app's own statement of "I am this nav entry", so a value with
 * no matching link is a page nobody can reach from the menu.
 */
function claimedHrefs() {
  const out = execFileSync(
    "grep",
    ["-rhoE", 'activeHref="[^"]+"', path.join(__dirname, "..", "src", "app", "admin"),
     path.join(__dirname, "..", "src", "app", "site")],
    { encoding: "utf8" },
  );
  return [...new Set(out.split("\n").filter(Boolean).map((l) => l.replace(/activeHref="|"/g, "")))];
}

(async () => {
  const hrefs = navHrefs();
  const claimed = claimedHrefs();

  check(hrefs.length > 0, `the sidebar offers ${hrefs.length} links`);

  // ── no page without a door ────────────────────────────────────────────────
  //
  // A page is covered when the nav has a link that is a prefix of its
  // activeHref: /admin/surveys/pending covers /admin/surveys, and the nav's
  // /admin/surveys/pending covers the page that claims /admin/surveys.
  const orphans = claimed.filter(
    (c) => !hrefs.some((h) => h === c || c.startsWith(h) || h.startsWith(c)),
  );
  check(
    orphans.length === 0,
    `every admin page is reachable from the nav${orphans.length ? ` — orphaned: ${orphans.join(", ")}` : ""}`,
  );

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  const errors = [];
  page.on("response", (r) => { if (r.status() >= 500) errors.push(`${r.status()} ${r.url()}`); });

  await page.goto(`${BASE}/auth/login`, { waitUntil: "domcontentloaded" });
  await page.fill('input[name="email"]', EMAIL);
  await page.fill('input[name="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2500);

  // ── no door without a room ────────────────────────────────────────────────
  for (const href of hrefs) {
    const res = await page.goto(`${BASE}${href}`, { waitUntil: "domcontentloaded" });
    const landed = new URL(page.url()).pathname;
    check(
      res?.status() === 200 && landed !== "/admin-login",
      `${href} → ${res?.status()}${landed !== href ? ` (landed ${landed})` : ""}`,
    );
  }

  // ── the groups are visible, and each link sits under one ──────────────────
  await page.goto(`${BASE}/admin`, { waitUntil: "domcontentloaded" });
  // innerText returns what is rendered, and these headings carry
  // text-transform: uppercase — so the DOM says "General" and the screen says
  // "GENERAL". Comparing case-insensitively tests the words, which is what
  // the assertion is about; the casing is a style decision, not a fact.
  const navText = (await page.locator("aside nav").innerText()).toUpperCase();
  for (const heading of ["General", "Marketplace", "Site management", "Finance"]) {
    check(navText.includes(heading.toUpperCase()), `the nav shows the "${heading}" group`);
  }

  const headingCount = await page.locator("aside nav p").count();
  const linkCount = await page.locator("aside nav a").count();
  check(
    linkCount === hrefs.length,
    `every link in the source renders (${linkCount} of ${hrefs.length})`,
  );
  check(headingCount === 4, `four group headings render (${headingCount})`);

  // The active item must be highlighted, or grouping just moved the problem.
  await page.goto(`${BASE}/site`, { waitUntil: "domcontentloaded" });
  const activeText = await page.locator('aside nav a[class*="80d7b6"]').first().innerText();
  check(/Site/.test(activeText), `the current page is highlighted (${activeText.trim()})`);

  check(errors.length === 0, `no 5xx while walking the nav (${errors.slice(0, 3).join(" | ") || "none"})`);

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
