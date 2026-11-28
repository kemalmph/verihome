#!/usr/bin/env node
/**
 * Staff permissions — role × every server action / route / page.
 *
 * For each pair, the permitted role must succeed and every other role must be
 * refused ON THE SERVER. Nothing here goes through the UI: server actions are
 * POSTed with the `Next-Action` header (ids read from the build's
 * server-reference-manifest), route handlers and pages are fetched with each
 * role's real session cookie.
 *
 * The expected matrix below is written out by hand from the owner's spec and
 * is deliberately NOT derived from src/lib/auth/permissions.ts: the test also
 * asserts that file, and the SQL role map, both equal the spec — so the three
 * cannot drift apart without a failure.
 *
 * Needs the local stack and a built app started with the local Supabase env:
 *   npx supabase start && npx supabase db reset
 *   npm run build && npm run start
 *   NODE_PATH=/opt/node-tools/node_modules node scripts/test-staff-permissions.js
 *
 * Env: SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY (from `npx supabase status`;
 * never written to a file), optional SUPABASE_URL and BASE_URL. Exits non-zero on any failure.
 */
const fs = require("fs");
const path = require("path");
const { Client } = require("pg");
const { createClient } = require("@supabase/supabase-js");
const { createServerClient } = require("@supabase/ssr");
const { encodeReply } = require("next/dist/compiled/react-server-dom-turbopack/client.edge");

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const SUPA = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
const ANON = process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!ANON || !SERVICE) {
  console.error("Set SUPABASE_ANON_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY) and SUPABASE_SERVICE_ROLE_KEY — `npx supabase status` prints the local ones.");
  process.exit(2);
}

const RUN = Date.now().toString(36);
const PASSWORD = "PermTest!123";
const Z = "00000000-0000-0000-0000-000000000000";
const ROLES = ["superadmin", "admin_general", "admin_listings", "admin_finance", "surveyor"];

const pass = [];
const fail = [];
const check = (ok, what) => { (ok ? pass : fail).push(what); if (!ok) console.log("  FAIL:", what); };

// ── The spec (owner's matrix), independent of src/lib/auth/permissions.ts ────
const ALL = ["staff.manage", "users.manage", "listings.manage", "bookings.operate", "payments.settle",
  "owners.payout_verify", "finance.view", "finance.operate", "surveys.input", "surveys.review",
  "sites.operate_all", "sites.finance_all", "platform.settings"];
const SPEC = {
  superadmin: ALL,
  admin_general: ["users.manage", "listings.manage", "bookings.operate", "surveys.input", "surveys.review", "sites.operate_all"],
  admin_listings: ["listings.manage", "bookings.operate", "surveys.input", "surveys.review"],
  admin_finance: ["payments.settle", "owners.payout_verify", "finance.view", "finance.operate", "sites.finance_all"],
  surveyor: ["surveys.input"],
};
const can = (role, anyOf) => anyOf.some((p) => SPEC[role].includes(p));
const sameSet = (a, b) => a.length === b.length && a.every((x) => b.includes(x));

