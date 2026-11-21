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
     values ($1, $2, current_date, current_date + 365, 7200000, 'yearly')`,
    [`MB-${RUN}-X`, site.id],
  );
  check(
    nobody !== null && /has_a_holder/.test(nobody),
    "a membership belonging to nobody is refused",
  );

  const blankName = await refused(
    db,
    `insert into memberships (membership_code, site_id, member_name, starts_on, ends_on, price, period)
     values ($1, $2, '   ', current_date, current_date + 365, 7200000, 'yearly')`,
    [`MB-${RUN}-Y`, site.id],
  );
  check(
    blankName !== null && /has_a_holder/.test(blankName),
    "…and whitespace is not a name",
  );

  const backwards = await refused(
    db,
    `insert into memberships (membership_code, site_id, member_name, starts_on, ends_on, price, period)
     values ($1, $2, 'Budi', current_date, current_date - 1, 1, 'monthly')`,
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
            date_trunc('month', current_date)::date,
            (date_trunc('month', current_date) + interval '1 year')::date,
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
  const zero = (await q(`select * from membership_usage($1, current_date)`, [mb.id]))[0];
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
  const thisMonth = (await q(`select to_char(current_date, 'YYYY-MM') as m`))[0].m;
  await bookHours(room.id, `${thisMonth}-05T09:00:00+07:00`, `${thisMonth}-05T11:00:00+07:00`, mb.id);
  const used2 = (await q(`select * from membership_usage($1, current_date)`, [mb.id]))[0];
  check(Number(used2.meeting_room_hours) === 2, `two hours booked reads as 2 (got ${used2.meeting_room_hours})`);

  // A day pass is counted by the booking, not by hours.
  await bookHours(deskDay.id, `${thisMonth}-06T08:00:00+07:00`, `${thisMonth}-06T18:00:00+07:00`, mb.id);
  const withPass = (await q(`select * from membership_usage($1, current_date)`, [mb.id]))[0];
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
  const mine = (await q(`select * from membership_usage($1, current_date)`, [mb.id]))[0];
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
