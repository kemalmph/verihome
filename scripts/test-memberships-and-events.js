#!/usr/bin/env node
/**
 * Memberships and the event calendar — the guarantees, proved by writing.
 *
 * Two things here are easy to get subtly wrong and impossible to notice
 * afterwards, so they get the most attention:
 *
 *   event_space_gaps()  — an event announced in a room nobody booked
 *   membership_usage()  — entitlement counted in the wrong month, which
 *                         quietly gives away free hours every evening
 *
 *   npx supabase db reset && node scripts/test-memberships-and-events.js
 */
const { Client } = require("pg");

const CONN = { host: "127.0.0.1", port: 54322, user: "postgres", password: "postgres", database: "postgres" };
const pass = [];
const fail = [];
const check = (ok, what) => (ok ? pass : fail).push(what);
const RUN = Date.now().toString(36);

async function refused(db, sql, args = []) {
  try { await db.query(sql, args); return null; }
  catch (e) { return [e.message, e.detail].filter(Boolean).join(" | "); }
}

(async () => {
  const db = new Client(CONN);
  await db.connect();
  const q = async (sql, args = []) => (await db.query(sql, args)).rows;

  const site = (await q(
    `insert into sites (name, slug, status) values ($1, $2, 'active') returning id`,
    [`M Site ${RUN}`, `m-site-${RUN}`],
  ))[0];
  const hall = (await q(
    `insert into lettable_units (site_id, name, unit_type, letting_mode, capacity, price, status)
     values ($1, 'Aula', 'event_space', 'hourly', 80, 500000, 'available') returning id`,
    [site.id],
  ))[0];
  const room = (await q(
    `insert into lettable_units (site_id, name, unit_type, letting_mode, capacity, price, status)
     values ($1, 'Ruang Rapat', 'meeting_room', 'hourly', 8, 150000, 'available') returning id`,
    [site.id],
  ))[0];
  const deskDay = (await q(
    `insert into lettable_units (site_id, name, unit_type, letting_mode, capacity, price, status)
     values ($1, 'Hot Desk', 'hot_desk', 'daily', 20, 100000, 'available') returning id`,
    [site.id],
  ))[0];

  // ── plans ─────────────────────────────────────────────────────────────────
  const plan = (await q(
    `insert into membership_plans
       (site_id, name, price, period, day_passes_per_month, meeting_room_hours_per_month,
        hot_desk_included, discount_pct, mail_handling, address_use)
     values ($1, 'Virtual Office 3', 7200000, 'yearly', 1, 5, true, 10, true, true)
     returning *`,
    [site.id],
  ))[0];
  check(Number(plan.meeting_room_hours_per_month) === 5, "a plan carries its entitlements");

  const badDiscount = await refused(
    db,
    `insert into membership_plans (site_id, name, price, discount_pct) values ($1, 'Bad', 1, 150)`,
    [site.id],
  );
  check(badDiscount !== null && /discount_check/.test(badDiscount), "a discount above 100% is refused");

  // ── a membership belongs to a person ─────────────────────────────────────
  const nobody = await refused(
    db,
    `insert into memberships (membership_code, site_id, starts_on, ends_on, price, period)
     values ($1, $2, (now() at time zone 'Asia/Jakarta')::date, (now() at time zone 'Asia/Jakarta')::date + 365, 7200000, 'yearly')`,
    [`MB-${RUN}-X`, site.id],
  );
  check(
    nobody !== null && /has_a_holder/.test(nobody),
    "a membership belonging to nobody is refused",
  );

  const blankName = await refused(
    db,
    `insert into memberships (membership_code, site_id, member_name, starts_on, ends_on, price, period)
     values ($1, $2, '   ', (now() at time zone 'Asia/Jakarta')::date, (now() at time zone 'Asia/Jakarta')::date + 365, 7200000, 'yearly')`,
    [`MB-${RUN}-Y`, site.id],
  );
  check(
    blankName !== null && /has_a_holder/.test(blankName),
    "…and whitespace is not a name",
  );

  const backwards = await refused(
    db,
    `insert into memberships (membership_code, site_id, member_name, starts_on, ends_on, price, period)
     values ($1, $2, 'Budi', (now() at time zone 'Asia/Jakarta')::date, (now() at time zone 'Asia/Jakarta')::date - 1, 1, 'monthly')`,
    [`MB-${RUN}-Z`, site.id],
  );
  check(backwards !== null && /period_order/.test(backwards), "a membership ending before it starts is refused");

  // The real one: a person, billed to a company.
  const mb = (await q(
    `insert into memberships
       (membership_code, site_id, plan_id, member_name, member_contact, company_name,
        starts_on, ends_on, price, period,
        day_passes_per_month, meeting_room_hours_per_month, hot_desk_included,
        discount_pct, mail_handling, address_use, status, payment_status)
     select $1, $2, p.id, 'Budi Santoso', '0812-000-000', 'PT Contoh Nusantara',
            date_trunc('month', (now() at time zone 'Asia/Jakarta')::date)::date,
            (date_trunc('month', (now() at time zone 'Asia/Jakarta')::date) + interval '1 year')::date,
            p.price, p.period,
            p.day_passes_per_month, p.meeting_room_hours_per_month, p.hot_desk_included,
            p.discount_pct, p.mail_handling, p.address_use, 'active', 'paid'
       from membership_plans p where p.id = $3
     returning *`,
    [`MB-${RUN}-1`, site.id, plan.id],
  ))[0];
  check(mb.member_name === "Budi Santoso" && mb.company_name === "PT Contoh Nusantara",
    "a member is a person, billed to a company");
  check(Number(mb.meeting_room_hours_per_month) === 5, "entitlements are copied onto the membership");

  // Editing the plan must not change what was already bought.
  await q(`update membership_plans set meeting_room_hours_per_month = 99, price = 1 where id = $1`, [plan.id]);
  const after = (await q(`select meeting_room_hours_per_month, price from memberships where id = $1`, [mb.id]))[0];
  check(
    Number(after.meeting_room_hours_per_month) === 5 && Number(after.price) === 7200000,
    `changing the plan does not change an existing membership (${after.meeting_room_hours_per_month}h, ${after.price})`,
  );
  await q(`update membership_plans set meeting_room_hours_per_month = 5, price = 7200000 where id = $1`, [plan.id]);

  // ── usage is derived, and in the right month ──────────────────────────────
  const zero = (await q(`select * from membership_usage($1, (now() at time zone 'Asia/Jakarta')::date)`, [mb.id]))[0];
  check(
    Number(zero.meeting_room_hours) === 0 && Number(zero.day_passes) === 0,
    "a membership with no bookings has used nothing",
  );

  const bookHours = async (unitId, startIso, endIso, membershipId, eventId = null) =>
    (await q(
      `insert into unit_reservations
         (reservation_code, unit_id, user_id, tenant_name, starts_at, ends_at, seats,
          letting_mode, unit_price, total_price, exclusive_use, status, membership_id, event_id)
       select 'CW-' || substr(md5(random()::text), 1, 10), u.id, null, 'Budi Santoso',
              $2::timestamptz, $3::timestamptz, 1, u.letting_mode, 0, 0, u.exclusive_use,
              'confirmed', $4, $5
         from lettable_units u where u.id = $1
       returning id`,
      [unitId, startIso, endIso, membershipId, eventId],
    ))[0];

  // Two hours this month, in Jakarta time.
  const thisMonth = (await q(`select to_char((now() at time zone 'Asia/Jakarta')::date, 'YYYY-MM') as m`))[0].m;
  await bookHours(room.id, `${thisMonth}-05T09:00:00+07:00`, `${thisMonth}-05T11:00:00+07:00`, mb.id);
  const used2 = (await q(`select * from membership_usage($1, (now() at time zone 'Asia/Jakarta')::date)`, [mb.id]))[0];
  check(Number(used2.meeting_room_hours) === 2, `two hours booked reads as 2 (got ${used2.meeting_room_hours})`);

  // A day pass is counted by the booking, not by hours.
  await bookHours(deskDay.id, `${thisMonth}-06T08:00:00+07:00`, `${thisMonth}-06T18:00:00+07:00`, mb.id);
  const withPass = (await q(`select * from membership_usage($1, (now() at time zone 'Asia/Jakarta')::date)`, [mb.id]))[0];
  check(
    Number(withPass.meeting_room_hours) === 2 && Number(withPass.day_passes) === 1,
    `a daily booking is a day pass, not ten meeting hours (${withPass.meeting_room_hours}h, ${withPass.day_passes} pass)`,
  );

  // The month boundary, in Jakarta — this is the one that gives hours away.
  // 2026-12-01 00:30 Jakarta is 2026-11-30 17:30 UTC. It belongs to December.
  const mb2 = (await q(
    `insert into memberships (membership_code, site_id, member_name, starts_on, ends_on, price, period,
                              meeting_room_hours_per_month, status, payment_status)
     values ($1, $2, 'Sita', '2026-01-01', '2027-12-31', 0, 'monthly', 10, 'active', 'paid') returning id`,
    [`MB-${RUN}-2`, site.id],
  ))[0];
  await bookHours(room.id, "2026-12-01T00:30:00+07:00", "2026-12-01T01:30:00+07:00", mb2.id);

  const dec = (await q(`select * from membership_usage($1, '2026-12-01'::date)`, [mb2.id]))[0];
  const nov = (await q(`select * from membership_usage($1, '2026-11-01'::date)`, [mb2.id]))[0];
  check(Number(dec.meeting_room_hours) === 1, `a 00:30 Jakarta booking counts in December (${dec.meeting_room_hours})`);
  check(Number(nov.meeting_room_hours) === 0, `…and not in November (${nov.meeting_room_hours})`);

  // Another member's bookings are not this member's usage.
  const mine = (await q(`select * from membership_usage($1, (now() at time zone 'Asia/Jakarta')::date)`, [mb.id]))[0];
  check(Number(mine.meeting_room_hours) === 2, "usage is per membership, not per site");

  // ── events hold space only through reservations ───────────────────────────
  const ev = (await q(
    `insert into events (site_id, title, starts_at, ends_at, status, host_name)
     values ($1, 'Community Night', '2026-12-10T18:00:00+07:00', '2026-12-10T21:00:00+07:00', 'draft', 'Tim Cosystem')
     returning id`,
    [site.id],
  ))[0];

  const gapsBefore = await q(`select * from event_space_gaps($1)`, [ev.id]);
  check(
    gapsBefore.length === 1,
    `an event with no booking is entirely a gap (${gapsBefore.length} gap)`,
  );

  // Book the hall with setup and teardown around the event.
  await bookHours(hall.id, "2026-12-10T17:00:00+07:00", "2026-12-10T22:00:00+07:00", null, ev.id);
  const gapsAfter = await q(`select * from event_space_gaps($1)`, [ev.id]);
  check(gapsAfter.length === 0, `a booking wider than the event leaves no gap (${gapsAfter.length})`);

  // An event that runs past its booking must be caught.
  await q(`update events set ends_at = '2026-12-10T23:00:00+07:00' where id = $1`, [ev.id]);
  const overrun = await q(`select * from event_space_gaps($1)`, [ev.id]);
  check(
    overrun.length === 1 && new Date(overrun[0].gap_end) - new Date(overrun[0].gap_start) === 3600000,
    `an event running an hour past its booking shows a one-hour gap (${JSON.stringify(overrun)})`,
  );
  await q(`update events set ends_at = '2026-12-10T21:00:00+07:00' where id = $1`, [ev.id]);

  // A cancelled booking stops covering the event — it also stops holding the room.
  await q(`update unit_reservations set status = 'cancelled' where event_id = $1`, [ev.id]);
  const afterCancel = await q(`select * from event_space_gaps($1)`, [ev.id]);
  check(afterCancel.length === 1, "cancelling the booking re-opens the gap");
  await q(`update unit_reservations set status = 'confirmed' where event_id = $1`, [ev.id]);

  // Two rooms, one event.
  await bookHours(room.id, "2026-12-10T18:00:00+07:00", "2026-12-10T21:00:00+07:00", null, ev.id);
  const twoRooms = await q(
    `select count(*)::int as n from unit_reservations where event_id = $1 and status = 'confirmed'`, [ev.id]);
  check(twoRooms[0].n === 2, "one event can hold several units");

  // The exclusion constraint still governs: an event booking does not get a
  // free pass to double-book a room.
  const clash = await refused(
    db,
    `insert into unit_reservations
       (reservation_code, unit_id, user_id, tenant_name, starts_at, ends_at, seats,
        letting_mode, unit_price, total_price, exclusive_use, status, event_id)
     values ($2, $1, null, 'Pihak Lain', '2026-12-10T19:00:00+07:00', '2026-12-10T20:00:00+07:00',
             1, 'hourly', 0, 0, true, 'confirmed', null)`,
    [hall.id, `CW-CLASH-${RUN}`],
  );
  check(
    clash !== null && /no_overlap/.test(clash),
    "a second booking of a room an event holds is still refused",
  );

  const badWindow = await refused(
    db,
    `insert into events (site_id, title, starts_at, ends_at) values ($1, 'Mundur', now(), now() - interval '1 hour')`,
    [site.id],
  );
  check(badWindow !== null && /time_order/.test(badWindow), "an event ending before it starts is refused");

  // ── amenities and consumables ─────────────────────────────────────────────
  const amenities = await q(`select code from amenities where code in ('ac','wifi','projector')`);
  check(amenities.length === 3, "the amenity vocabulary is seeded");

  const dupAmenity = await refused(db, `insert into amenities (code, label) values ('ac', 'AC lagi')`);
  check(dupAmenity !== null && /amenities_code_key/.test(dupAmenity), "an amenity code cannot be duplicated");

  const badCategory = await refused(db, `insert into amenities (code, label, category) values ('x1', 'X', 'nonsense')`);
  check(badCategory !== null && /category_check/.test(badCategory), "an amenity category outside the list is refused");

  await q(`insert into unit_amenities (unit_id, amenity_id)
           select $1, id from amenities where code in ('ac','projector','whiteboard')`, [room.id]);
  const roomHas = await q(
    `select a.code from unit_amenities ua join amenities a on a.id = ua.amenity_id where ua.unit_id = $1 order by a.code`,
    [room.id]);
  check(roomHas.length === 3, `a unit carries its amenities (${roomHas.map((r) => r.code).join(",")})`);

  const dupLink = await refused(db,
    `insert into unit_amenities (unit_id, amenity_id) select $1, id from amenities where code = 'ac'`, [room.id]);
  check(dupLink !== null, "the same amenity cannot be attached to a unit twice");

  // One catalogue, cost and price kept apart.
  const aqua = (await q(
    `insert into items (site_id, name, kind, unit, cost_price, sell_price)
     values ($1, 'Air mineral 600ml', 'consumable', 'botol', 2500, 5000) returning *`,
    [site.id]))[0];
  check(Number(aqua.cost_price) === 2500 && Number(aqua.sell_price) === 5000,
    "an item keeps cost and sell price apart");

  const res = (await q(
    `select id from unit_reservations where membership_id = $1 limit 1`, [mb.id]))[0];

  // Bundled into the room rate: it still costs the business something.
  await q(
    `insert into reservation_items (reservation_id, item_id, name, qty, cost_price, sell_price, included)
     values ($1, $2, 'Air mineral 600ml', 4, 2500, 0, true)`,
    [res.id, aqua.id]);
  // Charged on top.
  await q(
    `insert into reservation_items (reservation_id, item_id, name, qty, cost_price, sell_price, included)
     values ($1, $2, 'Air mineral 600ml', 2, 2500, 5000, false)`,
    [res.id, aqua.id]);

  const billedBundle = await refused(db,
    `insert into reservation_items (reservation_id, name, qty, cost_price, sell_price, included)
     values ($1, 'Kopi', 1, 5000, 15000, true)`, [res.id]);
  check(
    billedBundle !== null && /included_is_free/.test(billedBundle),
    "an item cannot be both bundled and billed",
  );

  const tally = (await q(
    `select sum(qty * cost_price)::int as cogs, sum(qty * sell_price)::int as sold
       from reservation_items where reservation_id = $1`, [res.id]))[0];
  check(
    tally.cogs === 15000 && tally.sold === 10000,
    `consumables give a real COGS and a real sale (COGS ${tally.cogs}, dijual ${tally.sold})`,
  );

  // Who pays the electricity is a column now, not a sentence in a note.
  const util = (await q(`select utilities_included from unit_reservations where id = $1`, [res.id]))[0];
  check(util.utilities_included === true, "utilities are included by default");
  await q(`update unit_reservations set utilities_included = false where id = $1`, [res.id]);
  const util2 = (await q(`select utilities_included from unit_reservations where id = $1`, [res.id]))[0];
  check(util2.utilities_included === false, "…and can be turned off, as contract 006 needs");

  // ── monthly prices, and the two money columns ────────────────────────────
  //
  // The migration divided lease and monthly prices by twelve. The risk is not
  // that it failed — it is that it ran twice, or ran on an hourly rate, and
  // nobody noticed because every number still looks like money.
  const hourly = (await q(
    `insert into lettable_units (site_id, name, unit_type, letting_mode, capacity, price, status)
     values ($1, 'Rapat Per Jam', 'meeting_room', 'hourly', 6, 150000, 'available') returning price`,
    [site.id]))[0];
  check(Number(hourly.price) === 150000, "an hourly rate is stored as typed, not divided");

  // A contract: Rp3.500.000 a month for two months.
  const leaseUnit = (await q(
    `insert into lettable_units (site_id, name, unit_type, letting_mode, capacity, price, status)
     values ($1, 'Kantor Sewa', 'private_room', 'lease', 4, 3500000, 'available') returning id, price`,
    [site.id]))[0];
  check(Number(leaseUnit.price) === 3500000, "a lease price list is a monthly figure");

  const lease = (await q(
    `insert into unit_reservations
       (reservation_code, unit_id, user_id, tenant_name, starts_at, ends_at, seats,
        letting_mode, unit_price, total_price, exclusive_use, status)
     values ($2, $1, null, 'PT Dua Bulan',
             '2027-02-01T00:00:00+07:00', '2027-03-31T23:59:59+07:00',
             1, 'lease', 3200000, 6400000, true, 'confirmed')
     returning unit_price, total_price`,
    [leaseUnit.id, `CW-RATE-${RUN}`]))[0];
  check(
    Number(lease.unit_price) === 3200000 && Number(lease.total_price) === 6400000,
    `the agreed rate and the contract value are separate numbers (${lease.unit_price} / ${lease.total_price})`,
  );
  check(
    Number(lease.total_price) === Number(lease.unit_price) * 2,
    "a two-month contract is worth twice its monthly rate",
  );
  check(
    Number(lease.unit_price) < Number(leaseUnit.price),
    "a contract may be agreed below the price list, and both are kept",
  );

  // ── documents ─────────────────────────────────────────────────────────────
  const resId = (await q(`select id from unit_reservations where reservation_code = $1`, [`CW-RATE-${RUN}`]))[0].id;

  await q(
    `insert into coworking_documents (reservation_id, kind, file_key, file_name, content_type, size_bytes)
     values ($1, 'contract', $2, 'kontrak.pdf', 'application/pdf', 12345)`,
    [resId, `coworking/reservations/${resId}/1-kontrak.pdf`]);
  const docs = await q(`select * from coworking_documents where reservation_id = $1`, [resId]);
  check(docs.length === 1, "a document attaches to a contract");
  check(!/^https?:/.test(docs[0].file_key), `the key is stored, not a URL (${docs[0].file_key})`);

  const noOwner = await refused(db,
    `insert into coworking_documents (kind, file_key, file_name, content_type, size_bytes)
     values ('contract', 'x/1', 'a.pdf', 'application/pdf', 1)`);
  check(noOwner !== null && /one_owner/.test(noOwner), "a document belonging to nothing is refused");

  const twoOwners = await refused(db,
    `insert into coworking_documents (site_id, reservation_id, kind, file_key, file_name, content_type, size_bytes)
     values ($1, $2, 'contract', 'x/2', 'a.pdf', 'application/pdf', 1)`, [site.id, resId]);
  check(twoOwners !== null && /one_owner/.test(twoOwners), "…and one belonging to two things is refused");

  const dupKey = await refused(db,
    `insert into coworking_documents (reservation_id, kind, file_key, file_name, content_type, size_bytes)
     values ($1, 'contract', $2, 'lagi.pdf', 'application/pdf', 99)`,
    [resId, docs[0].file_key]);
  check(dupKey !== null && /file_key/.test(dupKey), "the same object cannot be filed twice");

  const badKind = await refused(db,
    `insert into coworking_documents (reservation_id, kind, file_key, file_name, content_type, size_bytes)
     values ($1, 'surat_cinta', 'x/3', 'a.pdf', 'application/pdf', 1)`, [resId]);
  check(badKind !== null && /kind_check/.test(badKind), "a document kind outside the list is refused");

  // Deleting the contract takes its paperwork with it; nothing is left
  // pointing at a reservation that no longer exists.
  await q(`delete from unit_reservations where id = $1`, [resId]);
  const orphans = await q(`select 1 from coworking_documents where reservation_id = $1`, [resId]);
  check(orphans.length === 0, "deleting a contract removes its document rows");

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