// ── Action matrix: [exportedName, args, anyOfPermissions, opts] ──────────────
// Args are chosen to fail validation / miss every row AFTER the guard, so an
// allowed call mutates nothing. {F:{...}} is a FormData argument.
const F = (o = {}) => ({ F: o });
const SO = ["sites.operate_all"];
const SA = ["sites.operate_all", "sites.finance_all"];
const LM = ["listings.manage"];
// Site-scoped actions (every action that takes a site, unit, reservation,
// membership, plan, event, item or document) moved to
// scripts/test-site-isolation.js in Phase 3: access there is per site, and a
// refusal is the same not-found as a record that does not exist, so it can
// only be tested against real records. That suite runs every global role
// below (superadmin, admin_general, admin_finance, admin_listings, a nobody)
// as well as site owners and site staff. Left here: the site actions that
// take no site.
const SUPERADMIN_ONLY = ["staff.manage"]; // only superadmin holds staff.manage
const ACTIONS = [
  ["updatePropertyStatus", [Z, "draft"], LM],
  ["updatePropertyDetails", [Z, F({ name: "x", area: "x", property_type: "x", price_monthly: "1", bedrooms: "1", bathrooms: "1", address: "x" })], LM],
  ["deleteProperty", [Z], LM],
  ["updateConsultationStatus", [Z, "confirmed"], ["bookings.operate"]],
  ["saveBuildListing", [Z, F()], LM],
  ["createNewProperty", [], LM, { denyOnly: true }],
  ["listSites", [], SA],
  ["listOwnerOptions", [], SUPERADMIN_ONLY], // Phase 3: only a superadmin assigns a site's owner
  ["listSiteOptions", [], SA],
  ["createSite", [F()], SO],
  ["confirmCreditRefund", [Z], ["finance.operate"]],
  ["listCronRuns", [5], ["platform.settings"]],
  ["runDailyJobsNow", [], ["platform.settings"], { denyOnly: true }],
  ["recordSpend", [F({ kind: "operating", amount: "", description: "" })], ["finance.operate"]],
  ["createOwnerInvite", [Z], LM],
  ["setOwnerPortalAccess", [Z, "revoked"], LM],
  ["recordPlacement", [F()], ["finance.operate"]],
  ["markPlacementPaid", [Z], ["finance.operate"]],
  ["updatePlacementStatus", [Z, "bogus"], ["finance.operate"]],
  ["getPlatformSettings", [], ["platform.settings"]],
  ["countBookingsUnaffected", [], ["platform.settings"]],
  ["saveDefaultCommission", [F()], ["platform.settings"]],
  ["submitSurvey", [Z, F()], ["surveys.input"]],
  ["linkPendingImport", [Z, Z], ["surveys.review"]],
  ["rejectPendingImport", [Z], ["surveys.review"]],
  ["updateUser", [Z, F()], ["users.manage"]],
  ["deleteUser", [Z], ["users.manage"]],
  ["toggleActiveClient", [Z, true], ["users.manage"]],
  ["createAdminUser", [F()], ["users.manage"]],
  ["grantStaffRole", [Z, "surveyor"], ["staff.manage"]],
  ["revokeStaffRole", [Z, "surveyor"], ["staff.manage"]],
];

// ── Route matrix: [method, path, init, anyOf, label] ─────────────────────────
const BK = ["bookings.operate", "payments.settle", "finance.view"];
const jsonBody = (o) => ({ headers: { "content-type": "application/json" }, body: JSON.stringify(o) });
const ROUTES = [
  ["POST", "/api/admin/upload", {}, LM],
  ["DELETE", "/api/admin/upload/delete", jsonBody({}), LM],
  ["POST", "/api/admin/upload/video", {}, LM],
  ["POST", "/api/admin/short-stay-rates", jsonBody({}), LM],
  ["GET", "/api/admin/reports/integrity", {}, ["finance.view"]],
  ["GET", "/api/admin/reports/export?type=ledger", {}, ["finance.view"]],
  ["PATCH", `/api/bookings/${Z}`, jsonBody({ payment_status: "paid" }), ["payments.settle"], "bookings PATCH paid"],
  ["PATCH", `/api/bookings/${Z}`, jsonBody({ status: "cancelled" }), ["payments.settle"], "bookings PATCH cancelled"],
  ["PATCH", `/api/bookings/${Z}`, jsonBody({ status: "confirmed" }), ["bookings.operate"], "bookings PATCH confirmed"],
  ["PATCH", `/api/viewings/${Z}`, jsonBody({ action: "confirm", scheduled_at: "2026-01-01T00:00:00Z" }), ["payments.settle"], "viewings confirm"],
  ["PATCH", `/api/viewings/${Z}`, jsonBody({ action: "attend" }), ["bookings.operate"], "viewings attend"],
  ["PATCH", `/api/viewings/${Z}`, jsonBody({ action: "no_show" }), ["bookings.operate"], "viewings no_show"],
  ["PATCH", `/api/viewings/${Z}`, jsonBody({ action: "request_refund" }), ["finance.operate"], "viewings request_refund"],
  ["PATCH", `/api/viewings/${Z}`, jsonBody({ action: "confirm_refund" }), ["finance.operate"], "viewings confirm_refund"],
  ["GET", "/api/viewings/{VIEWING}", {}, BK],
  ["GET", "/api/viewings/{VIEWING}/payment-proof-url", {}, BK],
  ["GET", "/api/bookings/{BOOKING}/payment-proof-url", {}, BK],
];

