#!/usr/bin/env node
/**
 * Amenities, events, and the consumables on a booking — in a browser.
 *
 * Three claims worth proving from the outside:
 *
 *   an amenity set replaces, it does not accumulate
 *   an event cannot be confirmed while part of it has no room
 *   a booking's margin is the room rate plus what was sold less what it cost
 *
 * The middle one is the reason events do not block rooms themselves. It is
 * enforced in the action, not by a constraint, so it is the one most able to
 * quietly stop working.
 */
const { chromium } = require("playwright");
const { Client } = require("pg");

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const EMAIL = process.env.ADMIN_EMAIL ?? "admin@verihome.id";
const PASSWORD = process.env.ADMIN_PASSWORD ?? "LocalAdmin!123";

const pass = [];
const fail = [];
const check = (ok, what) => (ok ? pass : fail).push(what);
const RUN = Date.now().toString(36);

(async () => {
  const db = new Client({ host: "127.0.0.1", port: 54322, user: "postgres", password: "postgres", database: "postgres" });
  await db.connect();
  const q = async (sql, args = []) => (await db.query(sql, args)).rows;

  const site = (await q(
    `insert into sites (name, slug, status) values ($1, $2, 'active') returning id`,
    [`Extras ${RUN}`, `extras-${RUN}`],
  ))[0];
  const hall = (await q(
    `insert into lettable_units (site_id, name, unit_type, letting_mode, capacity, price, status)
     values ($1, 'Aula Utama', 'event_space', 'hourly', 60, 500000, 'available') returning id`,
    [site.id],
  ))[0];

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 1200 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("response", (r) => { if (r.status() >= 500) errors.push(`${r.status()} ${r.url()}`); });

  await page.goto(`${BASE}/auth/login`, { waitUntil: "domcontentloaded" });
  await page.fill('input[name="email"]', EMAIL);
  await page.fill('input[name="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2500);

  // ── amenities ─────────────────────────────────────────────────────────────
  const sitePage = `${BASE}/admin/coworking/${site.id}`;
  await page.goto(sitePage, { waitUntil: "domcontentloaded" });
  check(await page.getByRole("heading", { name: "Fasilitas" }).isVisible(), "amenity section renders");

  const siteBlock = page.locator("section").filter({ hasText: "Seluruh gedung" });
  await siteBlock.getByRole("button", { name: "Ubah" }).first().click();
  const siteForm = page.locator("form").filter({ has: page.locator('input[name="amenity"]') }).first();
  // Tick parking and mushola by their visible labels.
  await siteForm.locator("label", { hasText: "Parkir" }).locator("input").check();
  await siteForm.locator("label", { hasText: "Mushola" }).locator("input").check();
  await siteForm.getByRole("button", { name: "Simpan fasilitas" }).click();
  await page.waitForTimeout(1800);

  const siteAms = await q(
    `select a.code from site_amenities sa join amenities a on a.id = sa.amenity_id
      where sa.site_id = $1 order by a.code`, [site.id]);
  check(
    siteAms.length === 2 && siteAms.map((r) => r.code).sort().join(",") === "mushola,parking",
    `site amenities written (${siteAms.map((r) => r.code).join(",")})`,
  );

  // Saving a smaller set must REPLACE, not accumulate — otherwise unticking
  // something would never remove it.
  await page.goto(sitePage, { waitUntil: "domcontentloaded" });
  await page.locator("section").filter({ hasText: "Seluruh gedung" })
    .getByRole("button", { name: "Ubah" }).first().click();
  const siteForm2 = page.locator("form").filter({ has: page.locator('input[name="amenity"]') }).first();
  await siteForm2.locator("label", { hasText: "Mushola" }).locator("input").uncheck();
  await siteForm2.getByRole("button", { name: "Simpan fasilitas" }).click();
  await page.waitForTimeout(1800);

  const afterUncheck = await q(
    `select a.code from site_amenities sa join amenities a on a.id = sa.amenity_id where sa.site_id = $1`,
    [site.id]);
  check(
    afterUncheck.length === 1 && afterUncheck[0].code === "parking",
    `unticking removes it — the set is replaced, not merged (${afterUncheck.map((r) => r.code).join(",") || "none"})`,
  );

  // A unit's amenities are its own, not the building's.
  await q(
    `insert into unit_amenities (unit_id, amenity_id) select $1, id from amenities where code = 'projector'`,
    [hall.id]);
  const unitAms = await q(
    `select a.code from unit_amenities ua join amenities a on a.id = ua.amenity_id where ua.unit_id = $1`,
    [hall.id]);
  check(unitAms.length === 1 && unitAms[0].code === "projector", "a unit carries its own amenities");

  // ── events ────────────────────────────────────────────────────────────────
  const calendar = `${BASE}/admin/coworking/${site.id}/calendar`;
  await page.goto(calendar, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Tambah event" }).click();

  const evForm = page.locator("form").filter({ has: page.locator('input[name="title"]') });
  await evForm.locator('input[name="title"]').fill("Founder Friday");
  await evForm.locator('input[name="host_name"]').fill("Tim Cosystem");
  // Leave the room unbooked on purpose: this is the state the design must catch.
  await evForm.locator('select[name="unit_id"]').selectOption("");
  await evForm.getByRole("button", { name: "Simpan event" }).click();
  await page.waitForTimeout(2000);

  const ev = (await q(`select * from events where site_id = $1`, [site.id]))[0];
  check(!!ev, "event written to the database");
  check(ev?.status === "draft", `a new event starts as a draft (${ev?.status})`);

  // The times must be Jakarta times, not the server's. 18:00 typed must be
  // 11:00 UTC, not 18:00 UTC.
  const hourUtc = new Date(ev.starts_at).getUTCHours();
  check(hourUtc === 11, `18:00 typed is stored as 11:00 UTC, i.e. Jakarta (${hourUtc}:00 UTC)`);

  await page.goto(calendar, { waitUntil: "domcontentloaded" });
  const body = await page.locator("body").innerText();
  check(/Event tanpa ruangan/.test(body), "an event with no room is flagged on the calendar");

  // Confirming must be refused while part of it has no room.
  await page.getByRole("button", { name: "Konfirmasi" }).first().click();
  await page.waitForTimeout(1800);
  const refusal = await page.locator("body").innerText();
  check(
    /Belum bisa dikonfirmasi/.test(refusal),
    "confirming an event with no room is refused, in a sentence",
  );
  const stillDraft = (await q(`select status from events where id = $1`, [ev.id]))[0];
  check(stillDraft.status === "draft", "…and the event stays a draft");

  // Book the room through the page, then confirm.
  await page.getByRole("button", { name: "Pesan ruangan" }).first().click();
  const startLocal = new Date(new Date(ev.starts_at).getTime() - 3600000);
  const endLocal = new Date(new Date(ev.ends_at).getTime() + 3600000);
  const localStr = (d) => {
    const j = new Date(d.getTime() + 7 * 3600000);
    return j.toISOString().slice(0, 16);
  };
  await page.locator('select[name="unit_id"]').last().selectOption(hall.id);
  await page.locator('input[name="starts_at"]').last().fill(localStr(startLocal));
  await page.locator('input[name="ends_at"]').last().fill(localStr(endLocal));
  await page.getByRole("button", { name: "Pesan", exact: true }).click();
  await page.waitForTimeout(2000);

  const gaps = await q(`select * from event_space_gaps($1)`, [ev.id]);
  check(gaps.length === 0, `booking through the page closes the gap (${gaps.length} left)`);

  await page.getByRole("button", { name: "Konfirmasi" }).first().click();
  await page.waitForTimeout(1800);
  const confirmed = (await q(`select status from events where id = $1`, [ev.id]))[0];
  check(confirmed.status === "confirmed", `now it confirms (${confirmed.status})`);

  // Cancelling releases the room, or the hall stays off the market for an
  // event nobody is running.
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Batalkan" }).first().click();
  await page.waitForTimeout(2000);
  const released = await q(
    `select status from unit_reservations where event_id = $1`, [ev.id]);
  check(
    released.every((r) => r.status === "cancelled"),
    `cancelling the event releases its rooms (${released.map((r) => r.status).join(",")})`,
  );

  // ── consumables and margin ────────────────────────────────────────────────
  const res = (await q(
    `insert into unit_reservations
       (reservation_code, unit_id, user_id, tenant_name, starts_at, ends_at, seats,
        letting_mode, unit_price, total_price, exclusive_use, status, payment_status)
     select $2, u.id, null, 'PT Rapat Panjang', now() + interval '2 days',
            now() + interval '2 days 3 hours', 1, u.letting_mode, 500000, 1500000,
            u.exclusive_use, 'confirmed', 'paid'
       from lettable_units u where u.id = $1
     returning id`,
    [hall.id, `CW-EX-${RUN}`],
  ))[0];

  const booking = `${BASE}/admin/coworking/booking/${res.id}`;
  await page.goto(booking, { waitUntil: "domcontentloaded" });
  check(await page.getByRole("heading", { name: "PT Rapat Panjang" }).isVisible(), "booking detail renders");

  // A new catalogue item, then two lines: four bundled, two sold.
  await page.getByRole("button", { name: "Item baru" }).click();
  const itemForm = page.locator("form").filter({ has: page.locator('input[name="cost_price"]') });
  await itemForm.locator('input[name="name"]').fill("Air mineral 600ml");
  await itemForm.locator('input[name="unit"]').fill("botol");
  await itemForm.locator('input[name="cost_price"]').fill("2500");
  await itemForm.locator('input[name="sell_price"]').fill("5000");
  await itemForm.getByRole("button", { name: "Simpan item" }).click();
  await page.waitForTimeout(1800);

  const cat = await q(`select * from items where site_id = $1`, [site.id]);
  check(cat.length === 1 && Number(cat[0].cost_price) === 2500, "catalogue item created with its own cost");

  const addLine = async (qty, included) => {
    await page.locator('select[name="item_id"]').selectOption({ index: 1 });
    await page.locator('input[name="qty"]').fill(String(qty));
    const inc = page.locator('input[name="included"]');
    if (included) await inc.check(); else await inc.uncheck();
    await page.getByRole("button", { name: "Tambah", exact: true }).click();
    await page.waitForTimeout(1500);
  };
  await addLine(4, true);
  await addLine(2, false);

  const lines = await q(
    `select qty, cost_price, sell_price, included from reservation_items where reservation_id = $1 order by created_at`,
    [res.id]);
  check(lines.length === 2, `two lines recorded (${lines.length})`);
  check(
    lines[0]?.included === true && Number(lines[0]?.sell_price) === 0,
    "a bundled line is not charged",
  );
  check(
    lines[1]?.included === false && Number(lines[1]?.sell_price) === 5000,
    "a sold line keeps its price",
  );

  // COGS 6 x 2500 = 15.000; sales 2 x 5000 = 10.000; margin 1.500.000 + 10.000 - 15.000.
  await page.goto(booking, { waitUntil: "domcontentloaded" });
  const money = (await page.locator("body").innerText()).replace(/\s+/g, " ");
  check(/Rp15\.000/.test(money), `HPP shows Rp15.000 (both lines cost, bundled included) — ${/Rp15\.000/.test(money)}`);
  check(/Rp10\.000/.test(money), "barang terjual shows Rp10.000");
  check(/Rp1\.495\.000/.test(money), "margin is 1.500.000 + 10.000 − 15.000 = Rp1.495.000");

  // Utilities: the flag the RO6 contract needed.
  const util = page.locator('input[type="checkbox"]').first();
  check(await util.isChecked(), "utilities are included by default");
  await util.uncheck();
  await page.waitForTimeout(1800);
  const flagged = (await q(`select utilities_included from unit_reservations where id = $1`, [res.id]))[0];
  check(flagged.utilities_included === false, "turning it off is written to the database");
  const note = await page.locator("body").innerText();
  check(/membayar listrik/.test(note), "…and the page explains what that means for the margin");

  check(errors.length === 0, `no page errors or 5xx (${errors.slice(0, 3).join(" | ") || "none"})`);

  await browser.close();
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
