#!/usr/bin/env node
/**
 * unit_reservations — the guarantees, proved by writing.
 *
 * Reading a constraint definition back tells you a constraint exists. It does
 * not tell you it fires. §19.9 is this project's record of what that
 * difference costs, so everything here is asserted by attempting the write and
 * watching it be refused.
 *
 * The concurrency check is the one that matters most. Two clients race for the
 * same meeting room in parallel transactions; exactly one may win. A sequential
 * test would pass against a broken lock.
 *
 * Needs the local stack only — no browser, no app:
 *   npx supabase db reset && node scripts/test-unit-reservations.js
 */
const { Client } = require("pg");

const CONN = { host: "127.0.0.1", port: 54322, user: "postgres", password: "postgres", database: "postgres" };

const pass = [];
const fail = [];
const check = (ok, what) => (ok ? pass : fail).push(what);

/**
 * A suffix unique to this run, so the script can be run twice without a reset.
 * Without it the second run died on a duplicate slug and reported ERROR, which
 * looks like a broken guarantee rather than a dirty database — exactly the
 * confusion a test should not create.
 */
const RUN = Date.now().toString(36);

/**
 * Run a write expected to be refused; returns what Postgres said, or null if
 * it was accepted.
 *
 * message AND detail, because Postgres splits the two and the useful half is
 * not always the first: a generated-column refusal says only "cannot insert a
 * non-DEFAULT value into column" in the message, and names the reason in
 * DETAIL. Matching on message alone made a passing guarantee look broken.
 */
async function refused(db, sql, args = []) {
  try {
    await db.query(sql, args);
    return null;
  } catch (e) {
    return [e.message, e.detail].filter(Boolean).join(" | ");
  }
}