// ── Page matrix: [path, anyOf]. Denied = redirect. ───────────────────────────
const PAGES = [
  ["/admin", ALL.filter((p) => p !== "surveys.input")], // surveyor-only is sent to /survey
  ["/admin/users", ["users.manage", "staff.manage"]],
  ["/admin/listings", LM], ["/admin/inventory", LM], [`/admin/listings/${Z}`, LM], [`/admin/listings/${Z}/build`, LM],
  ["/admin/bookings", BK], ["/admin/viewings", BK], ["/admin/consultations", ["bookings.operate"]],
  ["/admin/placements", ["finance.view", "finance.operate"]], ["/admin/expenses", ["finance.view", "finance.operate"]],
  ["/admin/reports/position", ["finance.view"]], ["/admin/reports/sales", ["finance.view"]],
  [`/admin/owners/${Z}/statement`, ["finance.view"]],
  ["/admin/owners", ["listings.manage", "owners.payout_verify"]],
  ["/admin/owner-requests", ["listings.manage", "owners.payout_verify"]],
  ["/admin/surveys/pending", ["surveys.review"]],
  ["/admin/settings", ["platform.settings"]], ["/admin/cron", ["platform.settings"]],
  ["/site", SA], // per-site pages: scripts/test-site-isolation.js
  ["/survey", ["surveys.input"]],
];

const DENY_RE = /do not have permission|signed in as staff|Only a superadmin|Admin access required|must be signed in|You need to be signed in/i;

