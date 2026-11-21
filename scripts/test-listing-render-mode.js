#!/usr/bin/env node
/**
 * The public listing route must not depend on what the database held at build
 * time.
 *
 * It used to. With `revalidate = 60` and a `generateStaticParams`, a build
 * that saw live listings produced a dynamic route that worked, and a build
 * that saw none produced a static route that returned 500 on every listing
 * page — including a 500 where a 404 belonged. Same source, same deploy
 * command, two different products.
 *
 * So the thing to test is not "a listing page loads". It is that the route
 * behaves the same across both builds. This script checks the half it can see
 * from a running server; the other half is the caller's job:
 *
 *   # build with no live listings, then:
 *   node scripts/test-listing-render-mode.js
 *   # build with a live listing present, then run it again.
 *
 * Both runs must pass. Before the fix, the first one failed.
 */
const { Client } = require("pg");

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3000";

const pass = [];
const fail = [];
const check = (ok, what) => (ok ? pass : fail).push(what);

const get = async (path) => {
  const res = await fetch(`${BASE}${path}`, { redirect: "manual" });
  return { status: res.status, body: await res.text() };
};

(async () => {
  const db = new Client({ host: "127.0.0.1", port: 54322, user: "postgres", password: "postgres", database: "postgres" });
  await db.connect();
  const q = async (sql, args = []) => (await db.query(sql, args)).rows;

  // A live listing created *now*, after whatever build is being served. This
  // is the case that broke: a listing published after the last deploy.
  const owner = (await q(
    `insert into owners (name, email, phone_whatsapp)
     values ('Render Owner', 'render@example.invalid', '+620000000010') returning id`,
  ))[0];
  await q(
    `insert into properties (name, slug, area, property_type, price_monthly, bedrooms, bathrooms, address, status, owner_id)
     values ('Render Probe', 'render-probe', 'Kemang', 'house', 7500000, 2, 1, 'Jl. Render 1', 'live', $1)`,
    [owner.id],
  );

  const live = await get("/listings/render-probe");
  check(live.status === 200, `a listing published after the build renders (${live.status})`);
  check(/Render Probe/.test(live.body), "…and it is that listing, not a cached stranger");

  const missing = await get("/listings/no-such-listing-anywhere");
  check(missing.status === 404, `an unknown slug is 404, not 500 (${missing.status})`);

  // A draft must not be reachable just because the route is dynamic now.
  await q("update properties set status = 'draft' where slug = 'render-probe'");
  const draft = await get("/listings/render-probe");
  check(draft.status === 404, `a draft listing is 404, not served (${draft.status})`);

  await q("delete from properties where slug = 'render-probe'");
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