(async () => {
  const db = new Client(CONN);
  await db.connect();
  const q = async (sql, args = []) => (await db.query(sql, args)).rows;

  // ── fixtures ──────────────────────────────────────────────────────────────
  // public.users.id references auth.users, and a trigger mirrors the row
  // across (§3). Going in through auth.users is therefore the only way to make
  // a user, and it exercises that trigger rather than working around it.
  const user = (await q(
    `insert into auth.users
       (id, instance_id, aud, role, email, encrypted_password,
        email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
     values (gen_random_uuid(), '00000000-0000-0000-0000-000000000000',
             'authenticated', 'authenticated', $1, 'x',
             now(), now(), now(), '{}', '{"name":"Res User"}')
     returning id`,
    [`res-${RUN}@example.invalid`],
  ))[0];
  const mirrored = await q(`select 1 from public.users where id = $1`, [user.id]);
  check(mirrored.length === 1, "fixture user mirrored into public.users by the auth trigger");
  const site = (await q(
    `insert into sites (name, slug, status) values ($1, $2, 'active') returning id, site_type`,
    [`Res Site ${RUN}`, `res-site-${RUN}`],
  ))[0];
  check(site.site_type === "coworking", "fixture site defaults to coworking");

  const room = (await q(
    `insert into lettable_units (site_id, name, unit_type, letting_mode, capacity, price, status)
     values ($1, 'Meeting Room A', 'meeting_room', 'hourly', 8, 150000, 'available')
     returning id, exclusive_use, capacity`,
    [site.id],
  ))[0];
  const desks = (await q(
    `insert into lettable_units (site_id, name, unit_type, letting_mode, capacity, price, status)
     values ($1, 'Hot Desk Floor', 'hot_desk', 'daily', 3, 100000, 'available')
     returning id, exclusive_use, capacity`,
    [site.id],
  ))[0];
  const broken = (await q(
    `insert into lettable_units (site_id, name, unit_type, letting_mode, capacity, price, status)
     values ($1, 'Room Under Repair', 'private_room', 'monthly', 4, 3000000, 'maintenance')
     returning id`,
    [site.id],
  ))[0];

  // ── exclusive_use is derived, not declared ────────────────────────────────
  check(room.exclusive_use === true,  "a meeting room is exclusive_use");
  check(desks.exclusive_use === false, "a hot desk is not exclusive_use");

  const override = await refused(
    db,
    `insert into lettable_units (site_id, name, unit_type, letting_mode, capacity, status, exclusive_use)
     values ($1, 'Liar', 'meeting_room', 'hourly', 2, 'available', false)`,
    [site.id],
  );
  check(
    override !== null && /generated/i.test(override),
    "exclusive_use cannot be overridden on insert (it is GENERATED, not a default)",
  );

  // Changing the type must move it, since it is STORED and derived.
  await q(`update lettable_units set unit_type = 'hot_desk' where id = $1`, [room.id]);
  const flipped = (await q(`select exclusive_use from lettable_units where id = $1`, [room.id]))[0];
  check(flipped.exclusive_use === false, "changing unit_type recomputes exclusive_use");
  await q(`update lettable_units set unit_type = 'meeting_room' where id = $1`, [room.id]);

  // ── a reservation, through the real function ──────────────────────────────
  const T = (h) => `2026-12-01T${String(h).padStart(2, "0")}:00:00Z`;

  const first = (await q(
    `select * from create_unit_reservation_if_available($1, $2, $3::timestamptz, $4::timestamptz)`,
    [room.id, user.id, T(9), T(11)],
  ))[0];
  check(/^CW-\d{8}-[0-9A-F]{4}$/.test(first.reservation_code), `reservation_code generated (${first.reservation_code})`);
  check(first.status === "pending" && first.payment_status === "unpaid", "a new reservation is pending and unpaid");
  check(
    Number(first.unit_price) === 150000 && Number(first.total_price) === 150000,
    `price snapshotted from the unit (${first.unit_price} / ${first.total_price})`,
  );
  check(first.letting_mode === "hourly", "letting_mode snapshotted from the unit");

  // A later price change must not rewrite what was agreed.
  await q(`update lettable_units set price = 999000 where id = $1`, [room.id]);
  const unchanged = (await q(`select unit_price from unit_reservations where id = $1`, [first.id]))[0];
  check(Number(unchanged.unit_price) === 150000, "a unit price change does not rewrite an existing reservation");
  await q(`update lettable_units set price = 150000 where id = $1`, [room.id]);

  // ── overlap on an exclusive unit ──────────────────────────────────────────
  const overlap = await refused(
    db,
    `select create_unit_reservation_if_available($1, $2, $3::timestamptz, $4::timestamptz)`,
    [room.id, user.id, T(10), T(12)],
  );
  check(overlap !== null && /unit_already_taken/.test(overlap), "an overlapping hour on an exclusive unit is refused by name");

  // Touching, not overlapping: 11:00–12:00 starts exactly when the first ends.
  const adjacent = (await q(
    `select * from create_unit_reservation_if_available($1, $2, $3::timestamptz, $4::timestamptz)`,
    [room.id, user.id, T(11), T(12)],
  ))[0];
  check(!!adjacent.id, "a reservation starting exactly when another ends is allowed");

  // ── the exclusion constraint, bypassing the function entirely ─────────────
  //
  // This is the whole point of having it: a write that does not go through
  // create_unit_reservation_if_available must still be stopped.
  const direct = await refused(
    db,
    `insert into unit_reservations
       (reservation_code, unit_id, user_id, starts_at, ends_at, seats, letting_mode, unit_price, total_price, exclusive_use)
     values ($5, $1, $2, $3::timestamptz, $4::timestamptz, 1, 'hourly', 150000, 150000, true)`,
    [room.id, user.id, T(9), T(10), `CW-DIRECT-${RUN}`],
  );
  check(
    direct !== null && /unit_reservations_no_overlap/.test(direct),
    "a raw INSERT that skips the function is still refused by the exclusion constraint",
  );

  // Cancelling releases the slot: the constraint only holds pending/confirmed.
  await q(`update unit_reservations set status = 'cancelled', cancelled_at = now() where id = $1`, [first.id]);
  const afterCancel = (await q(
    `select * from create_unit_reservation_if_available($1, $2, $3::timestamptz, $4::timestamptz)`,
    [room.id, user.id, T(9), T(10)],
  ))[0];
  check(!!afterCancel.id, "cancelling a reservation releases the unit");

  // ── shared units: overlap is legal up to capacity ─────────────────────────
  const d1 = (await q(
    `select * from create_unit_reservation_if_available($1, $2, $3::timestamptz, $4::timestamptz, 2)`,
    [desks.id, user.id, T(9), T(17)],
  ))[0];
  check(Number(d1.seats) === 2, "a hot desk reservation can take several seats");
  check(
    Number(d1.total_price) === 200000,
    `total is price x seats for a shared unit (${d1.total_price})`,
  );

  const d2 = (await q(
    `select * from create_unit_reservation_if_available($1, $2, $3::timestamptz, $4::timestamptz, 1)`,
    [desks.id, user.id, T(10), T(12)],
  ))[0];
  check(!!d2.id, "overlapping hot desk reservations are allowed while seats remain");

  const overCapacity = await refused(
    db,
    `select create_unit_reservation_if_available($1, $2, $3::timestamptz, $4::timestamptz, 1)`,
    [desks.id, user.id, T(11), T(13)],
  );
  check(
    overCapacity !== null && /unit_at_capacity/.test(overCapacity),
    "a hot desk is refused past its capacity (3 seats, 2+1 taken)",
  );

  const seatsOnExclusive = await refused(
    db,
    `select create_unit_reservation_if_available($1, $2, $3::timestamptz, $4::timestamptz, 2)`,
    [room.id, user.id, T(20), T(21)],
  );
  check(
    seatsOnExclusive !== null && /exclusive_unit_takes_one_seat/.test(seatsOnExclusive),
    "an exclusive unit refuses a multi-seat reservation",
  );

  // ── lettability, which is not occupancy ───────────────────────────────────
  const maint = await refused(
    db,
    `select create_unit_reservation_if_available($1, $2, $3::timestamptz, $4::timestamptz)`,
    [broken.id, user.id, T(9), T(10)],
  );
  check(maint !== null && /unit_not_lettable/.test(maint), "a unit under maintenance cannot be reserved");

  // ── bad periods ───────────────────────────────────────────────────────────
  const backwards = await refused(
    db,
    `select create_unit_reservation_if_available($1, $2, $3::timestamptz, $4::timestamptz)`,
    [room.id, user.id, T(12), T(10)],
  );
  check(backwards !== null && /invalid_period/.test(backwards), "a reservation that ends before it starts is refused");

  const zeroLength = await refused(
    db,
    `select create_unit_reservation_if_available($1, $2, $3::timestamptz, $4::timestamptz)`,
    [room.id, user.id, T(14), T(14)],
  );
  check(zeroLength !== null && /invalid_period/.test(zeroLength), "a zero-length reservation is refused");

  // ── the money ─────────────────────────────────────────────────────────────
  const payable = (await q(
    `select * from create_unit_reservation_if_available($1, $2, $3::timestamptz, $4::timestamptz)`,
    [room.id, user.id, T(15), T(16)],
  ))[0];

  const earlyRevenue = await refused(db, `select settle_unit_reservation_completion($1)`, [payable.id]);
  check(earlyRevenue !== null && /not_paid/.test(earlyRevenue), "revenue cannot be earned before payment is received");

  await q(`select settle_unit_reservation_payment($1)`, [payable.id]);
  const paid = (await q(`select status, payment_status, confirmed_at from unit_reservations where id = $1`, [payable.id]))[0];
  check(paid.payment_status === "paid", "payment marks the reservation paid");
  check(paid.status === "confirmed", "…and moves it from pending to confirmed");
  check(paid.confirmed_at !== null, "…and stamps confirmed_at");

  const onPayment = await q(
    `select account, direction, amount::int as amount from ledger_entries
      where reservation_id = $1 and event_type = 'reservation_payment_received' order by direction`,
    [payable.id],
  );
  check(
    onPayment.length === 2 &&
      onPayment.some((e) => e.account === "cash" && e.direction === "debit" && e.amount === 150000) &&
      onPayment.some((e) => e.account === "unearned_revenue" && e.direction === "credit" && e.amount === 150000),
    `payment posts cash debit and unearned_revenue credit (${JSON.stringify(onPayment)})`,
  );

  const noRevenueYet = await q(
    `select 1 from ledger_entries where reservation_id = $1 and account = 'revenue_coworking'`,
    [payable.id],
  );
  check(noRevenueYet.length === 0, "money received is a liability, not yet revenue");

  const doublePay = await refused(db, `select settle_unit_reservation_payment($1)`, [payable.id]);
  check(doublePay !== null && /already_paid/.test(doublePay), "paying twice is refused");

  await q(`select settle_unit_reservation_completion($1)`, [payable.id]);
  const onCompletion = await q(
    `select account, direction, amount::int as amount from ledger_entries
      where reservation_id = $1 and event_type = 'reservation_revenue_earned' order by direction`,
    [payable.id],
  );
  check(
    onCompletion.length === 2 &&
      onCompletion.some((e) => e.account === "unearned_revenue" && e.direction === "debit" && e.amount === 150000) &&
      onCompletion.some((e) => e.account === "revenue_coworking" && e.direction === "credit" && e.amount === 150000),
    `completion releases the liability into revenue_coworking (${JSON.stringify(onCompletion)})`,
  );

  const balance = (await q(
    `select coalesce(sum(case when direction='debit' then amount else -amount end),0)::int as net
       from ledger_entries where reservation_id = $1`,
    [payable.id],
  ))[0];
  check(balance.net === 0, `the reservation's entries balance to zero (net ${balance.net})`);

  const doubleComplete = await refused(db, `select settle_unit_reservation_completion($1)`, [payable.id]);
  check(doubleComplete !== null && /already_completed/.test(doubleComplete), "completing twice is refused");

  // The once-only index, bypassing the functions.
  const doublePost = await refused(
    db,
    `insert into ledger_entries (event_type, account, direction, amount, reservation_id)
     values ('reservation_payment_received', 'cash', 'debit', 150000, $1)`,
    [payable.id],
  );
  check(
    doublePost !== null && /ledger_once_per_reservation/.test(doublePost),
    "a duplicate posting is refused by the once-only index, not just by the function",
  );

  // Ledger immutability still holds for the new rows.
  const mutate = await refused(db, `update ledger_entries set amount = 1 where reservation_id = $1`, [payable.id]);
  check(mutate !== null, `ledger entries remain immutable (${(mutate ?? "").split("\n")[0]})`);

  // A value no migration added must still be refused.
  const badAccount = await refused(
    db,
    `insert into ledger_entries (event_type, account, direction, amount) values ('reservation_payment_received','revenue_coworking_xyz','debit',1)`,
  );
  check(badAccount !== null && /account_check/.test(badAccount), "an account outside the CHECK list is refused");

  // ── the TypeScript lists must match the CHECK constraints ────────────────
  //
  // The migration says these lists are "mirrored in taxonomy.ts". That is a
  // claim, and an unchecked claim about two lists in two languages is how a
  // form comes to offer a value the database rejects — §10's lesson, and the
  // reason taxonomy.ts exists at all.
  //
  // Read from the .ts source rather than imported, because this script is
  // plain node. A regex over a literal array is enough to catch drift, which
  // is the whole job.
  const taxonomy = require("fs").readFileSync(
    require("path").join(__dirname, "..", "src", "lib", "coworking", "taxonomy.ts"),
    "utf8",
  );
  const tsValues = (exportName) => {
    const m = taxonomy.match(new RegExp(`export const ${exportName} = \\[([\\s\\S]*?)\\] as const;`));
    if (!m) return null;
    return [...m[1].matchAll(/value:\s*"([^"]+)"/g)].map((x) => x[1]).sort();
  };
  const checkValues = async (constraintName) => {
    const rows = await q(
      `select pg_get_constraintdef(oid) as def from pg_constraint where conname = $1`,
      [constraintName],
    );
    if (!rows.length) return null;
    return [...rows[0].def.matchAll(/'([a-z_]+)'::text/g)].map((x) => x[1]).sort();
  };

  for (const [exportName, constraintName] of [
    ["RESERVATION_STATUSES", "unit_reservations_status_check"],
    ["PAYMENT_STATUSES",     "unit_reservations_payment_status_check"],
    ["LETTING_MODES",        "unit_reservations_letting_mode_check"],
    ["UNIT_TYPES",           "lettable_units_unit_type_check"],
    ["UNIT_STATUSES",        "lettable_units_status_check"],
    ["SITE_TYPES",           "sites_site_type_check"],
    ["SITE_STATUSES",        "sites_status_check"],
  ]) {
    const ts = tsValues(exportName);
    const pg = await checkValues(constraintName);
    check(
      ts !== null && pg !== null && JSON.stringify(ts) === JSON.stringify(pg),
      `${exportName} matches ${constraintName} (ts: ${ts?.join(",") ?? "NOT FOUND"} | pg: ${pg?.join(",") ?? "NOT FOUND"})`,
    );
  }

  // HOLDING_STATUSES must be the statuses the exclusion constraint defends,
  // or a dashboard will report a room free that the database will not let you
  // book.
  const exclusionDef = (await q(
    `select pg_get_constraintdef(oid) as def from pg_constraint where conname = 'unit_reservations_no_overlap'`,
  ))[0]?.def ?? "";
  const holding = [...(taxonomy.match(/export const HOLDING_STATUSES = \[([^\]]*)\]/)?.[1] ?? "")
    .matchAll(/"([a-z_]+)"/g)].map((x) => x[1]).sort();
  const defended = [...exclusionDef.matchAll(/'([a-z_]+)'::text/g)].map((x) => x[1]).sort();
  check(
    holding.length > 0 && JSON.stringify(holding) === JSON.stringify(defended),
    `HOLDING_STATUSES matches the exclusion constraint (ts: ${holding.join(",")} | pg: ${defended.join(",")})`,
  );

  await db.end();

  // ── the race ──────────────────────────────────────────────────────────────
  //
  // Two separate connections, both in a transaction, both reserving the same
  // room for the same hour, released together. Exactly one may win. Run
  // sequentially this proves nothing, which is why it is not run sequentially.
  const raceUnit = room.id;
  const a = new Client(CONN);
  const b = new Client(CONN);
  await a.connect();
  await b.connect();

  const attempt = async (c) => {
    try {
      await c.query("begin");
      await c.query(
        `select create_unit_reservation_if_available($1, $2, '2026-12-05T09:00:00Z'::timestamptz, '2026-12-05T10:00:00Z'::timestamptz)`,
        [raceUnit, user.id],
      );
      await c.query("commit");
      return "won";
    } catch (e) {
      await c.query("rollback").catch(() => {});
      return `lost: ${e.message.split("\n")[0]}`;
    }
  };

  const [ra, rb] = await Promise.all([attempt(a), attempt(b)]);
  const winners = [ra, rb].filter((r) => r === "won").length;

  const verify = new Client(CONN);
  await verify.connect();
  const held = (await verify.query(
    `select count(*)::int as n from unit_reservations
      where unit_id = $1 and starts_at = '2026-12-05T09:00:00Z'::timestamptz and status in ('pending','confirmed')`,
    [raceUnit],
  )).rows[0];

  check(winners === 1, `exactly one of two concurrent reservations won (${ra} / ${rb})`);
  check(held.n === 1, `exactly one row holds the slot (${held.n})`);

  await a.end();
  await b.end();
  await verify.end();

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