(async () => {
  const db = new Client({ host: "127.0.0.1", port: 54322, user: "postgres", password: "postgres", database: "postgres" });
  await db.connect();
  const q = async (sql, args = []) => (await db.query(sql, args)).rows;
  const svc = createClient(SUPA, SERVICE, { auth: { persistSession: false } });

  // ── 0. role maps agree: spec == permissions.ts == SQL ──────────────────────
  const permsMod = await import(path.join(process.cwd(), "src/lib/auth/permissions.ts"));
  for (const r of ROLES) {
    check(sameSet([...permsMod.ROLE_PERMISSIONS[r]], SPEC[r]), `permissions.ts matches the spec for ${r}`);
    const [{ p }] = await q("select staff_role_permissions($1) as p", [r]);
    check(sameSet(p, SPEC[r]), `SQL staff_role_permissions matches the spec for ${r}`);
  }
  check(sameSet([...permsMod.PERMISSIONS], ALL), "permissions.ts lists exactly the 13 permissions");

  // ── 1. fixtures ────────────────────────────────────────────────────────────
  const users = {};
  async function mkUser(key, name) {
    const email = `perm-${key}-${RUN}@test.invalid`;
    const { data, error } = await svc.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true, user_metadata: { full_name: name ?? key } });
    if (error) throw new Error(`createUser ${key}: ${error.message}`);
    await svc.from("users").upsert({ id: data.user.id, name: name ?? key, email }, { onConflict: "id" });
    users[key] = { id: data.user.id, email };
    return users[key];
  }
  for (const r of ROLES) {
    await mkUser(r);
    await q("insert into staff_roles(user_id, role) values ($1,$2)", [users[r].id, r]);
  }
  await mkUser("nobody");
  await mkUser("target_staff"); await q("insert into staff_roles(user_id, role) values ($1,'admin_listings')", [users.target_staff.id]);
  const lastRoles = [...ROLES, "nobody"];

  // sessions → cookie headers
  async function cookieFor(u) {
    const jar = new Map();
    const sb = createServerClient(SUPA, ANON, {
      cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: (c) => c.forEach(({ name, value }) => jar.set(name, value)) },
    });
    const { error } = await sb.auth.signInWithPassword({ email: u.email, password: PASSWORD });
    if (error) throw new Error(`sign-in ${u.email}: ${error.message}`);
    return [...jar].map(([n, v]) => `${n}=${v}`).join("; ");
  }
  const cookies = {};
  for (const r of lastRoles) cookies[r] = await cookieFor(users[r]);

  // ── 2. action ids from the build manifest ─────────────────────────────────
  const manifest = JSON.parse(fs.readFileSync(".next/server/server-reference-manifest.json", "utf8")).node;
  const actionIndex = {};
  for (const [id, m] of Object.entries(manifest)) {
    for (const [worker, info] of Object.entries(m.workers)) {
      const route = "/" + worker.replace(/^app\//, "").replace(/\/page$/, "").replace(/\[[^\]]+\]/g, Z);
      // Inline actions have generated names; the only one tested is the listings page's.
      const name = info.filename === "src/app/admin/listings/page.tsx" ? "createNewProperty" : info.exportedName;
      (actionIndex[name] ??= []).push({ id, route, file: info.filename });
    }
  }
  const prefer = (list) => list.find((a) => /^\/(admin|site)/.test(a.route)) ?? list[0];

  async function callAction(name, args, cookie) {
    const ent = actionIndex[name];
    if (!ent) throw new Error(`action ${name} not in manifest`);
    const a = prefer(ent);
    // encodeReply is the very function the browser client uses, so the wire
    // format (including FormData's "_1_" field prefix) is exactly the real one.
    const real = args.map((x) => {
      if (x && x.F) { const fd = new FormData(); for (const [k, v] of Object.entries(x.F)) fd.append(k, v); return fd; }
      return x;
    });
    const enc = await encodeReply(real);
    const headers = { Cookie: cookie, "Next-Action": a.id, Accept: "text/x-component" };
    let body = enc;
    if (typeof enc === "string") headers["Content-Type"] = "text/plain;charset=UTF-8";
    const res = await fetch(BASE + a.route, { method: "POST", headers, body, redirect: "manual" });
    return { status: res.status, text: await res.text() };
  }
  // Denied = a guard message came back, or the action threw (guards that throw
  // surface as a 500 with only a digest in production).
  const wasDenied = (r) => DENY_RE.test(r.text) || r.status >= 500 || r.status === 307 || r.status === 401 || r.status === 403;

  // ── 3. action matrix ──────────────────────────────────────────────────────
  console.log(`Actions: ${ACTIONS.length} × ${lastRoles.length} roles`);
  for (const [name, args, need, opts = {}] of ACTIONS) {
    for (const role of lastRoles) {
      const allowed = role !== "nobody" && can(role, need);
      if (allowed && opts.denyOnly) continue;
      const r = await callAction(name, args, cookies[role]);
      const denied = wasDenied(r);
      if (process.env.DEBUG_ACTIONS && (allowed ? denied : !denied)) console.log("   ·", name, role, r.status, JSON.stringify(r.text.slice(0, 300)));
      check(allowed ? !denied : denied, `action ${name}: ${role} ${allowed ? "allowed" : "refused"} (got HTTP ${r.status}${denied ? ", denied" : ""})`);
    }
  }

  // ── 4. actions that fail soft (return [] / 0 on refusal): need real data ──
  const mkOwner = async (name) => (await q("insert into owners(name, email) values ($1,$2) returning id", [name, `${name.toLowerCase()}-${RUN}@test.invalid`]))[0].id;
  const ownerRate = await mkOwner(`PERMTEST-RATE-${RUN}`);
  const ownerPay = await mkOwner(`PERMTEST-PAYOUT-${RUN}`);
  await q("insert into owner_change_requests(owner_id, kind, proposed) values ($1,'rate_change','{}'),($2,'payout_account','{\"bank\":\"x\",\"account_number\":\"1\",\"account_holder\":\"x\"}')", [ownerRate, ownerPay]);
  const [{ id: inviteId }] = await q("insert into owner_invites(owner_id, token_hash, expires_at) values ($1,'x-'||gen_random_uuid()::text, now()+interval '1 day') returning id", [ownerRate]);
  await svc.from("users").update({ name: `PERMTEST-REFUND-${RUN}` }).eq("id", users.nobody.id);
  await q("insert into user_credits(user_id, amount, reason, status, refund_requested_at) values ($1, 1, 'permtest', 'refund_requested', now())", [users.nobody.id]);

  // These actions fail soft. Some are not remotely callable at all (Next drops
  // server actions nothing on the client references), so the check goes through
  // the page that renders them, which runs the very same guard.
  const html = async (p, role) => {
    const res = await fetch(BASE + p, { redirect: "manual", headers: { Cookie: cookies[role] } });
    return res.status >= 300 && res.status < 400 ? "" : await res.text();
  };
  for (const role of lastRoles) {
    const sees = (anyOf) => role !== "nobody" && can(role, anyOf);
    const dash = await html("/admin", role);
    check(dash.includes(`PERMTEST-REFUND-${RUN}`) === sees(["finance.view", "finance.operate"]), `credit refund requests on /admin: ${role} ${sees(["finance.view", "finance.operate"]) ? "sees" : "does not see"} them`);
    check(/permintaan pemilik menunggu/.test(dash) === sees(["listings.manage", "owners.payout_verify"]), `pending owner request count on /admin: ${role} ${sees(["listings.manage", "owners.payout_verify"]) ? "sees" : "does not see"} it`);
    const reqs = await html("/admin/owner-requests", role);
    check(reqs.includes(`PERMTEST-RATE-${RUN}`) === sees(["listings.manage"]), `owner requests page: ${role} rate_change visibility`);
    check(reqs.includes(`PERMTEST-PAYOUT-${RUN}`) === sees(["owners.payout_verify"]), `owner requests page: ${role} payout_account visibility`);
    if (actionIndex.listOwnerInvites) {
      const r = await callAction("listOwnerInvites", [ownerRate], cookies[role]);
      check(r.text.includes(inviteId) === sees(LM), `listOwnerInvites: ${role} ${sees(LM) ? "sees" : "does not see"} invites`);
    }
  }

  // approve/reject depend on the request KIND. Seed one request per attempt and
  // read the row back: it only leaves 'pending' if the action went through.
  for (const act of ["approveOwnerRequest", "rejectOwnerRequest"]) {
    for (const [kind, owner, need] of [["rate_change", ownerRate, LM], ["payout_account", ownerPay, ["owners.payout_verify"]]]) {
      for (const role of lastRoles) {
        await q("delete from owner_change_requests where owner_id=$1 and kind=$2 and status='pending'", [owner, kind]);
        const [{ id }] = await q("insert into owner_change_requests(owner_id, kind, proposed) values ($1,$2,'{\"bank\":\"x\",\"account_number\":\"1\",\"account_holder\":\"x\"}') returning id", [owner, kind]);
        await callAction(act, [id], cookies[role]);
        const [{ status }] = await q("select status from owner_change_requests where id=$1", [id]);
        const allowed = role !== "nobody" && can(role, need);
        check((status !== "pending") === allowed, `${act} on ${kind}: ${role} ${allowed ? "allowed" : "refused"} (status ${status})`);
      }
    }
  }

  // Rows owned by someone else: for "owner or staff" routes a missing row is a
  // 404 for everyone, which would hide whether the permission check works.
  const rowOwner = await mkUser("row_owner");
  const [{ id: propId }] = await q("insert into properties(name, slug) values ('PERMTEST', $1) returning id", [`permtest-${RUN}`]);
  const [{ id: viewingId }] = await q("insert into viewings(deposit_amount, user_id, property_id, payment_proof_url) values (1,$1,$2,'k') returning id", [rowOwner.id, propId]);
  const [{ id: bookingId }] = await q("insert into bookings(booking_code, property_id, user_id, check_in_date, check_out_date, total_price, payment_proof_url) values ($1,$2,$3,'2030-01-01','2030-01-03',1,'k') returning id", [`PT${RUN}`.slice(0, 12), propId, rowOwner.id]);
  const sub = (p) => p.replace("{VIEWING}", viewingId).replace("{BOOKING}", bookingId);

  // ── 5. routes ─────────────────────────────────────────────────────────────
  console.log(`Routes: ${ROUTES.length} × ${lastRoles.length + 1} callers`);
  for (const [method, p, init, need, label] of ROUTES) {
    for (const role of ["anon", ...lastRoles]) {
      const allowed = role !== "anon" && role !== "nobody" && can(role, need);
      const res = await fetch(BASE + sub(p), { method, redirect: "manual", ...init, headers: { ...(init.headers ?? {}), ...(role === "anon" ? {} : { Cookie: cookies[role] }) } });
      await res.text();
      const refused = res.status === 401 || res.status === 403;
      check(allowed ? !refused : refused, `${method} ${label ?? p}: ${role} ${allowed ? "allowed" : "refused"} (HTTP ${res.status})`);
    }
  }

  // ── 6. pages ──────────────────────────────────────────────────────────────
  console.log(`Pages: ${PAGES.length} × ${lastRoles.length} roles`);
  for (const [p, need] of PAGES) {
    for (const role of lastRoles) {
      const allowed = role !== "nobody" && can(role, need);
      const res = await fetch(BASE + p, { redirect: "manual", headers: { Cookie: cookies[role] } });
      await res.text();
      const redirected = res.status >= 300 && res.status < 400;
      check(allowed ? !redirected : redirected, `page ${p.replace(Z, ":id")}: ${role} ${allowed ? "allowed" : "redirected"} (HTTP ${res.status})`);
    }
  }
  // nobody-with-no-role and anon never reach /admin at all
  const anonAdmin = await fetch(BASE + "/admin", { redirect: "manual" });
  check(anonAdmin.status >= 300 && anonAdmin.status < 400, "anon is redirected away from /admin");

  // ── 7. privilege-escalation scenarios ─────────────────────────────────────
  const rolesOf = async (id) => (await q("select role from staff_roles where user_id=$1 order by 1", [id])).map((r) => r.role);

  let r = await callAction("grantStaffRole", [users.admin_general.id, "admin_finance"], cookies.admin_general);
  check(wasDenied(r) && !(await rolesOf(users.admin_general.id)).includes("admin_finance"), "admin_general cannot grant themselves admin_finance (DB unchanged)");
  r = await callAction("grantStaffRole", [users.admin_general.id, "superadmin"], cookies.admin_general);
  check(wasDenied(r) && !(await rolesOf(users.admin_general.id)).includes("superadmin"), "admin_general cannot grant themselves superadmin");
  r = await callAction("grantStaffRole", [users.nobody.id, "admin_finance"], cookies.admin_finance);
  check(wasDenied(r) && (await rolesOf(users.nobody.id)).length === 0, "admin_finance cannot grant roles to anyone");
  r = await callAction("revokeStaffRole", [users.target_staff.id, "admin_listings"], cookies.admin_general);
  check(wasDenied(r) && (await rolesOf(users.target_staff.id)).includes("admin_listings"), "admin_general cannot revoke a staff role");

  r = await callAction("grantStaffRole", [users.nobody.id, "admin_finance"], cookies.superadmin);
  const granted = await q("select granted_by from staff_roles where user_id=$1 and role='admin_finance'", [users.nobody.id]);
  check(granted.length === 1 && granted[0].granted_by === users.superadmin.id, "superadmin can grant a role, and granted_by records them");
  r = await callAction("grantStaffRole", [users.nobody.id, "not_a_role"], cookies.superadmin);
  check(!(await rolesOf(users.nobody.id)).includes("not_a_role"), "an unknown role is not stored");
  r = await callAction("revokeStaffRole", [users.nobody.id, "admin_finance"], cookies.superadmin);
  check((await rolesOf(users.nobody.id)).length === 0, "superadmin can revoke a role");
  r = await callAction("revokeStaffRole", [users.superadmin.id, "superadmin"], cookies.superadmin);
  check((await rolesOf(users.superadmin.id)).includes("superadmin") && /own superadmin|at least one/.test(r.text), "superadmin cannot revoke their own superadmin");

  // users.manage must not reach staff accounts (edit email + reset password = takeover)
  const form = F({ name: "Hijacked", email: `hijack-${RUN}@test.invalid` });
  r = await callAction("updateUser", [users.target_staff.id, form], cookies.admin_general);
  const [tgt] = await q("select name, email from users where id=$1", [users.target_staff.id]);
  check(/superadmin can change/i.test(r.text) && tgt.name !== "Hijacked" && tgt.email === users.target_staff.email, "admin_general cannot edit a staff account");
  r = await callAction("toggleActiveClient", [users.target_staff.id, true], cookies.admin_general);
  check(/superadmin can change/i.test(r.text), "admin_general cannot toggle a staff account");
  r = await callAction("deleteUser", [users.target_staff.id], cookies.admin_general);
  check(/superadmin can change/i.test(r.text) && (await q("select 1 from users where id=$1", [users.target_staff.id])).length === 1, "admin_general cannot delete a staff account");
  r = await callAction("deleteUser", [users.superadmin.id], cookies.admin_general);
  check((await q("select 1 from users where id=$1", [users.superadmin.id])).length === 1, "admin_general cannot delete the superadmin");

  const plain = await mkUser("plain_victim", "PlainVictim");
  r = await callAction("updateUser", [plain.id, F({ name: "Renamed", email: plain.email })], cookies.admin_general);
  check((await q("select name from users where id=$1", [plain.id]))[0].name === "Renamed", "admin_general (users.manage) can edit an ordinary user");
  r = await callAction("deleteUser", [plain.id], cookies.admin_general);
  check((await q("select 1 from users where id=$1", [plain.id])).length === 0, "admin_general can delete an ordinary user");

  // creating a staff account is granting a role
  const newEmail = `created-${RUN}@test.invalid`;
  r = await callAction("createAdminUser", [F({ name: "X", email: newEmail, password: "Abcdefgh1", role: "admin_listings" })], cookies.admin_general);
  check(DENY_RE.test(r.text) && (await q("select 1 from users where email=$1", [newEmail])).length === 0, "admin_general cannot create a staff account (explicit role)");
  r = await callAction("createAdminUser", [F({ name: "X", email: newEmail, password: "Abcdefgh1", role: "nonsense" })], cookies.superadmin);
  check((await q("select 1 from users where email=$1", [newEmail])).length === 0, "superadmin: an unknown role creates nothing");
  r = await callAction("createAdminUser", [F({ name: "X", email: newEmail, password: "Abcdefgh1", role: "admin_listings" })], cookies.superadmin);
  const created = await q("select u.id, array_agg(sr.role) as roles from users u left join staff_roles sr on sr.user_id=u.id where u.email=$1 group by u.id", [newEmail]);
  check(created.length === 1 && created[0].roles.includes("admin_listings"), "superadmin can create a staff account with a chosen role");
  if (created[0]) await svc.auth.admin.deleteUser(created[0].id);

  // fail-closed: no role / is_admin field => ordinary user, nothing in staff_roles
  for (const [label, extra, who] of [
    ["no role/is_admin field (superadmin)", {}, "superadmin"],
    ["empty role field (superadmin)", { role: "" }, "superadmin"],
    ["legacy is_admin=true, no role (superadmin)", { is_admin: "true" }, "superadmin"],
    ["no role field (admin_general)", {}, "admin_general"],
  ]) {
    const em = `failclosed-${RUN}-${Math.random().toString(36).slice(2, 8)}@test.invalid`;
    await callAction("createAdminUser", [F({ name: "Plain", email: em, password: "Abcdefgh1", ...extra })], cookies[who]);
    const row = (await q("select id from users where email=$1", [em]))[0];
    check(!!row, `fail-closed: ${label} still creates the account`);
    if (row) {
      check((await rolesOf(row.id)).length === 0, `fail-closed: ${label} -> no row in staff_roles`);
      await svc.auth.admin.deleteUser(row.id);
    }
  }

  // ── 8. database level ─────────────────────────────────────────────────────
  // has_staff_permission against SPEC, as each user (auth.uid() from the claim)
  for (const role of lastRoles) {
    for (const perm of ALL) {
      await db.query("begin");
      await db.query("select set_config('request.jwt.claim.sub', $1, true), set_config('request.jwt.claims', $2, true)", [users[role].id, JSON.stringify({ sub: users[role].id, role: "authenticated" })]);
      const [{ ok }] = (await db.query("select has_staff_permission($1) as ok", [perm])).rows;
      await db.query("rollback");
      const expected = role !== "nobody" && SPEC[role].includes(perm);
      check(ok === expected, `has_staff_permission(${perm}) as ${role} = ${expected}`);
    }
  }
  await db.query("begin");
  await db.query("select set_config('request.jwt.claim.sub', $1, true)", [users.admin_finance.id]);
  const [hr] = (await db.query("select has_staff_role('admin_finance') a, has_staff_role('superadmin') b, has_any_staff_permission(array['finance.view','x']) c, has_any_staff_permission(array['staff.manage']) d")).rows;
  await db.query("rollback");
  check(hr.a && !hr.b && hr.c && !hr.d, "has_staff_role / has_any_staff_permission behave");

  // grants: anon has no EXECUTE, authenticated cannot read the tables
  const anon = createClient(SUPA, ANON, { auth: { persistSession: false } });
  const anonRpc = await anon.rpc("has_staff_permission", { p_permission: "staff.manage" });
  check(!!anonRpc.error, "anon cannot EXECUTE has_staff_permission");
  const anonRole = await anon.rpc("has_staff_role", { p_role: "superadmin" });
  check(!!anonRole.error, "anon cannot EXECUTE has_staff_role");
  const anonSr = await anon.from("staff_roles").select("*");
  check(!!anonSr.error || (anonSr.data ?? []).length === 0, "anon cannot read staff_roles");
  const authed = createClient(SUPA, ANON, { auth: { persistSession: false } });
  await authed.auth.signInWithPassword({ email: users.superadmin.email, password: PASSWORD });
  const sr = await authed.from("staff_roles").select("*");
  check(!!sr.error || (sr.data ?? []).length === 0, "even a signed-in superadmin cannot read staff_roles through PostgREST");
  const ss = await authed.from("site_staff").select("*");
  check(!!ss.error || (ss.data ?? []).length === 0, "site_staff is not readable through PostgREST");
  const ins = await authed.from("staff_roles").insert({ user_id: users.superadmin.id, role: "surveyor" });
  check(!!ins.error, "a signed-in user cannot write staff_roles through PostgREST");
  const rls = await q("select relname, relrowsecurity from pg_class where relname in ('staff_roles','site_staff') order by 1");
  check(rls.length === 2 && rls.every((x) => x.relrowsecurity), "RLS is on for staff_roles and site_staff");
  const pols = await q("select count(*)::int n from pg_policies where tablename in ('staff_roles','site_staff')");
  check(pols[0].n === 0, "staff_roles / site_staff have no policies (service_role only)");

  // CHECK constraints
  for (const [sql, what] of [
    ["insert into staff_roles(user_id, role) values ($1,'wizard')", "staff_roles rejects an unknown role"],
    ["insert into site_staff(site_id, user_id, role) values ($2,$1,'front_office')", "site_staff needs a real site (FK)"],
  ]) {
    let threw = false; try { await q(sql, [users.nobody.id, Z]); } catch { threw = true; }
    check(threw, what);
  }

  // RLS policies that moved off is_admin: seeded credit row is visible to finance, not to listings
  const asUser = async (key) => { const c = createClient(SUPA, ANON, { auth: { persistSession: false } }); await c.auth.signInWithPassword({ email: users[key].email, password: PASSWORD }); return c; };
  const seen = async (key) => ((await (await asUser(key)).from("user_credits").select("id").eq("user_id", users.nobody.id)).data ?? []).length;
  check((await seen("admin_finance")) > 0, "RLS: admin_finance reads another user's credits (finance.view)");
  check((await seen("superadmin")) > 0, "RLS: superadmin reads another user's credits");
  check((await seen("admin_listings")) === 0, "RLS: admin_listings cannot read other users' credits");
  check((await seen("surveyor")) === 0, "RLS: surveyor cannot read other users' credits");

  // bootstrap hook is gone: the admin@verihome.id email grants nothing
  check((await q("select 1 from pg_trigger where tgname='trg_set_admin_flag'")).length === 0, "trg_set_admin_flag is dropped");
  check((await q("select 1 from pg_proc where proname='set_admin_flag'")).length === 0, "set_admin_flag() is dropped");
  const hookEmail = "admin@verihome.id";
  let hookUser = (await q("select id from users where email=$1", [hookEmail]))[0];
  if (!hookUser) {
    const { data, error } = await svc.auth.admin.createUser({ email: hookEmail, password: PASSWORD, email_confirm: true });
    if (error) throw new Error(error.message);
    hookUser = { id: data.user.id };
    await q("insert into users(id, email, name) values ($1,$2,'Admin') on conflict (id) do nothing", [hookUser.id, hookEmail]);
    check((await rolesOf(hookUser.id)).length === 0, "signing up as admin@verihome.id grants no staff role (no takeover path)");
    await svc.auth.admin.deleteUser(hookUser.id);
  }

  // legacy flag is not authoritative any more
  const legacyUser = await mkUser("legacy_flag");
  await q("update users set is_admin=true, is_surveyor=true where id=$1", [legacyUser.id]);
  const legacyCookie = await cookieFor(legacyUser);
  const lr = await callAction("listSites", [], legacyCookie);
  check(wasDenied(lr), "users.is_admin = true alone grants nothing (roles come from staff_roles)");
  const lp = await fetch(BASE + "/admin", { redirect: "manual", headers: { Cookie: legacyCookie } });
  check(lp.status >= 300 && lp.status < 400, "a legacy is_admin user is redirected out of /admin");

  // ── cleanup ───────────────────────────────────────────────────────────────
  await q("delete from owner_invites where owner_id in ($1,$2)", [ownerRate, ownerPay]);
  await q("delete from owner_change_requests where owner_id in ($1,$2)", [ownerRate, ownerPay]);
  await q("delete from owners where id in ($1,$2)", [ownerRate, ownerPay]);
  await q("delete from user_credits where reason='permtest'");
  await q("delete from viewings where id=$1", [viewingId]);
  await q("delete from bookings where id=$1", [bookingId]);
  await q("delete from properties where id=$1", [propId]);
  for (const u of Object.values(users)) await svc.auth.admin.deleteUser(u.id).catch(() => {});

  await db.end();
  console.log(`\n${pass.length} passed, ${fail.length} failed`);
  if (fail.length) { console.log("\nFailures:"); fail.forEach((f) => console.log("  ✗", f)); process.exit(1); }
})().catch((e) => { console.error(e); process.exit(2); });
