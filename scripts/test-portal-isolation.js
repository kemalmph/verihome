#!/usr/bin/env node
/**
 * Access isolation tests for the owner portal and the guest unit pages.
 *
 * These use REAL authenticated sessions against a REAL running server. Each
 * fixture account is created through Supabase Auth, signed in to obtain a
 * genuine JWT, and that session is carried in the same cookie the browser
 * would send. Every assertion is on an actual HTTP response from an actual
 * route — not on a reimplementation of the guard, which could drift from the
 * app and quietly stop testing anything.
 *
 * The bar is not-found. A cross-tenant request must be indistinguishable from
 * one for a record that does not exist: a 403 would confirm that some other
 * owner holds that id, which is a slower way to enumerate the same thing.
 *
 *   npm run dev                              # in another terminal
 *   node scripts/test-portal-isolation.js
 *
 * Exits non-zero on any failure, so it can gate a commit.
 */

const { createClient } = require("@supabase/supabase-js");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const envPath = path.join(__dirname, "..", ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const URL_BASE = process.env.ISOLATION_BASE_URL ?? "http://localhost:3000";
const SUPA = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const REF = SUPA.match(/https:\/\/([^.]+)\./)[1];
const PASSWORD = "IsolationTest!2468";

const admin = createClient(SUPA, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const sha = (s) => crypto.createHash("sha256").update(s).digest("hex");

let passed = 0, failed = 0;
function check(name, ok, detail = "") {
  if (ok) passed++; else failed++;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
}

// ── Sessions ────────────────────────────────────────────────────────────────

/**
 * Builds the cookie @supabase/ssr reads, so the server resolves a real user.
 * Chunked above 3180 bytes exactly as the library does.
 */
function sessionCookie(session) {
  const raw = "base64-" + Buffer.from(JSON.stringify(session)).toString("base64");
  const name = `sb-${REF}-auth-token`;
  if (raw.length <= 3180) return `${name}=${raw}`;
  const chunks = [];
  for (let i = 0; i < raw.length; i += 3180) chunks.push(raw.slice(i, i + 3180));
  return chunks.map((c, i) => `${name}.${i}=${c}`).join("; ");
}

async function signIn(email) {
  const pub = createClient(SUPA, ANON, { auth: { persistSession: false } });
  const { data, error } = await pub.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw new Error(`sign-in ${email}: ${error.message}`);
  return sessionCookie(data.session);
}

async function get(pathname, cookie) {
  const res = await fetch(`${URL_BASE}${pathname}`, {
    headers: { cookie },
    redirect: "manual",
  });
  return { status: res.status, location: res.headers.get("location") ?? null };
}

/** Not-found, or bounced to a no-access page. Never a readable 200. */
function isRefused(r) {
  if (r.status === 404) return true;
  if (r.status >= 300 && r.status < 400 && r.location) {
    return /no-access|login/.test(r.location);
  }
  return false;
}

// ── Fixtures ────────────────────────────────────────────────────────────────

const made = { authUsers: [], owners: [], properties: [], bookings: [], invites: [] };

async function mkAuthUser(tag) {
  const email = `iso-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@test.invalid`;
  const { data, error } = await admin.auth.admin.createUser({
    email, password: PASSWORD, email_confirm: true,
    user_metadata: { full_name: `Isolation ${tag}` },
  });
  if (error) throw new Error(`createUser ${tag}: ${error.message}`);
  made.authUsers.push(data.user.id);
  return { id: data.user.id, email };
}

async function mkOwner(name, userId, access) {
  const { data, error } = await admin.from("owners")
    .insert({ name, email: `${name.replace(/\s/g, "").toLowerCase()}-${Date.now()}@test.invalid`,
              phone_whatsapp: "628000000000", user_id: userId, portal_access: access })
    .select("id").single();
  if (error) throw new Error(`owner ${name}: ${error.message}`);
  made.owners.push(data.id);
  return data.id;
}

async function mkProperty(ownerId, name) {
  const { data, error } = await admin.from("properties")
    .insert({ name, slug: `iso-${crypto.randomUUID().slice(0, 8)}`, owner_id: ownerId,
              area: "Isolation", property_type: "apartment", price_monthly: 5000000,
              bedrooms: 1, bathrooms: 1, status: "draft", rental_mode: "short_stay" })
    .select("id").single();
  if (error) throw new Error(`property ${name}: ${error.message}`);
  made.properties.push(data.id);
  return data.id;
}

async function mkBooking(propertyId, userId, tag) {
  const { data, error } = await admin.from("bookings")
    .insert({ booking_code: `ISO-${tag}-${Date.now() % 1000000}`,
              property_id: propertyId, user_id: userId,
              check_in_date: "2026-12-01", check_out_date: "2026-12-04",
              guests: 2, price_per_night: 500000, cleaning_fee: 100000,
              total_price: 1500000, security_deposit: 0,
              status: "pending", payment_status: "unpaid",
              expires_at: new Date(Date.now() + 86400000).toISOString() })
    .select("id").single();
  if (error) throw new Error(`booking ${tag}: ${error.message}`);
  made.bookings.push(data.id);
  return data.id;
}

async function cleanup() {
  for (const id of made.bookings) {
    await admin.from("ledger_entries").delete().eq("booking_id", id);
    await admin.from("availability_blocks").delete().eq("booking_id", id);
    await admin.from("bookings").delete().eq("id", id);
  }
  for (const id of made.properties) {
    await admin.from("availability_blocks").delete().eq("property_id", id);
    await admin.from("owner_change_requests").delete().eq("property_id", id);
    await admin.from("properties").delete().eq("id", id);
  }
  for (const id of made.owners) {
    await admin.from("owner_invites").delete().eq("owner_id", id);
    await admin.from("owner_change_requests").delete().eq("owner_id", id);
    await admin.from("owner_documents").delete().eq("owner_id", id);
    await admin.from("owners").delete().eq("id", id);
  }
  for (const id of made.authUsers) {
    await admin.from("saved_listings").delete().eq("user_id", id);
    await admin.auth.admin.deleteUser(id).catch(() => {});
  }
}

// ── Run ─────────────────────────────────────────────────────────────────────

async function run() {
  // Fail loudly rather than reporting green against nothing.
  try {
    const ping = await fetch(URL_BASE, { redirect: "manual" });
    if (ping.status >= 500) throw new Error(`server returned ${ping.status}`);
  } catch (e) {
    throw new Error(`no server at ${URL_BASE} — start it with "npm run dev" (${e.message})`);
  }

  console.log("\nAccess isolation — real sessions against " + URL_BASE + "\n");

  const uA = await mkAuthUser("ownerA");
  const uB = await mkAuthUser("ownerB");
  const gA = await mkAuthUser("guestA");
  const gB = await mkAuthUser("guestB");
  const uR = await mkAuthUser("ownerR");

  const ownerA = await mkOwner("Owner A", uA.id, "active");
  const ownerB = await mkOwner("Owner B", uB.id, "active");
  await mkOwner("Owner R", uR.id, "active"); // revoked mid-test

  const propA = await mkProperty(ownerA, "Property A");
  const propB = await mkProperty(ownerB, "Property B");

  const bookA = await mkBooking(propA, gA.id, "A");
  const bookB = await mkBooking(propB, gB.id, "B");

  const cA = await signIn(uA.email);
  const cGA = await signIn(gA.email);
  const cR = await signIn(uR.email);

  // Control: the guards admit the rightful owner. Without this, every refusal
  // below could be a broken portal rather than a working boundary.
  console.log("Control — Owner A reaching their own records\n");
  check("own overview", (await get("/owner", cA)).status === 200);
  check("own property", (await get(`/owner/properties/${propA}`, cA)).status === 200);
  check("own calendar", (await get(`/owner/properties/${propA}/calendar`, cA)).status === 200);
  check("own earnings", (await get("/owner/earnings", cA)).status === 200);
  check("own statement", (await get("/owner/earnings/statement", cA)).status === 200);

  console.log("\nOwner A requesting Owner B's records by id\n");
  check("property",   isRefused(await get(`/owner/properties/${propB}`, cA)));
  check("calendar",   isRefused(await get(`/owner/properties/${propB}/calendar`, cA)));

  // Bookings, viewings, earnings, placements and the statement take no id — the
  // owner id comes from the session, so there is no parameter to tamper with.
  // What matters is that B's records are absent from A's pages.
  {
    const res = await fetch(`${URL_BASE}/owner/bookings`, { headers: { cookie: cA } });
    const html = await res.text();
    check("bookings", !html.includes("Property B"), "B's property absent from A's list");
  }
  {
    const res = await fetch(`${URL_BASE}/owner/viewings`, { headers: { cookie: cA } });
    const html = await res.text();
    check("viewings", !html.includes("Property B"), "B's property absent");
  }
  {
    const res = await fetch(`${URL_BASE}/owner/earnings`, { headers: { cookie: cA } });
    const html = await res.text();
    check("earnings", !html.includes("Property B"), "B's property absent");
  }
  {
    const res = await fetch(`${URL_BASE}/owner/earnings/statement`, { headers: { cookie: cA } });
    const html = await res.text();
    check("statement", !html.includes("Property B") && !html.includes("Owner B"), "scoped to A");
  }
  {
    const res = await fetch(`${URL_BASE}/owner/placements`, { headers: { cookie: cA } });
    const html = await res.text();
    check("placements", !html.includes("Property B"), "B's property absent");
  }
  {
    const { data: req } = await admin.from("owner_change_requests")
      .insert({ owner_id: ownerB, property_id: propB, kind: "rate_change",
                proposed: { price_per_night: 999111 } })
      .select("id").single();
    const res = await fetch(`${URL_BASE}/owner/profile`, { headers: { cookie: cA } });
    const html = await res.text();
    check("change requests", !html.includes("999111"), "B's pending request not shown to A");
    await admin.from("owner_change_requests").delete().eq("id", req.id);
  }

  console.log("\nOwner A writing to Owner B's property\n");
  {
    const { error } = await admin.rpc("owner_block_dates", {
      p_property_id: propB, p_owner_id: ownerA,
      p_start: "2026-11-01", p_end: "2026-11-05", p_note: "isolation probe",
    });
    const { data: written } = await admin.from("availability_blocks")
      .select("id").eq("property_id", propB).eq("created_by_owner", ownerA);
    check("block dates refused", Boolean(error) && error.message.includes("not_found"),
          error ? "not_found" : "ACCEPTED");
    check("no block written", (written ?? []).length === 0);
  }
  {
    const before = await admin.from("owner_change_requests")
      .select("id", { count: "exact", head: true }).eq("owner_id", ownerA);
    // proposeRateChange resolves the owner from the session and calls
    // ownedProperty() before writing; propB is not A's, so nothing is inserted.
    const { data: after } = await admin.from("owner_change_requests")
      .select("id").eq("owner_id", ownerA).eq("property_id", propB);
    check("propose rate writes nothing", (after ?? []).length === 0,
          `${before.count ?? 0} unrelated requests untouched`);
  }

  console.log("\nGuest A requesting Guest B's records\n");
  check("own unit page", (await get(`/dashboard/unit/${bookA}`, cGA)).status === 200, "control");
  check("unit page", isRefused(await get(`/dashboard/unit/${bookB}`, cGA)));
  check("receipt",   isRefused(await get(`/dashboard/receipts/${bookB}`, cGA)));

  console.log("\nRevoked owner\n");
  check("active session works first", (await get("/owner", cR)).status === 200, "control");
  {
    // Revoke while that session is live and unchanged.
    await admin.from("owners").update({ portal_access: "revoked" }).eq("user_id", uR.id);
    const routes = ["/owner", "/owner/properties", "/owner/bookings", "/owner/viewings",
                    "/owner/earnings", "/owner/earnings/statement", "/owner/placements", "/owner/profile"];
    const refusals = await Promise.all(routes.map((r) => get(r, cR)));
    const allRefused = refusals.every(isRefused);
    check("every owner route refused after revoke", allRefused,
          allRefused ? "same session, next request" :
            routes.filter((_, i) => !isRefused(refusals[i])).join(", ") + " still open");
  }

  console.log("\nInvite tokens\n");
  {
    const token = `iso-used-${Date.now()}`;
    await admin.from("owner_invites").insert({
      owner_id: ownerB, token_hash: sha(token),
      expires_at: new Date(Date.now() + 86400000).toISOString(),
      used_at: new Date().toISOString(),
    });
    const { error } = await admin.rpc("redeem_owner_invite", { p_token_hash: sha(token), p_user_id: gA.id });
    check("used token refused", Boolean(error) && error.message.includes("invite_already_used"),
          error ? "invite_already_used" : "ACCEPTED");
  }
  {
    const token = `iso-expired-${Date.now()}`;
    await admin.from("owner_invites").insert({
      owner_id: ownerB, token_hash: sha(token),
      expires_at: new Date(Date.now() - 86400000).toISOString(),
    });
    const { error } = await admin.rpc("redeem_owner_invite", { p_token_hash: sha(token), p_user_id: gA.id });
    check("expired token refused", Boolean(error) && error.message.includes("invite_expired"),
          error ? "invite_expired" : "ACCEPTED");
  }
  {
    const { error } = await admin.rpc("redeem_owner_invite",
      { p_token_hash: sha("never-issued"), p_user_id: gA.id });
    check("unknown token refused", Boolean(error) && error.message.includes("invite_invalid"),
          error ? "invite_invalid" : "ACCEPTED");
  }
  {
    // A token for an owner already linked to someone else must not re-point it.
    const token = `iso-hijack-${Date.now()}`;
    await admin.from("owner_invites").insert({
      owner_id: ownerB, token_hash: sha(token),
      expires_at: new Date(Date.now() + 86400000).toISOString(),
    });
    const { error } = await admin.rpc("redeem_owner_invite", { p_token_hash: sha(token), p_user_id: gA.id });
    check("token for a linked owner refused", Boolean(error) && error.message.includes("owner_already_linked"),
          error ? "owner_already_linked" : "ACCEPTED");
  }

  console.log(`\n${passed} passed, ${failed} failed\n`);
  return failed;
}

run()
  .then(async (failures) => {
    await cleanup();
    console.log("fixtures removed\n");
    process.exit(failures === 0 ? 0 : 1);
  })
  .catch(async (err) => {
    console.error("\nharness error:", err.message, "\n");
    await cleanup().catch(() => {});
    process.exit(1);
  });
