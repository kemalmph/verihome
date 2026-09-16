#!/usr/bin/env node
/**
 * Reconstructs ledger entries from bookings, viewings and consultations that
 * predate the ledger.
 *
 * Deliberately conservative: it posts only what the existing rows state
 * unambiguously, and reports anything it cannot classify rather than guessing.
 * A wrong ledger entry is worse than a missing one — a missing one is visible
 * as an integrity failure, a wrong one quietly corrupts every report built on
 * top of it.
 *
 * Idempotent: a record that already has entries is skipped, so it is safe to
 * re-run after fixing whatever it flagged.
 *
 *   node scripts/backfill-ledger.js          # report only, writes nothing
 *   node scripts/backfill-ledger.js --commit # actually post
 */

const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

// .env.local is not loaded automatically outside Next.
const envPath = path.join(__dirname, "..", ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const COMMIT = process.argv.includes("--commit");
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const n = (v) => Math.round(Number(v ?? 0));
const unclassified = [];
const planned = [];

function plan(label, entries) {
  const debits = entries.filter((e) => e.direction === "debit").reduce((s, e) => s + e.amount, 0);
  const credits = entries.filter((e) => e.direction === "credit").reduce((s, e) => s + e.amount, 0);
  if (debits !== credits) {
    unclassified.push({ record: label, reason: `would not balance: ${debits} vs ${credits}` });
    return;
  }
  if (debits === 0) return;
  planned.push({ label, entries });
}

async function alreadyPosted(column, id) {
  const { data } = await admin.from("ledger_entries").select("id").eq(column, id).limit(1);
  return Boolean(data && data.length);
}

async function backfillBookings() {
  const { data: bookings, error } = await admin
    .from("bookings")
    .select(`id, booking_code, property_id, user_id, status, payment_status,
             total_price, cleaning_fee, security_deposit, credit_applied, confirmed_at,
             property:properties ( owner_id, platform_commission_pct, cleaning_fee_goes_to )`);
  if (error) throw new Error(`bookings: ${error.message}`);

  for (const b of bookings ?? []) {
    if (await alreadyPosted("booking_id", b.id)) continue;

    const stayDue = n(b.total_price) - n(b.credit_applied);
    const deposit = n(b.security_deposit);
    const label = `booking ${b.booking_code}`;

    // Only bookings whose cash demonstrably arrived get a cash entry.
    if (b.payment_status !== "paid") {
      if (["completed", "confirmed"].includes(b.status)) {
        unclassified.push({
          record: label,
          reason: `status=${b.status} but payment_status=${b.payment_status} — cannot tell whether cash was received`,
        });
      }
      continue;
    }

    const base = { event_type: "booking_payment_received", booking_id: b.id,
                   property_id: b.property_id, user_id: b.user_id };
    const received = [{ ...base, account: "cash", direction: "debit", amount: stayDue + deposit,
                        description: `Backfill: payment for ${b.booking_code}` }];
    if (stayDue > 0) received.push({ ...base, account: "unearned_revenue", direction: "credit", amount: stayDue, description: "Backfill: stay not yet delivered" });
    if (deposit > 0) received.push({ ...base, account: "deposits_held", direction: "credit", amount: deposit, description: "Backfill: security deposit" });
    plan(`${label} — payment`, received);

    // A completed stay has also been delivered, so recognise the revenue.
    if (b.status === "completed" && stayDue > 0) {
      const prop = b.property ?? {};
      const cleaning = Math.min(n(b.cleaning_fee), stayDue);
      const rent = stayDue - cleaning;
      const pct = prop.platform_commission_pct;
      const hasRate = pct !== null && pct !== undefined && Number.isFinite(Number(pct));

      const eb = { event_type: "booking_revenue_earned", booking_id: b.id,
                   property_id: b.property_id, user_id: b.user_id, owner_id: prop.owner_id ?? null };
      const earned = [{ ...eb, account: "unearned_revenue", direction: "debit", amount: stayDue,
                        description: `Backfill: ${b.booking_code} delivered` }];

      if (cleaning > 0) {
        earned.push(prop.cleaning_fee_goes_to === "owner"
          ? { ...eb, account: "owner_payable", direction: "credit", amount: cleaning, description: "Backfill: cleaning to owner" }
          : { ...eb, account: "revenue_cleaning", direction: "credit", amount: cleaning, description: "Backfill: cleaning fee" });
      }
      if (rent > 0) {
        if (!hasRate) {
          unclassified.push({ record: label, reason: "completed stay but property has no platform_commission_pct — full rent posted to owner_payable, split pending" });
          earned.push({ ...eb, account: "owner_payable", direction: "credit", amount: rent, description: "Backfill: no commission rate — full rent to owner" });
        } else {
          const margin = Math.round((rent * Number(pct)) / 100);
          const owner = rent - margin;
          if (margin > 0) earned.push({ ...eb, account: "revenue_booking_margin", direction: "credit", amount: margin, description: `Backfill: margin at ${Number(pct)}%` });
          if (owner > 0)  earned.push({ ...eb, account: "owner_payable", direction: "credit", amount: owner, description: "Backfill: owner share" });
        }
      }
      plan(`${label} — delivered`, earned);
    }
  }
}

async function backfillViewings() {
  const { data: viewings, error } = await admin
    .from("viewings")
    .select("id, property_id, user_id, status, deposit_amount, deposit_paid, deposit_refunded, attended, credit_issued");
  if (error) throw new Error(`viewings: ${error.message}`);

  for (const v of viewings ?? []) {
    if (await alreadyPosted("viewing_id", v.id)) continue;
    const amt = n(v.deposit_amount);
    const label = `viewing ${v.id.slice(0, 8)}`;
    if (!v.deposit_paid || amt <= 0) continue;

    const base = { viewing_id: v.id, property_id: v.property_id, user_id: v.user_id };
    plan(`${label} — deposit`, [
      { ...base, event_type: "viewing_deposit_received", account: "cash", direction: "debit", amount: amt, description: "Backfill: viewing deposit" },
      { ...base, event_type: "viewing_deposit_received", account: "deposits_held", direction: "credit", amount: amt, description: "Backfill: refundable deposit" },
    ]);

    // Exactly one outcome should apply. More than one means the row is
    // inconsistent and a human has to decide.
    const outcomes = [v.credit_issued && "credit", v.status === "no_show" && "forfeit", v.deposit_refunded && "refund"].filter(Boolean);
    if (outcomes.length > 1) {
      unclassified.push({ record: label, reason: `conflicting outcomes: ${outcomes.join(", ")}` });
      continue;
    }
    if (outcomes[0] === "credit") {
      plan(`${label} — credit`, [
        { ...base, event_type: "viewing_deposit_converted_to_credit", account: "deposits_held", direction: "debit", amount: amt, description: "Backfill: converted on attendance" },
        { ...base, event_type: "viewing_deposit_converted_to_credit", account: "credits_outstanding", direction: "credit", amount: amt, description: "Backfill: credit issued" },
      ]);
    } else if (outcomes[0] === "forfeit") {
      plan(`${label} — forfeit`, [
        { ...base, event_type: "viewing_deposit_forfeited", account: "deposits_held", direction: "debit", amount: amt, description: "Backfill: no-show" },
        { ...base, event_type: "viewing_deposit_forfeited", account: "revenue_forfeited_deposit", direction: "credit", amount: amt, description: "Backfill: forfeited" },
      ]);
    } else if (outcomes[0] === "refund") {
      plan(`${label} — refund`, [
        { ...base, event_type: "viewing_deposit_refunded", account: "deposits_held", direction: "debit", amount: amt, description: "Backfill: refunded" },
        { ...base, event_type: "viewing_deposit_refunded", account: "cash", direction: "credit", amount: amt, description: "Backfill: refund paid" },
      ]);
    }
  }
}

async function backfillConsultations() {
  const { data: rows, error } = await admin
    .from("consultations")
    .select("id, user_id, status, price, final_price, credit_applied, payment_status");
  if (error) throw new Error(`consultations: ${error.message}`);

  for (const c of rows ?? []) {
    if (await alreadyPosted("consultation_id", c.id)) continue;
    const amt = n(c.final_price ?? c.price) - n(c.credit_applied);
    const label = `consultation ${c.id.slice(0, 8)}`;
    if (amt <= 0) continue;

    const paid = c.status === "paid" || c.status === "completed" || c.payment_status === "paid";
    if (!paid) continue;

    const base = { consultation_id: c.id, user_id: c.user_id };
    plan(`${label} — payment`, [
      { ...base, event_type: "consultation_payment_received", account: "cash", direction: "debit", amount: amt, description: "Backfill: consultation payment" },
      { ...base, event_type: "consultation_payment_received", account: "unearned_revenue", direction: "credit", amount: amt, description: "Backfill: session not yet delivered" },
    ]);

    if (c.status === "completed") {
      plan(`${label} — delivered`, [
        { ...base, event_type: "consultation_revenue_earned", account: "unearned_revenue", direction: "debit", amount: amt, description: "Backfill: session delivered" },
        { ...base, event_type: "consultation_revenue_earned", account: "revenue_consultation", direction: "credit", amount: amt, description: "Backfill: consultation fee" },
      ]);
    }
  }
}

async function backfillCredits() {
  // Credits issued without a viewing (manual adjustments) have no deposit
  // behind them, so they are a liability that arrived from nowhere. Flag
  // rather than invent an offsetting entry.
  const { data: credits } = await admin
    .from("user_credits")
    .select("id, user_id, amount, viewing_id, redeemed_at, booking_id, expires_at");

  for (const c of credits ?? []) {
    if (!c.viewing_id) {
      unclassified.push({
        record: `credit ${c.id.slice(0, 8)}`,
        reason: `credit of ${n(c.amount)} with no viewing_id — origin unknown, no offsetting entry can be derived`,
      });
    }
  }
}

(async () => {
  console.log(COMMIT ? "BACKFILL — committing\n" : "BACKFILL — dry run, writing nothing (use --commit)\n");

  await backfillBookings();
  await backfillViewings();
  await backfillConsultations();
  await backfillCredits();

  console.log(`Planned ${planned.length} balanced event(s):`);
  for (const p of planned) {
    const total = p.entries.filter((e) => e.direction === "debit").reduce((s, e) => s + e.amount, 0);
    console.log(`  ${p.label.padEnd(44)} IDR ${total.toLocaleString("id-ID")}`);
  }

  let posted = 0, entryCount = 0;
  if (COMMIT) {
    for (const p of planned) {
      const { error } = await admin.rpc("post_ledger_entries", { p_entries: p.entries });
      if (error) {
        unclassified.push({ record: p.label, reason: `post failed: ${error.message}` });
      } else {
        posted++;
        entryCount += p.entries.length;
      }
    }
    console.log(`\nPosted ${posted} event(s), ${entryCount} ledger entries.`);
  }

  if (unclassified.length) {
    console.log(`\n${unclassified.length} record(s) could not be classified:`);
    for (const u of unclassified) console.log(`  ${u.record}: ${u.reason}`);
  } else {
    console.log("\nNo unclassified records.");
  }

  const { data: balances } = await admin.rpc("ledger_balances", { p_from: null, p_to: null });
  if (balances?.length) {
    console.log("\nLedger balances now:");
    for (const b of balances) {
      console.log(`  ${b.account.padEnd(26)} ${b.kind.padEnd(10)} ${Number(b.balance).toLocaleString("id-ID").padStart(14)}`);
    }
  }
})().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });
