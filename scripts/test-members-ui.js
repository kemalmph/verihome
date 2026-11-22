#!/usr/bin/env node
/**
 * The member and calendar pages, driven in a browser.
 *
 * The thing worth testing here is not that a form submits. It is that the
 * entitlement a member sees is the one the database computes from their
 * bookings — because that number is the whole reason memberships exist, and
 * a page that renders its own idea of it would be wrong in a way nobody
 * notices until someone is billed.
 *
 *   npx supabase db reset && seed admin && npm run build && npm run start
 *   node scripts/test-members-ui.js
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
    `insert into sites (name, slug, status) values ($1, $2, 'active') returning id, name`,
    [`UI Site ${RUN}`, `ui-site-${RUN}`],
  ))[0];
  const room = (await q(
    `insert into lettable_units (site_id, name, unit_type, letting_mode, capacity, price, status)
     values ($1, 'Ruang Rapat UI', 'meeting_room', 'hourly', 8, 150000, 'available') returning id`,
    [site.id],
  ))[0];

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("response", (r) => { if (r.status() >= 500) errors.push(`${r.status()} ${r.url()}`); });

  await page.goto(`${BASE}/auth/login`, { waitUntil: "domcontentloaded" });
  await page.fill('input[name="email"]', EMAIL);
  await page.fill('input[name="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2500);

  const members = `${BASE}/site/${site.id}/members`;

  // ── a plan ────────────────────────────────────────────────────────────────
  await page.goto(members, { waitUntil: "domcontentloaded" });
  check(await page.getByRole("heading", { name: "Member" }).first().isVisible(), "members page renders");
  check(await page.getByText("Belum ada member").isVisible(), "empty state shown");

  await page.getByRole("button", { name: "Tambah paket" }).click();
  const planForm = page.locator("form").filter({ has: page.locator('input[name="day_passes_per_month"]') });
  await planForm.locator('input[name="name"]').fill("Virtual Office 3");
  await planForm.locator('select[name="period"]').selectOption("yearly");
  await planForm.locator('input[name="price"]').fill("7200000");
  await planForm.locator('input[name="day_passes_per_month"]').fill("1");
  await planForm.locator('input[name="meeting_room_hours_per_month"]').fill("5");
  await planForm.locator('input[name="discount_pct"]').fill("10");
  await planForm.locator('input[name="hot_desk_included"]').check();
  await planForm.getByRole("button", { name: "Simpan paket" }).click();
  await page.waitForTimeout(1800);

  const plan = await q(`select * from membership_plans where site_id = $1`, [site.id]);
  check(plan.length === 1, "plan written to the database");
  check(Number(plan[0]?.meeting_room_hours_per_month) === 5, `plan carries 5 meeting hours (${plan[0]?.meeting_room_hours_per_month})`);
  check(plan[0]?.hot_desk_included === true, "plan carries hot desk");

  // ── a member ──────────────────────────────────────────────────────────────
  await page.goto(members, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Tambah member" }).click();
  const mForm = page.locator("form").filter({ has: page.locator('input[name="member_name"]') });
  await mForm.locator('input[name="member_name"]').fill("Budi Santoso");
  await mForm.locator('input[name="company_name"]').fill("PT Contoh Nusantara");
  await mForm.locator('select[name="plan_id"]').selectOption({ index: 1 });
  const today = new Date().toISOString().slice(0, 10);
  const nextYear = new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10);
  await mForm.locator('input[name="starts_on"]').fill(today);
  await mForm.locator('input[name="ends_on"]').fill(nextYear);
  await mForm.locator('select[name="status"]').selectOption("active");
  await mForm.getByRole("button", { name: "Simpan member" }).click();
  await page.waitForTimeout(2000);

  const mb = (await q(`select * from memberships where site_id = $1`, [site.id]))[0];
  check(!!mb, "membership written to the database");
  check(mb?.member_name === "Budi Santoso" && mb?.company_name === "PT Contoh Nusantara",
    "member is a person, billed to a company");
  check(Number(mb?.meeting_room_hours_per_month) === 5,
    `entitlements copied from the plan, not referenced (${mb?.meeting_room_hours_per_month})`);
  check(Number(mb?.price) === 7200000, `price taken from the plan (${mb?.price})`);

  // A name is required: a membership belonging to nobody must be refused at
  // the form, with a sentence, not a constraint violation.
  await page.goto(members, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Tambah member" }).click();
  const m2 = page.locator("form").filter({ has: page.locator('input[name="member_name"]') });
  await m2.locator('input[name="starts_on"]').fill(today);
  await m2.locator('input[name="ends_on"]').fill(today);
  const nameInput = m2.locator('input[name="member_name"]');
  check(await nameInput.getAttribute("required") !== null, "the member name field is required");

  // ── the number that matters ───────────────────────────────────────────────
  //
  // Two hours of the meeting room, booked against this membership. The page
  // must show 2/5 because the database says so, not because the page counted.
  await q(
    `insert into unit_reservations
       (reservation_code, unit_id, user_id, tenant_name, starts_at, ends_at, seats,
        letting_mode, unit_price, total_price, exclusive_use, status, membership_id)
     select $3, u.id, null, 'Budi Santoso',
            (date_trunc('month', (now() at time zone 'Asia/Jakarta')) at time zone 'Asia/Jakarta') + interval '5 days 9 hours',
            (date_trunc('month', (now() at time zone 'Asia/Jakarta')) at time zone 'Asia/Jakarta') + interval '5 days 11 hours',
            1, 'hourly', 150000, 0, u.exclusive_use, 'confirmed', $2
       from lettable_units u where u.id = $1`,
    [room.id, mb.id, `CW-UI-${RUN}`],
  );

  const dbUsage = (await q(`select * from membership_usage($1, (now() at time zone 'Asia/Jakarta')::date)`, [mb.id]))[0];
  check(Number(dbUsage.meeting_room_hours) === 2, `database says 2 hours used (${dbUsage.meeting_room_hours})`);

  await page.goto(members, { waitUntil: "domcontentloaded" });
  const rowText = await page.locator("tbody tr").first().innerText();
  check(
    /2\s*\/\s*5/.test(rowText.replace(/\s+/g, " ")),
    `the page shows the database's 2 / 5 (row: ${rowText.replace(/\s+/g, " ").slice(0, 120)})`,
  );

  // Over-quota must be visible, not silently clamped.
  await q(
    `insert into unit_reservations
       (reservation_code, unit_id, user_id, tenant_name, starts_at, ends_at, seats,
        letting_mode, unit_price, total_price, exclusive_use, status, membership_id)
     select $3, u.id, null, 'Budi Santoso',
            (date_trunc('month', (now() at time zone 'Asia/Jakarta')) at time zone 'Asia/Jakarta') + interval '6 days 9 hours',
            (date_trunc('month', (now() at time zone 'Asia/Jakarta')) at time zone 'Asia/Jakarta') + interval '6 days 16 hours',
            1, 'hourly', 150000, 0, u.exclusive_use, 'confirmed', $2
       from lettable_units u where u.id = $1`,
    [room.id, mb.id, `CW-UI2-${RUN}`],
  );
  await page.goto(members, { waitUntil: "domcontentloaded" });
  const overText = (await page.locator("tbody tr").first().innerText()).replace(/\s+/g, " ");
  check(/9\s*\/\s*5/.test(overText), `going over quota is shown, not clamped (${overText.slice(0, 90)})`);

  // ── the calendar ──────────────────────────────────────────────────────────
  const calendar = `${BASE}/site/${site.id}/calendar`;
  await page.goto(calendar, { waitUntil: "domcontentloaded" });
  check(await page.getByRole("heading", { name: "Kalender" }).isVisible(), "calendar renders");
  check(
    (await page.locator("thead th").count()) === 8,
    "the week grid has a unit column and seven days",
  );

  // An event with no room booked is the failure the design exists to prevent.
  const ev = (await q(
    `insert into events (site_id, title, starts_at, ends_at, status, host_name)
     values ($1, 'Acara Tanpa Ruangan', date_trunc('week', now()) + interval '2 days 13 hours',
             date_trunc('week', now()) + interval '2 days 16 hours', 'confirmed', 'Panitia')
     returning id`,
    [site.id],
  ))[0];
  await page.goto(calendar, { waitUntil: "domcontentloaded" });
  const body = await page.locator("body").innerText();
  check(/Event tanpa ruangan/.test(body), "an event with no booking is raised at the top of the calendar");
  check(/Acara Tanpa Ruangan/.test(body), "…and named");

  // Book the room around it, and the warning must clear.
  await q(
    `insert into unit_reservations
       (reservation_code, unit_id, user_id, tenant_name, starts_at, ends_at, seats,
        letting_mode, unit_price, total_price, exclusive_use, status, event_id)
     select $3, u.id, null, 'Acara Tanpa Ruangan',
            date_trunc('week', now()) + interval '2 days 12 hours',
            date_trunc('week', now()) + interval '2 days 17 hours',
            1, 'hourly', 150000, 0, u.exclusive_use, 'confirmed', $2
       from lettable_units u where u.id = $1`,
    [room.id, ev.id, `CW-EV-${RUN}`],
  );
  await page.goto(calendar, { waitUntil: "domcontentloaded" });
  const body2 = await page.locator("body").innerText();
  check(!/Event tanpa ruangan/.test(body2), "booking the room clears the warning");
  check(/Ruangan: Ruang Rapat UI/.test(body2), "…and the event shows which room it holds");

  // ── readable URLs ─────────────────────────────────────────────────────────
  //
  // /site/coco-lokalima/dashboard is something a person can write
  // down. The uuid form must keep working anyway: links already exist in
  // chats and bookmarks, and a URL scheme improving is not a reason for them
  // to start returning 404.
  const slugRow = (await q(`select slug from sites where id = $1`, [site.id]))[0];

  for (const [label, seg] of [["slug", slugRow.slug], ["uuid", site.id]]) {
    for (const page_ of ["", "/dashboard", "/calendar", "/members"]) {
      const r = await page.goto(`${BASE}/site/${seg}${page_}`, { waitUntil: "domcontentloaded" });
      check(r?.status() === 200, `${label}${page_ || " (site)"} → ${r?.status()}`);
    }
  }

  const bad = await page.goto(`${BASE}/site/tidak-ada-site-ini/dashboard`, { waitUntil: "domcontentloaded" });
  check(bad?.status() === 404, `an unknown slug is 404, not a crash (${bad?.status()})`);

  // A booking is reachable by its code, in either case.
  const code = (await q(
    `select reservation_code from unit_reservations where unit_id = $1 limit 1`, [room.id]))[0]?.reservation_code;
  if (code) {
    const byCode = await page.goto(`${BASE}/site/booking/${code}`, { waitUntil: "domcontentloaded" });
    check(byCode?.status() === 200, `booking by code ${code} → ${byCode?.status()}`);
    const byLower = await page.goto(`${BASE}/site/booking/${code.toLowerCase()}`, { waitUntil: "domcontentloaded" });
    check(byLower?.status() === 200, "…and the same code lower-cased, as a mail client might send it");
  }

  // ── the move from /admin/coworking to /site ───────────────────────────────
  //
  // Two things had to travel with the pages: the layout's redirect for people
  // who are not admins, and the proxy's PROTECTED_PREFIXES. Moving a folder
  // silently drops both, and the pages would still render for a signed-in
  // admin, so nothing would look wrong.
  const oldPaths = [
    ["/admin/coworking", "/site"],
    [`/admin/coworking/${slugRow.slug}/dashboard`, `/site/${slugRow.slug}/dashboard`],
    [`/admin/coworking/${slugRow.slug}/calendar`, `/site/${slugRow.slug}/calendar`],
  ];
  for (const [from, to] of oldPaths) {
    const r = await page.goto(`${BASE}${from}`, { waitUntil: "domcontentloaded" });
    const landed = new URL(page.url()).pathname;
    check(r?.status() === 200 && landed === to, `${from} → ${landed} (want ${to})`);
  }

  // The query string must survive, or a link to a particular week lands on
  // this week and quietly shows the wrong one.
  await page.goto(`${BASE}/admin/coworking/${slugRow.slug}/calendar?week=2026-11-16`, { waitUntil: "domcontentloaded" });
  const movedUrl = new URL(page.url());
  check(
    movedUrl.pathname === `/site/${slugRow.slug}/calendar` && movedUrl.searchParams.get("week") === "2026-11-16",
    `the week parameter survives the redirect (${movedUrl.pathname}?${movedUrl.searchParams})`,
  );

  // Signed out, /site must send you to the staff login — not to an error, and
  // not to the public one.
  const anon = await browser.newContext();
  const anonPage = await anon.newPage();
  const anonRes = await anonPage.goto(`${BASE}/site/${slugRow.slug}/dashboard`, { waitUntil: "domcontentloaded" });
  const anonPath = new URL(anonPage.url()).pathname;
  check(
    anonPath === "/admin-login",
    `a signed-out visitor to /site lands on ${anonPath} (want /admin-login), status ${anonRes?.status()}`,
  );
  await anon.close();

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
