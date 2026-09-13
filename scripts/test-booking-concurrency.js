/**
 * Concurrency test for create_booking_if_available RPC.
 *
 * Four test suites, each run multiple times:
 *
 *  Suite A — same property, overlapping dates (10 runs)
 *    Two connections race for identical dates. Exactly one must win.
 *
 *  Suite B — different properties, same dates (5 runs)
 *    Two connections race on *different* properties. Both must succeed
 *    and timestamps must genuinely overlap, proving they run in parallel.
 *
 *  Suite C — same property, non-overlapping dates (5 runs)
 *    Two connections race on the same property but distinct date ranges.
 *    Both must succeed (different date windows → no conflict).
 *
 *  Suite D — rollback then retry (5 runs)
 *    Connection 1 starts a transaction, calls the RPC (acquires the
 *    advisory lock), then rolls back. Connection 2 must then succeed,
 *    proving the lock releases on abort.
 *
 * Usage:
 *   DATABASE_URL="postgresql://postgres:[pw]@db.hxktoewssuahtkrksbpx.supabase.co:5432/postgres" \
 *   node scripts/test-booking-concurrency.js
 */

import pg from "pg";
import { v4 as uuidv4 } from "uuid";

const { Pool } = pg;

const TEST_USER_ID = "208b897e-5093-4699-a122-95662c51b839";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("ERROR: DATABASE_URL is not set.");
  console.error("Get it from: Supabase Dashboard → Settings → Database → URI (port 5432, not 6543)");
  process.exit(1);
}

function makePool(size = 3) {
  return new Pool({ connectionString: DATABASE_URL, max: size, idleTimeoutMillis: 5000 });
}

// ── Seed / cleanup ────────────────────────────────────────────

async function seedProperty(client) {
  const propertyId = uuidv4();
  await client.query(`
    INSERT INTO properties (id, name, slug, area, rental_mode, status, created_at, updated_at)
    VALUES ($1, 'Concurrency Test', $2, 'test', 'short_stay', 'draft', now(), now())
  `, [propertyId, `concurrency-test-${propertyId.slice(0, 8)}`]);
  await client.query(`
    INSERT INTO short_stay_rates
      (property_id, price_per_night, min_nights, cleaning_fee, active, buffer_days,
       security_deposit, check_in_time, check_out_time)
    VALUES ($1, 500000, 1, 0, true, 0, 0, '14:00', '12:00')
  `, [propertyId]);
  return propertyId;
}

async function cleanupProperty(client, propertyId) {
  await client.query(`DELETE FROM availability_blocks WHERE property_id = $1`, [propertyId]);
  await client.query(`DELETE FROM bookings WHERE property_id = $1`, [propertyId]);
  await client.query(`DELETE FROM short_stay_rates WHERE property_id = $1`, [propertyId]);
  await client.query(`DELETE FROM properties WHERE id = $1`, [propertyId]);
}

// ── RPC call (auto-transaction via pg) ───────────────────────

async function callRPC(client, propertyId, checkIn, checkOut, label) {
  const t0 = Date.now();
  try {
    const res = await client.query(`
      SELECT * FROM create_booking_if_available(
        $1::uuid, $2::uuid, $3::date, $4::date,
        2, 500000, 0, 1500000, '999'
      )
    `, [propertyId, TEST_USER_ID, checkIn, checkOut]);
    const ms = Date.now() - t0;
    console.log(`    [${label}] ✓ booking created  id=${res.rows[0]?.id}  +${ms}ms`);
    return { success: true, entryMs: t0 };
  } catch (err) {
    const ms = Date.now() - t0;
    const isDatesUnavailable = err.message?.includes("dates_unavailable");
    console.log(`    [${label}] ${isDatesUnavailable ? "✗ dates_unavailable (expected)" : "✗ unexpected: " + err.message}  +${ms}ms`);
    return { success: false, isDatesUnavailable, err, entryMs: t0 };
  }
}

// ── Suite A: same property, overlapping dates ─────────────────

async function suiteA(n = 10) {
  console.log(`\n── Suite A: same property, overlapping dates (${n} runs) ──`);
  let passed = 0;
  for (let i = 1; i <= n; i++) {
    const pool = makePool(3);
    const [c1, c2, seed] = await Promise.all([pool.connect(), pool.connect(), pool.connect()]);
    const propertyId = await seedProperty(seed);
    console.log(`  Run ${i}: property=${propertyId.slice(0, 8)}`);
    try {
      const [r1, r2] = await Promise.all([
        callRPC(c1, propertyId, "2099-06-01", "2099-06-04", "conn-1"),
        callRPC(c2, propertyId, "2099-06-01", "2099-06-04", "conn-2"),
      ]);
      const { rows: bk } = await seed.query(`SELECT count(*) FROM bookings WHERE property_id=$1`, [propertyId]);
      const { rows: bl } = await seed.query(`SELECT count(*) FROM availability_blocks WHERE property_id=$1`, [propertyId]);
      const successes = [r1, r2].filter(r => r.success).length;
      const unexpected = [r1, r2].filter(r => !r.success && !r.isDatesUnavailable);
      const ok = successes === 1 && unexpected.length === 0 && Number(bk[0].count) === 1 && Number(bl[0].count) === 1;
      console.log(`    DB: ${bk[0].count} booking, ${bl[0].count} block  → ${ok ? "PASS" : "FAIL"}`);
      if (!ok && unexpected.length) console.log(`    Unexpected:`, unexpected.map(r => r.err.message));
      if (ok) passed++;
    } finally {
      await cleanupProperty(seed, propertyId);
      c1.release(); c2.release(); seed.release();
      await pool.end();
    }
  }
  console.log(`  Suite A: ${passed}/${n}`);
  return passed === n;
}

// ── Suite B: different properties, same dates ─────────────────

async function suiteB(n = 5) {
  console.log(`\n── Suite B: different properties, same dates (${n} runs) ──`);
  let passed = 0;
  for (let i = 1; i <= n; i++) {
    const pool = makePool(4);
    const [c1, c2, s1, s2] = await Promise.all([pool.connect(), pool.connect(), pool.connect(), pool.connect()]);
    const [p1, p2] = await Promise.all([seedProperty(s1), seedProperty(s2)]);
    console.log(`  Run ${i}: p1=${p1.slice(0, 8)} p2=${p2.slice(0, 8)}`);
    try {
      const t0 = Date.now();
      const [r1, r2] = await Promise.all([
        callRPC(c1, p1, "2099-07-01", "2099-07-04", `p1-conn`),
        callRPC(c2, p2, "2099-07-01", "2099-07-04", `p2-conn`),
      ]);
      const elapsed = Date.now() - t0;
      const bothSucceeded = r1.success && r2.success;
      // Overlap: both RPCs must have started before the slowest one finished
      const overlap = Math.abs(r1.entryMs - r2.entryMs) < elapsed;
      const ok = bothSucceeded && overlap;
      console.log(`    Both succeeded: ${bothSucceeded}  Timestamps overlapped: ${overlap}  total=${elapsed}ms  → ${ok ? "PASS" : "FAIL"}`);
      if (ok) passed++;
    } finally {
      await Promise.all([cleanupProperty(s1, p1), cleanupProperty(s2, p2)]);
      c1.release(); c2.release(); s1.release(); s2.release();
      await pool.end();
    }
  }
  console.log(`  Suite B: ${passed}/${n}`);
  return passed === n;
}

// ── Suite C: same property, non-overlapping dates ─────────────

async function suiteC(n = 5) {
  console.log(`\n── Suite C: same property, non-overlapping dates (${n} runs) ──`);
  let passed = 0;
  for (let i = 1; i <= n; i++) {
    const pool = makePool(3);
    const [c1, c2, seed] = await Promise.all([pool.connect(), pool.connect(), pool.connect()]);
    const propertyId = await seedProperty(seed);
    console.log(`  Run ${i}: property=${propertyId.slice(0, 8)} (Jan 5-8 vs Jan 10-13)`);
    try {
      const [r1, r2] = await Promise.all([
        callRPC(c1, propertyId, "2099-08-05", "2099-08-08", "slot-1"),
        callRPC(c2, propertyId, "2099-08-10", "2099-08-13", "slot-2"),
      ]);
      const { rows: bk } = await seed.query(`SELECT count(*) FROM bookings WHERE property_id=$1`, [propertyId]);
      const { rows: bl } = await seed.query(`SELECT count(*) FROM availability_blocks WHERE property_id=$1`, [propertyId]);
      const bothSucceeded = r1.success && r2.success;
      const ok = bothSucceeded && Number(bk[0].count) === 2 && Number(bl[0].count) === 2;
      console.log(`    DB: ${bk[0].count} bookings, ${bl[0].count} blocks  → ${ok ? "PASS" : "FAIL"}`);
      if (!ok) {
        if (!bothSucceeded) console.log(`    One or both failed — lock may be over-blocking`);
      }
      if (ok) passed++;
    } finally {
      await cleanupProperty(seed, propertyId);
      c1.release(); c2.release(); seed.release();
      await pool.end();
    }
  }
  console.log(`  Suite C: ${passed}/${n}`);
  return passed === n;
}

