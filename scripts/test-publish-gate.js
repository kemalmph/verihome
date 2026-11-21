#!/usr/bin/env node
/**
 * The publish gate, proved in a browser.
 *
 * `updatePropertyStatus` has always refused to set a property live until its
 * publish_checklist was complete. `updatePropertyDetails` also writes
 * `status`, and the listing edit form has a <select name="status"> with `live`
 * in it — so there were two separately addressable roads to `live` and the
 * guard sat on only one of them (§19.6).
 *
 * That was found by reading the code. This proves it from the outside, which
 * is a different claim: it drives the real form, posts the real action, and
 * reads the database back. An unmet checklist must not go live, and a met one
 * must.
 *
 * Needs the local stack, a built app and an admin account — same preconditions
 * as test-coworking-admin.js.
 */
const { chromium } = require("playwright");
const { Client } = require("pg");

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const EMAIL = process.env.ADMIN_EMAIL ?? "admin@verihome.id";
const PASSWORD = process.env.ADMIN_PASSWORD ?? "LocalAdmin!123";

const pass = [];
const fail = [];
const check = (ok, what) => (ok ? pass : fail).push(what);

const CHECKLIST_COLUMNS = [
  "min_photos_uploaded", "video_walkthrough_done", "rla_completed",
  "pros_cons_written", "price_verified", "owner_contact_active",
  "area_overview_filled", "rental_mode_configured",
];

(async () => {
  const db = new Client({ host: "127.0.0.1", port: 54322, user: "postgres", password: "postgres", database: "postgres" });
  await db.connect();
  const q = async (sql, args = []) => (await db.query(sql, args)).rows;

  // ── a property with an incomplete checklist ───────────────────────────────
  const owner = (await q(
    `insert into owners (name, email, phone_whatsapp)
     values ('Gate Owner', 'gate-owner@example.invalid', '+620000000003') returning id`,
  ))[0];
  const prop = (await q(
    `insert into properties (name, slug, area, property_type, price_monthly, bedrooms, bathrooms, address, status, owner_id)
     values ('Gate Probe', 'gate-probe', 'Kemang', 'house', 8000000, 2, 1, 'Jl. Gate 1', 'new_lead', $1)
     returning id`,
    [owner.id],
  ))[0];

  // One item short of complete, so the refusal has to name exactly that item.
  const allButOne = CHECKLIST_COLUMNS.filter((c) => c !== "price_verified");
  await q(
    `insert into publish_checklist (property_id, ${allButOne.join(", ")})
     values ($1, ${allButOne.map(() => "true").join(", ")})
     on conflict (property_id) do update set ${allButOne.map((c) => `${c} = true`).join(", ")}`,
    [prop.id],
  );
  const before = await q("select price_verified from publish_checklist where property_id = $1", [prop.id]);
  check(before[0]?.price_verified === false, "fixture: exactly one checklist item is unmet (price_verified)");

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });

  await page.goto(`${BASE}/auth/login`, { waitUntil: "domcontentloaded" });
  await page.fill('input[name="email"]', EMAIL);
  await page.fill('input[name="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2500);

  // ── the second road to live: the edit form's status dropdown ──────────────
  await page.goto(`${BASE}/admin/listings/${prop.id}`, { waitUntil: "domcontentloaded" });
  const statusSelect = page.locator('select[name="status"]');
  check(await statusSelect.count() === 1, "edit form carries a status dropdown");
  const liveOffered = await statusSelect.locator('option[value="live"]').count();
  check(liveOffered === 1, "…and it offers `live`, which is why it needs the gate");

  await statusSelect.selectOption("live");
  await page.getByRole("button", { name: "Save Changes" }).click();
  await page.waitForTimeout(2500);

  const after = await q("select status from properties where id = $1", [prop.id]);
  check(
    after[0]?.status === "new_lead",
    `an unmet checklist is refused through the edit form (status is ${after[0]?.status})`,
  );

  // ── and the first road, which always had the guard ────────────────────────
  // Same property, same unmet item, via the listings table's own control.
  const stillUnmet = await q("select price_verified from publish_checklist where property_id = $1", [prop.id]);
  check(stillUnmet[0]?.price_verified === false, "the refused save did not quietly tick the checklist");

  // ── complete it, and the same form must now succeed ───────────────────────
  // A gate that refuses everything is not a gate, it is a wall.
  await q("update publish_checklist set price_verified = true where property_id = $1", [prop.id]);
  await page.goto(`${BASE}/admin/listings/${prop.id}`, { waitUntil: "domcontentloaded" });
  await page.locator('select[name="status"]').selectOption("live");
  await page.getByRole("button", { name: "Save Changes" }).click();
  await page.waitForTimeout(2500);

  const published = await q("select status from properties where id = $1", [prop.id]);
  check(
    published[0]?.status === "live",
    `a complete checklist goes live through the same form (status is ${published[0]?.status})`,
  );

  await browser.close();

  await q("delete from properties where id = $1", [prop.id]);
  await q("delete from owners where id = $1", [owner.id]);
  await db.end();

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
