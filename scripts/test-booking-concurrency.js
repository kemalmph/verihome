/**
 * Concurrency test for create_booking_if_available RPC.
 *
 * What it tests: two connections calling the RPC with identical dates
 * simultaneously. The FOR UPDATE lock should serialise them so exactly
 * one booking is created and the other gets the 'dates_unavailable' error.
 *
 * Run 10 times to catch intermittent failures.
 *
 * Usage:
 *   DATABASE_URL="postgresql://postgres:[password]@db.hxktoewssuahtkrksbpx.supabase.co:5432/postgres" \
 *   node scripts/test-booking-concurrency.js
 *
 * Get the password from:
 *   Supabase Dashboard → Settings → Database → Connection string
 *   Use the "URI" tab — copy the password from there.
 *   Do NOT use the Supabase pooler URL (port 6543) — transaction-mode
 *   pgbouncer can interfere with FOR UPDATE behaviour.
 */

import pg from "pg";
import { v4 as uuidv4 } from "uuid";

const { Pool } = pg;

// Real auth.users row — needed to satisfy bookings.user_id FK
const TEST_USER_ID = "208b897e-5093-4699-a122-95662c51b839";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("ERROR: DATABASE_URL is not set.");
  console.error("Get it from: Supabase Dashboard → Settings → Database → URI (port 5432, not 6543)");
  process.exit(1);
}

// Each run uses its own pool so connections are truly independent
function makePool() {
  return new Pool({
    connectionString: DATABASE_URL,
    max: 3, // seed_client + two racing connections
    idleTimeoutMillis: 5000,
  });
}

// ── Seed helpers ─────────────────────────────────────────────

async function seed(client) {
  const propertyId = uuidv4();

  await client.query(`
    INSERT INTO properties (id, name, slug, area, rental_mode, status, created_at, updated_at)
    VALUES ($1, 'Concurrency Test Property', $2, 'test', 'short_stay', 'draft', now(), now())
  `, [propertyId, `concurrency-test-${propertyId.slice(0,8)}`]);

  await client.query(`
    INSERT INTO short_stay_rates
      (property_id, price_per_night, min_nights, cleaning_fee, active, buffer_days,
       security_deposit, check_in_time, check_out_time)
    VALUES ($1, 500000, 1, 0, true, 0, 0, '14:00', '12:00')
  `, [propertyId]);

  return { propertyId, userId: TEST_USER_ID };
}

async function cleanup(client, propertyId) {
  await client.query(`DELETE FROM availability_blocks WHERE property_id = $1`, [propertyId]);
  await client.query(`DELETE FROM bookings WHERE property_id = $1`, [propertyId]);
  await client.query(`DELETE FROM short_stay_rates WHERE property_id = $1`, [propertyId]);
  await client.query(`DELETE FROM properties WHERE id = $1`, [propertyId]);
}

// ── RPC call ──────────────────────────────────────────────────

async function callRPC(client, propertyId, userId, label) {
  const checkIn  = "2099-06-01"; // far future to avoid real data collisions
  const checkOut = "2099-06-04";
  const t0 = Date.now();

  try {
    const res = await client.query(`
      SELECT * FROM create_booking_if_available(
        $1::uuid, $2::uuid,
        $3::date, $4::date,
        2,        -- guests
        500000,   -- price_per_night
        0,        -- cleaning_fee
        1500000,  -- total_price
        '999'     -- transfer_code
      )
    `, [propertyId, userId, checkIn, checkOut]);

    const elapsed = Date.now() - t0;
    const bookingId = res.rows[0]?.id ?? null;
    console.log(`    [${label}] ✓ booking created  id=${bookingId}  +${elapsed}ms`);
    return { success: true, bookingId };
  } catch (err) {
    const elapsed = Date.now() - t0;
    const isDatesUnavailable = err.message?.includes("dates_unavailable");
    console.log(`    [${label}] ${isDatesUnavailable ? "✗ dates_unavailable (expected)" : "✗ unexpected error: " + err.message}  +${elapsed}ms`);
    return { success: false, isDatesUnavailable, err };
  }
}

// ── Single run ────────────────────────────────────────────────

async function runOnce(runNum) {
  const pool = makePool();
  const c1   = await pool.connect();
  const c2   = await pool.connect();
  const seed_client = await pool.connect();

  let propertyId;

  try {
    const seeded = await seed(seed_client);
    propertyId        = seeded.propertyId;
    const { userId }  = seeded;

    console.log(`  Run ${runNum}: property=${propertyId.slice(0,8)} check_in=2099-06-01 check_out=2099-06-04`);

    // Fire both simultaneously — c1 and c2 are distinct connections
    const t0 = Date.now();
    const [r1, r2] = await Promise.all([
      callRPC(c1, propertyId, userId, "conn-1"),
      callRPC(c2, propertyId, userId, "conn-2"),
    ]);
    const elapsed = Date.now() - t0;

    // Assertions
    const successes = [r1, r2].filter(r => r.success).length;
    const failures  = [r1, r2].filter(r => !r.success);
    const unexpectedErrors = failures.filter(r => !r.isDatesUnavailable);

    // Verify DB state
    const { rows: blocks   } = await seed_client.query(
      `SELECT count(*) FROM availability_blocks WHERE property_id = $1`, [propertyId]
    );
    const { rows: bookings } = await seed_client.query(
      `SELECT count(*) FROM bookings WHERE property_id = $1`, [propertyId]
    );
    const blockCount   = Number(blocks[0].count);
    const bookingCount = Number(bookings[0].count);

    const pass =
      successes === 1 &&
      unexpectedErrors.length === 0 &&
      blockCount === 1 &&
      bookingCount === 1;

    console.log(`    DB: ${bookingCount} booking, ${blockCount} block  total=${elapsed}ms  → ${pass ? "PASS" : "FAIL"}`);
    if (!pass) {
      console.log(`    FAIL detail: successes=${successes}, blockCount=${blockCount}, bookingCount=${bookingCount}`);
      if (unexpectedErrors.length) console.log(`    Unexpected errors:`, unexpectedErrors.map(r => r.err.message));
    }

    return pass;
  } finally {
    if (propertyId) {
      try { await cleanup(seed_client, propertyId); } catch {}
    }
    c1.release();
    c2.release();
    seed_client.release();
    await pool.end();
  }
}

// ── Main: 10 runs ─────────────────────────────────────────────

async function main() {
  console.log("=== Booking concurrency test (10 runs) ===");
  console.log("Each run fires two identical RPCs on separate connections simultaneously.\n");

  const results = [];
  for (let i = 1; i <= 10; i++) {
    const pass = await runOnce(i);
    results.push(pass);
  }

  const passed = results.filter(Boolean).length;
  console.log(`\n=== Result: ${passed}/10 passed ===`);
  if (passed < 10) {
    console.log("FAIL — the FOR UPDATE lock did not reliably prevent double-booking.");
    process.exit(1);
  } else {
    console.log("PASS — atomic RPC correctly serialised all concurrent requests.");
  }
}

main().catch(err => {
  console.error("Fatal:", err);
  process.exit(1);
});