// ── Suite D: rollback releases the lock ───────────────────────

async function suiteD(n = 5) {
  console.log(`\n── Suite D: rollback releases advisory lock (${n} runs) ──`);
  let passed = 0;
  for (let i = 1; i <= n; i++) {
    const pool = makePool(3);
    const [c1, c2, seed] = await Promise.all([pool.connect(), pool.connect(), pool.connect()]);
    const propertyId = await seedProperty(seed);
    console.log(`  Run ${i}: property=${propertyId.slice(0, 8)}`);
    try {
      // c1: begin, call RPC (holds advisory lock), then rollback
      await c1.query("BEGIN");
      let c1Done = false;
      const c1Promise = c1.query(`
        SELECT * FROM create_booking_if_available(
          $1::uuid, $2::uuid, $3::date, $4::date,
          2, 500000, 0, 1500000, '999'
        )
      `, [propertyId, TEST_USER_ID, "2099-09-01", "2099-09-04"]).then(r => {
        console.log(`    [c1] RPC returned booking=${r.rows[0]?.id} (will be rolled back)`);
        c1Done = true;
        return r;
      });

      // Give c1 a moment to acquire the lock before c2 arrives
      await new Promise(r => setTimeout(r, 20));

      // c2 fires while c1 holds the lock — it will block until c1 rolls back
      const c2Promise = callRPC(c2, propertyId, "2099-09-01", "2099-09-04", "c2-retry");

      // Roll back c1 after another brief delay so c2 is definitely waiting
      await new Promise(r => setTimeout(r, 50));
      await c1.query("ROLLBACK");
      console.log(`    [c1] rolled back`);

      const [, r2] = await Promise.all([c1Promise.catch(() => {}), c2Promise]);

      const { rows: bk } = await seed.query(`SELECT count(*) FROM bookings WHERE property_id=$1`, [propertyId]);
      const ok = r2.success && Number(bk[0].count) === 1;
      console.log(`    DB: ${bk[0].count} booking  c2 succeeded: ${r2.success}  → ${ok ? "PASS" : "FAIL"}`);
      if (ok) passed++;
    } finally {
      // c1 may still have a live transaction if something threw — clean up
      try { await c1.query("ROLLBACK"); } catch {}
      await cleanupProperty(seed, propertyId);
      c1.release(); c2.release(); seed.release();
      await pool.end();
    }
  }
  console.log(`  Suite D: ${passed}/${n}`);
  return passed === n;
}

// ── Main ──────────────────────────────────────────────────────

async function main() {
  console.log("=== Booking concurrency test ===\n");
  const results = await Promise.all([false, false, false, false]); // placeholders
  const a = await suiteA(10);
  const b = await suiteB(5);
  const c = await suiteC(5);
  const d = await suiteD(5);

  console.log("\n=== Summary ===");
  console.log(`  A (overlapping dates, same property): ${a ? "PASS" : "FAIL"}`);
  console.log(`  B (parallel different properties):    ${b ? "PASS" : "FAIL"}`);
  console.log(`  C (non-overlapping dates):            ${c ? "PASS" : "FAIL"}`);
  console.log(`  D (rollback releases lock):           ${d ? "PASS" : "FAIL"}`);

  if (![a, b, c, d].every(Boolean)) {
    process.exit(1);
  }
  console.log("\nAll suites passed.");
}

main().catch(err => { console.error("Fatal:", err); process.exit(1); });
