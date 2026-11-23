#!/usr/bin/env node
/**
 * Membership fees in the ledger, recognised per MEMBERSHIP month.
 *
 * The owner decided: a membership month, not a calendar month. The two
 * disagree by real money at every period end, so this checks the boundaries
 * themselves and not only that something was posted.
 *
 * What it is actually hunting:
 *
 *   - periods anchored to the start date, including the 31st, which a
 *     month-by-month walk drifts off and never returns to
 *   - a yearly fee whose twelve slices sum to EXACTLY the fee: twelve
 *     roundings of price/12 leave a rupiah stranded in unearned_revenue
 *     forever, and nothing else in the system would ever notice
 *   - unearned_revenue netting to zero once every month is served, which is
 *     the only end-to-end proof that the two-step posting is coherent
 *   - posting twice being impossible rather than merely discouraged
 *
 *   npx supabase migration up --local
 *   node scripts/test-membership-ledger.js
 */
const { Client } = require("pg");

const pass = [];
const fail = [];
const check = (ok, what) => (ok ? pass : fail).push(what);

const DB = {
  host: "127.0.0.1", port: 54322,
  user: "postgres", password: "postgres", database: "postgres",
};

const code = (p) => `${p}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

(async () => {
  const db = new Client(DB);
  await db.connect();
  const q = async (sql, args = []) => (await db.query(sql, args)).rows;

  const [site] = await q(
    `insert into sites (name, slug, area, address, site_type)
     values ('Uji Membership', $1, 'Kemang', 'Jl. Uji 1', 'coworking')
     returning id`,
    [code("uji-membership").toLowerCase()],
  );

  /** A membership plus its generated schedule. */
  async function makeMembership({ starts, ends, price, period }) {
    const [m] = await q(
      `insert into memberships
         (membership_code, site_id, member_name, starts_on, ends_on, price, period)
       values ($1, $2, 'Uji Anggota', $3, $4, $5, $6)
       returning id, membership_code`,
      [code("MB"), site.id, starts, ends, price, period],
    );
    await q(`select generate_membership_periods($1)`, [m.id]);
    const periods = await q(
      `select id, period_no, starts_on::text, ends_on::text, amount::text
         from membership_periods where membership_id = $1 order by period_no`,
      [m.id],
    );
    return { ...m, periods };
  }

  // ── 1. membership month, not calendar month ──────────────────────────────
  {
    const m = await makeMembership({
      starts: "2026-01-15", ends: "2027-01-14", price: 1200000, period: "yearly",
    });
    check(m.periods.length === 12, `mulai 15 Jan: 12 periode (${m.periods.length})`);
    check(
      m.periods[0].starts_on === "2026-01-15" && m.periods[0].ends_on === "2026-02-14",
      `periode 1 = 15 Jan – 14 Feb (${m.periods[0]?.starts_on} – ${m.periods[0]?.ends_on})`,
    );
    check(
      m.periods[1].starts_on === "2026-02-15" && m.periods[1].ends_on === "2026-03-14",
      `periode 2 = 15 Feb – 14 Mar (${m.periods[1]?.starts_on} – ${m.periods[1]?.ends_on})`,
    );
    check(
      m.periods[11].ends_on === "2027-01-14",
      `periode 12 berakhir 14 Jan 2027 (${m.periods[11]?.ends_on})`,
    );
    // The calendar-month reading would have put a boundary here instead.
    check(
      !m.periods.some((p) => p.starts_on.endsWith("-01")),
      "tidak ada periode yang mulai tanggal 1 — bukan bulan kalender",
    );
  }

  // ── 2. the 31st, which a month-by-month walk loses ───────────────────────
  {
    const m = await makeMembership({
      starts: "2026-01-31", ends: "2026-07-30", price: 600000, period: "yearly",
    });
    const starts = m.periods.map((p) => p.starts_on);
    check(
      starts[1] === "2026-02-28",
      `31 Jan + 1 bulan dijepit ke 28 Feb (${starts[1]})`,
    );
    check(
      starts[2] === "2026-03-31",
      `lalu KEMBALI ke tanggal 31, bukan hanyut di 28 (${starts[2]})`,
    );
    check(
      starts[3] === "2026-04-30" && starts[4] === "2026-05-31",
      `jepitan berikutnya juga benar (${starts[3]}, ${starts[4]})`,
    );
  }

  // ── 3. a yearly fee that does not divide ─────────────────────────────────
  //
  // 10.000.000 / 12 = 833.333,33. Twelve roundings leave four rupiah
  // unaccounted for; the running-total slicing does not.
  {
    const price = 10000000;
    const m = await makeMembership({
      starts: "2026-03-10", ends: "2027-03-09", price, period: "yearly",
    });
    const sum = m.periods.reduce((a, p) => a + Number(p.amount), 0);
    check(sum === price, `12 potongan berjumlah tepat ${price} (dapat ${sum})`);
    check(
      m.periods.every((p) => Number(p.amount) > 0),
      "tidak ada potongan bernilai nol",
    );
    const distinct = [...new Set(m.periods.map((p) => p.amount))];
    check(
      distinct.length <= 2,
      `selisih pembulatan tersebar tipis, bukan menumpuk (${distinct.join(", ")})`,
    );
  }

  // ── 4. a monthly fee ─────────────────────────────────────────────────────
  {
    const m = await makeMembership({
      starts: "2026-02-01", ends: "2026-05-31", price: 500000, period: "monthly",
    });
    check(m.periods.length === 4, `4 bulan (${m.periods.length})`);
    check(
      m.periods.every((p) => Number(p.amount) === 500000),
      "tiap bulan penuh ditagih harga bulanan, bukan dibagi",
    );
  }

  // ── 5. a term ending mid-month is prorated ───────────────────────────────
  {
    const m = await makeMembership({
      starts: "2026-02-01", ends: "2026-03-15", price: 600000, period: "monthly",
    });
    const last = m.periods[m.periods.length - 1];
    check(m.periods.length === 2, `2 periode, yang kedua pendek (${m.periods.length})`);
    check(
      last.starts_on === "2026-03-01" && last.ends_on === "2026-03-15",
      `sisa 1–15 Mar (${last?.starts_on} – ${last?.ends_on})`,
    );
    // 15 of 31 days.
    const want = Math.round((600000 * 15) / 31);
    check(
      Number(last.amount) === want,
      `sisa ditagih pro rata per hari: ${want} (dapat ${last?.amount})`,
    );
  }

  // ── 6. money in, then revenue — and nothing stranded ─────────────────────
  {
    const price = 10000000;
    const m = await makeMembership({
      starts: "2026-04-20", ends: "2027-04-19", price, period: "yearly",
    });

    const paid = await q(`select settle_membership_payment($1) as n`, [m.id]);
    check(Number(paid[0].n) === 12, `pelunasan di muka menutup 12 periode (${paid[0].n})`);

    const afterPay = await q(
      `select account, direction, sum(amount)::text as total
         from ledger_entries where membership_id = $1
        group by account, direction order by account`,
      [m.id],
    );
    const cash = afterPay.find((r) => r.account === "cash" && r.direction === "debit");
    const unearned = afterPay.find((r) => r.account === "unearned_revenue" && r.direction === "credit");
    check(Number(cash?.total) === price, `kas didebit ${price} (${cash?.total})`);
    check(Number(unearned?.total) === price, `pendapatan diterima di muka dikredit ${price} (${unearned?.total})`);
    check(
      !afterPay.some((r) => r.account === "revenue_membership"),
      "belum ada pendapatan diakui — bulannya belum dilayani",
    );

    // Serve every month.
    for (const p of m.periods) {
      await q(`select settle_membership_period_revenue($1)`, [p.id]);
    }

    const [net] = await q(
      `select
         coalesce(sum(amount) filter (where account = 'unearned_revenue' and direction = 'credit'), 0)
       - coalesce(sum(amount) filter (where account = 'unearned_revenue' and direction = 'debit'), 0)
         as unearned,
         coalesce(sum(amount) filter (where account = 'revenue_membership' and direction = 'credit'), 0)
         as revenue,
         coalesce(sum(amount) filter (where direction = 'debit'), 0)  as debits,
         coalesce(sum(amount) filter (where direction = 'credit'), 0) as credits
       from ledger_entries where membership_id = $1`,
      [m.id],
    );
    check(Number(net.unearned) === 0, `kewajiban habis setelah 12 bulan dilayani (sisa ${net.unearned})`);
    check(Number(net.revenue) === price, `pendapatan diakui tepat ${price} (${net.revenue})`);
    check(Number(net.debits) === Number(net.credits), `debit = kredit (${net.debits} vs ${net.credits})`);

    // ── posting twice is refused, not merely discouraged ───────────────────
    const again = await q(
      `select settle_membership_period_revenue($1)`, [m.periods[0].id],
    ).then(() => null).catch((e) => e.message);
    check(
      /already_recognised/.test(again ?? ""),
      `pengakuan kedua ditolak (${(again ?? "DITERIMA").slice(0, 40)})`,
    );

    const payAgain = await q(
      `select settle_membership_period_payment($1)`, [m.periods[0].id],
    ).then(() => null).catch((e) => e.message);
    check(
      /already_paid/.test(payAgain ?? ""),
      `pelunasan kedua ditolak (${(payAgain ?? "DITERIMA").slice(0, 40)})`,
    );
  }

  // ── 7. revenue cannot be earned on money never received ──────────────────
  {
    const m = await makeMembership({
      starts: "2026-06-01", ends: "2026-08-31", price: 300000, period: "monthly",
    });
    const err = await q(
      `select settle_membership_period_revenue($1)`, [m.periods[0].id],
    ).then(() => null).catch((e) => e.message);
    check(/not_paid/.test(err ?? ""), `pengakuan tanpa pelunasan ditolak (${(err ?? "DITERIMA").slice(0, 40)})`);

    // And the database refuses it even if a caller writes the column directly.
    const direct = await q(
      `update membership_periods set recognised_at = now() where id = $1`, [m.periods[0].id],
    ).then(() => null).catch((e) => e.message);
    check(
      /paid_before_earned/.test(direct ?? ""),
      `CHECK menolaknya juga lewat UPDATE langsung (${(direct ?? "DITERIMA").slice(0, 45)})`,
    );
  }

  // ── 8. the nightly job, in Jakarta time ──────────────────────────────────
  //
  // A month that ended yesterday in Jakarta must be recognised. current_date
  // on this server is UTC and names yesterday for the first seven hours of a
  // Jakarta day, so a naive version misses it all morning.
  {
    const [today] = await q(`select (now() at time zone 'Asia/Jakarta')::date::text as d`);
    const start = new Date(today.d);
    start.setDate(start.getDate() - 40);
    const iso = (d) => d.toISOString().slice(0, 10);
    const endYesterday = new Date(today.d);
    endYesterday.setDate(endYesterday.getDate() - 1);

    const m = await makeMembership({
      starts: iso(start), ends: iso(endYesterday), price: 400000, period: "monthly",
    });
    await q(`select settle_membership_payment($1)`, [m.id]);

    const [n] = await q(`select recognise_due_membership_periods() as n`);
    check(Number(n.n) >= 1, `pekerjaan malam mengakui periode yang sudah lewat (${n.n})`);

    const [left] = await q(
      `select count(*)::int as c from membership_periods
        where membership_id = $1 and recognised_at is null and ends_on < (now() at time zone 'Asia/Jakarta')::date`,
      [m.id],
    );
    check(left.c === 0, `tidak ada periode lewat yang tertinggal (${left.c})`);
  }

  // ── 9. the schedule is only built once ───────────────────────────────────
  {
    const m = await makeMembership({
      starts: "2026-09-01", ends: "2026-11-30", price: 100000, period: "monthly",
    });
    const [again] = await q(`select generate_membership_periods($1) as n`, [m.id]);
    check(Number(again.n) === 0, `membangun ulang jadwal tidak menambah baris (${again.n})`);
    const [count] = await q(
      `select count(*)::int as c from membership_periods where membership_id = $1`, [m.id],
    );
    check(count.c === 3, `tetap 3 periode (${count.c})`);
  }

  // ── 10. nothing client-side may post to the ledger ───────────────────────
  {
    const rows = await q(
      `select has_function_privilege('anon', p.oid, 'EXECUTE') as anon,
              has_function_privilege('authenticated', p.oid, 'EXECUTE') as auth,
              p.proname
         from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public'
          and p.proname in ('settle_membership_payment','settle_membership_period_payment',
                            'settle_membership_period_revenue','recognise_due_membership_periods',
                            'generate_membership_periods')`,
    );
    check(rows.length === 5, `kelima fungsi ada (${rows.length})`);
    for (const r of rows) {
      check(!r.anon && !r.auth, `${r.proname}: tidak bisa dipanggil anon/authenticated`);
    }
    const [tbl] = await q(
      `select has_table_privilege('anon', 'public.membership_periods', 'SELECT') as anon,
              has_table_privilege('authenticated', 'public.membership_periods', 'SELECT') as auth`,
    );
    check(!tbl.anon && !tbl.auth, "membership_periods tidak terbaca anon/authenticated");
  }

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
