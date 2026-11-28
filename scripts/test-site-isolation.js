#!/usr/bin/env node
/**
 * Site isolation (Phase 3) — site owners and site staff reach THEIR site only.
 *
 * Everything goes over HTTP against the built app with real sessions: server
 * actions are POSTed with the `Next-Action` header (ids from the build's
 * server-reference-manifest, args encoded with the browser's own
 * encodeReply), route handlers and pages are fetched with each person's real
 * cookie. Nothing here re-implements the guard.
 *
 * Fixtures: two sites A and B, an owner for each (owners.portal_access =
 * 'active'), one site_staff member per role in A, one staff member in B, and
 * global staff (superadmin, admin_general, admin_finance, admin_listings) plus
 * a signed-in nobody. Each site has a unit, a retired unit, a reservation
 * with an item line and an instalment, a membership, a plan, an event, a
 * catalog item, two documents (contract + invoice) and an open invite.
 *
 *   1. spec: src/lib/auth/site-permissions.ts equals the owner's matrix,
 *      written out by hand below (not derived from that file).
 *   2. cross-site: every A-side person × every action/route/page aimed at B
 *      — with B's site id, and with site id A plus B's record ids — is refused,
 *      and a snapshot of B's rows is byte-identical afterwards.
 *   3. matrix: every person × every action/route/page on A — allowed ones
 *      succeed (reach validation after the guard), every other is refused.
 *   4. money visibility: no site role sees committed rent, item sales, COGS
 *      or margin; finance sees the billing summary; finance opens invoices,
 *      not contracts.
 *   5. escalation: superstaff cannot appoint or remove superstaff; a site
 *      owner cannot change owner_id; admin_general cannot set it on create; a
 *      revoked site role and a revoked owner portal are refused on the very
 *      next request.
 *   6. invites: wrong token, expired, revoked, used twice, other email — all
 *      refused; a good one creates the site_staff row, single use.
 *   7. B4: createMembership ignores payment_status=paid — row is unpaid and
 *      nothing is posted to the ledger.
 *   8. sidebar: each person sees exactly the site pages their permissions open.
 *
 * Needs the local stack and a built app started with the local Supabase env:
 *   npx supabase start && npx supabase db reset
 *   npm run build && npm run start
 *   NODE_PATH=/opt/node-tools/node_modules node scripts/test-site-isolation.js
 * Env: SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY (from `npx supabase status`;
 * never written to a file), optional SUPABASE_URL and BASE_URL.
 * Exits non-zero on any failure.
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { Client } = require("pg");
const { createClient } = require("@supabase/supabase-js");
const { createServerClient } = require("@supabase/ssr");
const { encodeReply } = require("next/dist/compiled/react-server-dom-turbopack/client.edge");

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const SUPA = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
const ANON = process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!ANON || !SERVICE) {
  console.error("Set SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY — `npx supabase status` prints the local ones.");
  process.exit(2);
}
if (!/127\.0\.0\.1|localhost/.test(SUPA)) {
  console.error("Refusing to run against a non-local Supabase.");
  process.exit(2);
}

const RUN = Date.now().toString(36);
const PASSWORD = "SiteIso!2468";

const pass = [];
const fail = [];
const check = (ok, what) => { (ok ? pass : fail).push(what); if (!ok) console.log("  FAIL:", what); };

// ── 1. The owner's matrix, by hand ───────────────────────────────────────────
const ALL = [
  "site.view", "site.reservations.view", "site.reservations", "site.members.view", "site.members",
  "site.events", "site.units", "site.catalog", "site.documents.view", "site.documents",
  "site.settings", "site.billing", "site.staff", "site.revenue",
];
const NO_REVENUE = ALL.filter((p) => p !== "site.revenue");
const SPEC = {
  owner: NO_REVENUE,
  superstaff: NO_REVENUE,
  front_office: ["site.view", "site.reservations.view", "site.reservations", "site.members.view", "site.members", "site.events"],
  back_office: ["site.view", "site.reservations.view", "site.members.view", "site.units", "site.catalog", "site.documents", "site.settings"],
  finance: ["site.view", "site.reservations.view", "site.members.view", "site.billing", "site.documents.view"],
  // global staff, on every site
  superadmin: ALL,
  admin_general: ALL.filter((p) => !["site.billing", "site.staff", "site.revenue"].includes(p)),
  admin_finance: ["site.view", "site.reservations.view", "site.members.view", "site.documents.view", "site.billing", "site.revenue"],
  admin_listings: [],
  surveyor: [],
  nobody: [],
};
const sameSet = (a, b) => a.length === b.length && a.every((x) => b.includes(x));

/** People, and what they hold on site A. ownerB holds nothing on A. */
const A_SIDE = ["ownerA", "superstaff", "front_office", "back_office", "finance"];
const PEOPLE = [...A_SIDE, "superadmin", "admin_general", "admin_finance", "admin_listings", "surveyor", "nobody", "ownerB"];
const permsOnA = (who) =>
  who === "ownerA" ? SPEC.owner : who === "ownerB" ? [] : SPEC[who];
const canOnA = (who, anyOf) => anyOf.some((p) => permsOnA(who).includes(p));

(async () => {
  const db = new Client({ host: "127.0.0.1", port: 54322, user: "postgres", password: "postgres", database: "postgres" });
  await db.connect();
  const q = async (sql, args = []) => (await db.query(sql, args)).rows;
  const one = async (sql, args = []) => (await q(sql, args))[0];
  const svc = createClient(SUPA, SERVICE, { auth: { persistSession: false } });

  // ── spec ────────────────────────────────────────────────────────────────
  const sp = await import(path.join(process.cwd(), "src/lib/auth/site-permissions.ts"));
  check(sameSet([...sp.SITE_PERMISSIONS], ALL), "site-permissions.ts lists exactly the 14 site permissions");
  for (const rel of ["owner", "superstaff", "front_office", "back_office", "finance"]) {
    check(sameSet([...sp.SITE_ROLE_PERMISSIONS[rel]], SPEC[rel]), `site-permissions.ts matches the spec for ${rel}`);
  }
  const permsMod = await import(path.join(process.cwd(), "src/lib/auth/permissions.ts"));
  for (const r of ["superadmin", "admin_general", "admin_finance", "admin_listings", "surveyor"]) {
    const g = sp.globalSitePermissions([r], permsMod.permissionsForRoles([r]));
    check(sameSet(g, SPEC[r]), `global site permissions match the spec for ${r}`);
  }
  check(sameSet(sp.manageableSiteRoles({ isSuperadmin: false, relations: ["superstaff"] }), ["front_office", "back_office", "finance"]),
    "superstaff manages front_office, back_office, finance only");
  check(sameSet(sp.manageableSiteRoles({ isSuperadmin: false, relations: ["owner"] }), ["superstaff", "front_office", "back_office", "finance"]),
    "owner manages every site role");

  // ── fixtures ────────────────────────────────────────────────────────────
  const users = {};
  async function mkUser(key) {
    const email = `siteiso-${key.replace(/_/g, "-")}-${RUN}@test.invalid`;
    const { data, error } = await svc.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true, user_metadata: { full_name: key } });
    if (error) throw new Error(`createUser ${key}: ${error.message}`);
    await svc.from("users").upsert({ id: data.user.id, name: key, email }, { onConflict: "id" });
    users[key] = { id: data.user.id, email };
    return users[key];
  }
  for (const k of [...PEOPLE, "superstaff2", "fo2", "staffB", "inviteeX", "inviteeY", "inviteeZ", "inviteeU"]) await mkUser(k);
  for (const r of ["superadmin", "admin_general", "admin_finance", "admin_listings", "surveyor"]) {
    await q("insert into staff_roles(user_id, role) values ($1,$2)", [users[r].id, r]);
  }

  const mkOwner = async (key) => (await one(
    "insert into owners(name, email, user_id, portal_access) values ($1,$2,$3,'active') returning id",
    [`SITEISO-${key}-${RUN}`, users[key].email, users[key].id])).id;
  const ownerA = await mkOwner("ownerA");
  const ownerB = await mkOwner("ownerB");

  const amen = (await q("select id from amenities order by code limit 2")).map((r) => r.id);

  async function mkSite(tag, ownerId) {
    const S = {};
    S.name = `SITEISO-${tag}-${RUN}`;
    S.slug = `siteiso-${tag.toLowerCase()}-${RUN}`;
    S.id = (await one("insert into sites(name, slug, owner_id, status) values ($1,$2,$3,'active') returning id", [S.name, S.slug, ownerId])).id;
    S.unit = (await one("insert into lettable_units(site_id, name, unit_type, letting_mode, price, size_sqm) values ($1,'Ruang 1','private_room','monthly',1000000,10) returning id", [S.id])).id;
    S.retired = (await one("insert into lettable_units(site_id, name, unit_type, letting_mode, status) values ($1,'Gudang','private_room','monthly','retired') returning id", [S.id])).id;
    S.code = `CW-ISO${tag}-${RUN}`.toUpperCase();
    S.res = (await one(`insert into unit_reservations(reservation_code, unit_id, tenant_name, starts_at, ends_at, letting_mode, unit_price, total_price, exclusive_use, status, payment_status, utilities_included)
      values ($1,$2,'Penyewa ${tag}', now() - interval '10 days', now() + interval '60 days', 'monthly', 1000000, 2000000, true, 'confirmed', 'unpaid', false) returning id`, [S.code, S.unit])).id;
    S.item = (await one("insert into items(site_id, name, cost_price, sell_price) values ($1,$2,1000,5000) returning id", [S.id, `Air ${tag}`])).id;
    S.resItem = (await one("insert into reservation_items(reservation_id, item_id, name, qty, cost_price, sell_price) values ($1,$2,'Air',3,1000,5000) returning id", [S.res, S.item])).id;
    await q("insert into reservation_instalments(reservation_id, seq, due_date, amount, status) values ($1,1,current_date - 3, 777000,'due')", [S.res]);
    S.plan = (await one("insert into membership_plans(site_id, name, price) values ($1,$2,300000) returning id", [S.id, `Paket ${tag}`])).id;
    S.mem = (await one(`insert into memberships(membership_code, site_id, plan_id, member_name, starts_on, ends_on, price, period, status, payment_status)
      values ($1,$2,$3,'Member ${tag}', current_date, current_date + 30, 300000, 'monthly', 'pending', 'unpaid') returning id`, [`MB-ISO${tag}-${RUN}`, S.id, S.plan])).id;
    S.event = (await one("insert into events(site_id, title, starts_at, ends_at) values ($1,$2, now() + interval '5 days', now() + interval '5 days 2 hours') returning id", [S.id, `Acara ${tag}`])).id;
    S.docContract = (await one("insert into coworking_documents(reservation_id, kind, title, file_key, file_name, content_type, size_bytes) values ($1,'contract',$2,$3,'k.pdf','application/pdf',10) returning id", [S.res, `KONTRAK-${tag}-${RUN}`, `iso/${tag}/c-${RUN}`])).id;
    S.docInvoice = (await one("insert into coworking_documents(reservation_id, kind, title, file_key, file_name, content_type, size_bytes) values ($1,'invoice',$2,$3,'i.pdf','application/pdf',10) returning id", [S.res, `INVOICE-${tag}-${RUN}`, `iso/${tag}/i-${RUN}`])).id;
    await q("insert into site_amenities(site_id, amenity_id) values ($1,$2)", [S.id, amen[0]]);
    await q("insert into unit_amenities(unit_id, amenity_id) values ($1,$2)", [S.unit, amen[1]]);
    S.invite = (await one("insert into site_staff_invites(site_id, role, email, token_hash, expires_at) values ($1,'finance',$2,$3, now() + interval '1 day') returning id",
      [S.id, `open-${tag.toLowerCase()}-${RUN}@test.invalid`, crypto.randomBytes(16).toString("hex")])).id;
    return S;
  }
  const A = await mkSite("A", ownerA);
  const B = await mkSite("B", ownerB);

  for (const r of ["superstaff", "front_office", "back_office", "finance"]) {
    await q("insert into site_staff(site_id, user_id, role) values ($1,$2,$3)", [A.id, users[r].id, r]);
  }
  await q("insert into site_staff(site_id, user_id, role) values ($1,$2,'superstaff')", [A.id, users.superstaff2.id]);
  await q("insert into site_staff(site_id, user_id, role) values ($1,$2,'front_office')", [B.id, users.staffB.id]);

  // sessions
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
  for (const k of Object.keys(users)) cookies[k] = await cookieFor(users[k]);

  // actions
  const manifest = JSON.parse(fs.readFileSync(".next/server/server-reference-manifest.json", "utf8")).node;
  const actionIndex = {};
  for (const [id, m] of Object.entries(manifest)) {
    for (const [worker, info] of Object.entries(m.workers)) {
      const route = "/" + worker.replace(/^app\//, "").replace(/\/page$/, "")
        .replace(/\[id\]/g, A.slug).replace(/\[resId\]/g, A.code).replace(/\[token\]/g, "x").replace(/\[[^\]]+\]/g, "x");
      (actionIndex[info.exportedName] ??= []).push({ id, route });
    }
  }
  const prefer = (list) => list.find((a) => /^\/site/.test(a.route)) ?? list[0];
  const F = (o = {}) => ({ F: o });
  async function call(name, args, who) {
    const ent = actionIndex[name];
    if (!ent) throw new Error(`action ${name} not in manifest`);
    const a = prefer(ent);
    const real = args.map((x) => {
      if (x && x.F) { const fd = new FormData(); for (const [k, v] of Object.entries(x.F)) fd.append(k, v); return fd; }
      return x;
    });
    const enc = await encodeReply(real);
    const headers = { Cookie: cookies[who], "Next-Action": a.id, Accept: "text/x-component" };
    if (typeof enc === "string") headers["Content-Type"] = "text/plain;charset=UTF-8";
    const res = await fetch(BASE + a.route, { method: "POST", headers, body: enc, redirect: "manual" });
    return { status: res.status, text: await res.text(), redirect: res.headers.get("x-action-redirect") };
  }
  // A refusal is the not-found answer: an action that returns {error:"Not found."}
  // or a read that throws NotFoundError (a 500 with only a digest in production).
  const refused = (r) => r.status >= 500 || /Not found\./.test(r.text);
  const page = async (p, who) => {
    const res = await fetch(BASE + p, { redirect: "manual", headers: { Cookie: cookies[who] } });
    return { status: res.status, text: res.status === 200 ? await res.text() : "" };
  };
  const route = async (method, p, who, body) => {
    const res = await fetch(BASE + p, { method, redirect: "manual", headers: { Cookie: cookies[who] }, body });
    await res.text();
    return res.status;
  };
  const fdBody = (o) => { const fd = new FormData(); for (const [k, v] of Object.entries(o)) fd.append(k, v); return fd; };

  const T1 = "2030-01-01T09:00:00+07:00", T2 = "2030-01-01T10:00:00+07:00";
  const unitForm = (S, extra = {}) => ({ id: S.unit, site_id: S.id, name: "HACK", unit_type: "private_room", letting_mode: "monthly", status: "available", capacity: "1", ...extra });

  // ── 2. cross-site: A-side people against B ──────────────────────────────
  async function snapshotB() {
    const parts = await Promise.all([
      q("select * from sites where id=$1", [B.id]),
      q("select * from lettable_units where site_id=$1 order by id", [B.id]),
      q("select r.* from unit_reservations r join lettable_units u on u.id=r.unit_id where u.site_id=$1 or r.event_id=$2 order by r.id", [B.id, B.event]),
      q("select * from reservation_items where reservation_id=$1 or item_id=$2 order by id", [B.res, B.item]),
      q("select * from memberships where site_id=$1 or plan_id=$2 order by id", [B.id, B.plan]),
      q("select * from membership_plans where site_id=$1 order by id", [B.id]),
      q("select * from events where site_id=$1 order by id", [B.id]),
      q("select * from items where site_id=$1 order by id", [B.id]),
      q("select * from coworking_documents where reservation_id=$1 or site_id=$2 order by id", [B.res, B.id]),
      q("select * from site_amenities where site_id=$1 order by amenity_id", [B.id]),
      q("select ua.* from unit_amenities ua join lettable_units u on u.id=ua.unit_id where u.site_id=$1 order by ua.unit_id, ua.amenity_id", [B.id]),
      q("select * from site_staff where site_id=$1 order by user_id, role", [B.id]),
      q("select * from site_staff_invites where site_id=$1 order by id", [B.id]),
    ]);
    return JSON.stringify(parts);
  }
  const before = await snapshotB();

  // [label, action, args]. Each is aimed at B: B's site id, or A's site id with B's record.
  const CROSS = [
    ["getSite(B)", "getSite", [B.id]],
    ["getAmenityAssignments(B)", "getAmenityAssignments", [B.id]],
    ["getSiteDashboard(B)", "getSiteDashboard", [B.id]],
    ["getSiteCalendar(B)", "getSiteCalendar", [B.id]],
    ["getReservationDetail(rB)", "getReservationDetail", [B.res]],
    ["listPlans(B)", "listPlans", [B.id]],
    ["listMemberships(B)", "listMemberships", [B.id]],
    ["listItems(B)", "listItems", [B.id]],
    ["listSiteStaff(B)", "listSiteStaff", [B.id]],
    ["updateSite(B)", "updateSite", [F({ id: B.id, name: "HACK", status: "active", site_type: "coworking" })]],
    ["setSiteAmenities(B)", "setSiteAmenities", [B.id, []]],
    ["setUnitAmenities(B, uB)", "setUnitAmenities", [B.id, B.unit, []]],
    ["setUnitAmenities(A, uB)", "setUnitAmenities", [A.id, B.unit, []]],
    ["createUnit(B)", "createUnit", [F({ site_id: B.id, name: "HACK", unit_type: "private_room", letting_mode: "monthly" })]],
    ["updateUnit(uB, site B)", "updateUnit", [F(unitForm(B))]],
    ["updateUnit(uB, site A)", "updateUnit", [F(unitForm(B, { site_id: A.id }))]],
    ["updateUnit(uB, no site)", "updateUnit", [F(unitForm(B, { site_id: "" }))]],
    ["retireUnit(uB, site A)", "retireUnit", [F({ id: B.unit, site_id: A.id })]],
    ["createItem(B)", "createItem", [B.id, F({ name: "HACK" })]],
    ["createPlan(B)", "createPlan", [B.id, F({ name: "HACK" })]],
    ["addReservationItem(rB)", "addReservationItem", [B.res, F({ name: "HACK", qty: "1" })]],
    ["addReservationItem(rA, item B)", "addReservationItem", [A.res, F({ item_id: B.item, qty: "1" })]],
    ["removeReservationItem(rB, riB)", "removeReservationItem", [B.res, B.resItem]],
    ["removeReservationItem(rA, riB)", "removeReservationItem", [A.res, B.resItem]],
    ["setReservationUtilities(rB)", "setReservationUtilities", [B.res, true]],
    ["removeDocument(rB, docB)", "removeDocument", [B.res, B.docContract]],
    ["removeDocument(rA, docB)", "removeDocument", [A.res, B.docContract]],
    ["createMembership(B)", "createMembership", [B.id, F({ member_name: "HACK", starts_on: "2030-01-01", ends_on: "2030-02-01" })]],
    ["createMembership(A, plan B)", "createMembership", [A.id, F({ member_name: "HACK", starts_on: "2030-01-01", ends_on: "2030-02-01", plan_id: B.plan })]],
    ["setMembershipStatus(A, mB)", "setMembershipStatus", [A.id, B.mem, "cancelled"]],
    ["setMembershipStatus(B, mB)", "setMembershipStatus", [B.id, B.mem, "cancelled"]],
    ["setMembershipPayment(A, mB)", "setMembershipPayment", [A.id, B.mem, "pending_verification"]],
    ["setMembershipPayment(B, mB)", "setMembershipPayment", [B.id, B.mem, "pending_verification"]],
    ["createEvent(B)", "createEvent", [B.id, F({ title: "HACK", starts_at: "2030-01-01T09:00", ends_at: "2030-01-01T10:00" })]],
    ["bookRoomForEvent(A, eB, uA)", "bookRoomForEvent", [A.id, B.event, A.unit, T1, T2, 0]],
    ["bookRoomForEvent(B, eB, uB)", "bookRoomForEvent", [B.id, B.event, B.unit, T1, T2, 0]],
    ["setEventStatus(A, eB)", "setEventStatus", [A.id, B.event, "cancelled"]],
    ["setEventStatus(B, eB)", "setEventStatus", [B.id, B.event, "cancelled"]],
    ["inviteSiteStaffForm(B)", "inviteSiteStaffForm", [null, F({ site_id: B.id, role: "finance", email: `hack-${RUN}@test.invalid` })]],
    ["revokeSiteStaffRoleForm(B)", "revokeSiteStaffRoleForm", [null, F({ site_id: B.id, user_id: users.staffB.id, role: "front_office" })]],
    ["revokeSiteStaffInviteForm(B)", "revokeSiteStaffInviteForm", [null, F({ invite_id: B.invite })]],
  ];
  console.log(`Cross-site: ${CROSS.length} actions × ${A_SIDE.length} people`);
  for (const [label, name, args] of CROSS) {
    for (const who of A_SIDE) {
      const r = await call(name, args, who);
      check(refused(r) && !r.text.includes(B.name), `cross-site ${label}: ${who} refused (HTTP ${r.status})`);
    }
  }
  const CROSS_ROUTES = [
    ["GET", `/api/admin/coworking/documents?id=${B.docContract}`, null, "GET contract B"],
    ["GET", `/api/admin/coworking/documents?id=${B.docInvoice}`, null, "GET invoice B"],
    ["POST", "/api/admin/coworking/documents", { reservation_id: B.res }, "POST reservation B"],
    ["POST", "/api/admin/coworking/documents", { reservation_id: B.res, site_id: A.id }, "POST reservation B claiming site A"],
    ["POST", "/api/admin/coworking/documents", { unit_id: B.unit }, "POST unit B"],
    ["POST", "/api/admin/coworking/documents", { unit_id: B.unit, site_id: A.id }, "POST unit B claiming site A"],
    ["POST", "/api/admin/coworking/documents", { site_id: B.id }, "POST site B"],
  ];
  for (const [method, p, body, label] of CROSS_ROUTES) {
    for (const who of [...A_SIDE, "superadmin"]) {
      // superadmin reaches B; only the mismatched claims must be refused for them
      const mismatch = body && body.site_id === A.id;
      if (who === "superadmin" && !mismatch) continue;
      const status = await route(method, p, who, body ? fdBody(body) : undefined);
      check(status === 404, `cross-site route ${label}: ${who} → 404 (got ${status})`);
    }
  }
  // A's reservation claiming site B — the record wins, so an A person with documents still gets 404.
  check(await route("POST", "/api/admin/coworking/documents", "back_office", fdBody({ reservation_id: A.res, site_id: B.id })) === 404,
    "route POST reservation A claiming site B: back_office → 404");
  const CROSS_PAGES = [`/site/${B.slug}`, `/site/${B.slug}/dashboard`, `/site/${B.slug}/members`, `/site/${B.slug}/calendar`, `/site/${B.slug}/staff`, `/site/booking/${B.code}`, `/site/${B.id}`];
  for (const p of CROSS_PAGES) {
    for (const who of A_SIDE) {
      const r = await page(p, who);
      check(r.status !== 200 && !r.text.includes(B.name), `cross-site page ${p.replace(RUN, "…")}: ${who} refused (HTTP ${r.status})`);
    }
  }
  const after = await snapshotB();
  check(before === after, "site B's rows are unchanged after every cross-site attempt");

  // ── 3. matrix on A ──────────────────────────────────────────────────────
  const freshResItem = async () => (await one("insert into reservation_items(reservation_id, name, qty) values ($1,'Tmp',1) returning id", [A.res])).id;
  const freshDoc = async () => (await one("insert into coworking_documents(reservation_id, kind, file_key, file_name, content_type, size_bytes) values ($1,'other',$2,'t.pdf','application/pdf',1) returning id", [A.res, `iso/A/tmp-${crypto.randomUUID()}`])).id;
  const freshInvite = async () => (await one("insert into site_staff_invites(site_id, role, email, token_hash, expires_at) values ($1,'finance',$2,$3, now()+interval '1 day') returning id", [A.id, `tmp-${crypto.randomUUID()}@test.invalid`, crypto.randomUUID()])).id;
  const freshFo2 = async () => { await q("insert into site_staff(site_id, user_id, role) values ($1,$2,'front_office') on conflict do nothing", [A.id, users.fo2.id]); return users.fo2.id; };

  // [action, args (or async () => args), anyOf]
  const MATRIX = [
    ["getSite", [A.id], ["site.view"]],
    ["getAmenityAssignments", [A.id], ["site.view"]],
    ["getSiteDashboard", [A.id], ["site.view"]],
    ["getSiteCalendar", [A.id], ["site.reservations.view"]],
    ["getReservationDetail", [A.res], ["site.reservations.view"]],
    ["listPlans", [A.id], ["site.members.view", "site.catalog"]],
    ["listMemberships", [A.id], ["site.members.view"]],
    ["listItems", [A.id], ["site.reservations", "site.catalog"]],
    ["listSiteStaff", [A.id], ["site.staff"]],
    ["updateSite", [F({ id: A.id })], ["site.settings"]],
    ["setSiteAmenities", [A.id, [amen[0]]], ["site.settings"]],
    ["createUnit", [F({ site_id: A.id })], ["site.units"]],
    ["updateUnit", [F({ id: A.unit, site_id: A.id })], ["site.units"]],
    ["retireUnit", [F({ id: A.retired, site_id: A.id })], ["site.units"]],
    ["setUnitAmenities", [A.id, A.unit, [amen[1]]], ["site.units"]],
    ["createItem", [A.id, F()], ["site.catalog"]],
    ["createPlan", [A.id, F()], ["site.catalog"]],
    ["addReservationItem", [A.res, F({ qty: "0" })], ["site.reservations"]],
    ["removeReservationItem", async () => [A.res, await freshResItem()], ["site.reservations"]],
    ["setReservationUtilities", [A.res, true], ["site.reservations"]],
    ["createMembership", [A.id, F()], ["site.members"]],
    ["setMembershipStatus", [A.id, A.mem, "bogus"], ["site.members"]],
    ["setMembershipPayment", [A.id, A.mem, "bogus"], ["site.billing"]],
    ["createEvent", [A.id, F()], ["site.events"]],
    ["bookRoomForEvent", [A.id, A.event, A.retired, T1, T2, 0], ["site.events"]],
    ["setEventStatus", [A.id, A.event, "bogus"], ["site.events"]],
    ["removeDocument", async () => [A.res, await freshDoc()], ["site.documents"]],
    ["inviteSiteStaffForm", [null, F({ site_id: A.id, role: "finance", email: "not-an-email" })], ["site.staff"]],
    ["revokeSiteStaffInviteForm", async () => [null, F({ invite_id: await freshInvite() })], ["site.staff"]],
    ["revokeSiteStaffRoleForm", async () => [null, F({ site_id: A.id, user_id: await freshFo2(), role: "front_office" })], ["site.staff"]],
  ];
  console.log(`Matrix: ${MATRIX.length} actions × ${PEOPLE.length} people`);
  for (const [name, argsOrFn, need] of MATRIX) {
    for (const who of PEOPLE) {
      const args = typeof argsOrFn === "function" ? await argsOrFn() : argsOrFn;
      const allowed = canOnA(who, need);
      const r = await call(name, args, who);
      if (process.env.DEBUG_ACTIONS && allowed === refused(r)) console.log("   ·", name, who, r.status, JSON.stringify(r.text.slice(0, 300)));
      check(allowed ? !refused(r) : refused(r), `matrix ${name}: ${who} ${allowed ? "allowed" : "refused"} (HTTP ${r.status})`);
    }
  }
  const ROUTES = [
    ["GET", `/api/admin/coworking/documents?id=${A.docContract}`, null, ["site.documents"], "GET contract A"],
    ["GET", `/api/admin/coworking/documents?id=${A.docInvoice}`, null, ["site.documents", "site.documents.view"], "GET invoice A"],
    ["POST", "/api/admin/coworking/documents", { reservation_id: A.res }, ["site.documents"], "POST reservation A (no file)"],
    ["POST", "/api/admin/coworking/documents", { unit_id: A.unit, site_id: A.id }, ["site.documents"], "POST unit A (no file)"],
  ];
  for (const [method, p, body, need, label] of ROUTES) {
    for (const who of PEOPLE) {
      const allowed = canOnA(who, need);
      const status = await route(method, p, who, body ? fdBody(body) : undefined);
      check(allowed ? status !== 404 : status === 404, `matrix route ${label}: ${who} ${allowed ? "allowed" : "refused"} (HTTP ${status})`);
    }
  }
  const PAGES = [
    [`/site/${A.slug}`, ["site.view"]],
    [`/site/${A.slug}/dashboard`, ["site.view"]],
    [`/site/${A.slug}/members`, ["site.members.view"]],
    [`/site/${A.slug}/calendar`, ["site.reservations.view"]],
    [`/site/${A.slug}/staff`, ["site.staff"]],
    [`/site/booking/${A.code}`, ["site.reservations.view"]],
  ];
  for (const [p, need] of PAGES) {
    for (const who of PEOPLE) {
      const allowed = canOnA(who, need);
      const r = await page(p, who);
      check(allowed ? r.status === 200 : r.status !== 200, `matrix page ${p.replace(RUN, "…")}: ${who} ${allowed ? "opens" : "refused"} (HTTP ${r.status})`);
    }
  }

  // ── 4. money visibility ────────────────────────────────────────────────
  for (const who of [...A_SIDE, "superadmin", "admin_general", "admin_finance"]) {
    const perms = permsOnA(who);
    const dash = await page(`/site/${A.slug}/dashboard`, who);
    check(dash.text.includes("Sewa terikat") === perms.includes("site.revenue"), `dashboard "Sewa terikat": ${who} ${perms.includes("site.revenue") ? "sees" : "does not see"} it`);
    check(dash.text.includes("Tagihan belum dibayar") === perms.includes("site.billing"), `dashboard billing tiles: ${who} ${perms.includes("site.billing") ? "sees" : "does not see"} them`);
    check(dash.text.includes("777.000") === perms.includes("site.billing"), `dashboard instalment amount: ${who} ${perms.includes("site.billing") ? "sees" : "does not see"} it`);
    const bk = await page(`/site/booking/${A.code}`, who);
    for (const label of ["HPP konsumsi", "Margin", "Barang terjual"]) {
      check(bk.text.includes(label) === perms.includes("site.revenue"), `booking "${label}": ${who} ${perms.includes("site.revenue") ? "sees" : "does not see"} it`);
    }
    check(bk.text.includes("Nilai kontrak"), `booking "Nilai kontrak": ${who} sees it`);
    const seesContract = perms.includes("site.documents");
    const seesInvoice = seesContract || perms.includes("site.documents.view");
    check(bk.text.includes(`KONTRAK-A-${RUN}`) === seesContract, `booking contract document: ${who} ${seesContract ? "sees" : "does not see"} it`);
    check(bk.text.includes(`INVOICE-A-${RUN}`) === seesInvoice, `booking invoice document: ${who} ${seesInvoice ? "sees" : "does not see"} it`);
    const detail = await call("getReservationDetail", [A.res], who);
    check(/"margin":null/.test(detail.text) === !perms.includes("site.revenue"), `getReservationDetail margin field: ${who} ${perms.includes("site.revenue") ? "gets a number" : "gets null"}`);
    const mem = await page(`/site/${A.slug}/members`, who);
    if (mem.status === 200) {
      check(mem.text.includes("belum lunas") === perms.includes("site.billing"), `members unpaid notice: ${who} ${perms.includes("site.billing") ? "sees" : "does not see"} it`);
    }
  }

  // ── 5. escalation ──────────────────────────────────────────────────────
  {
    const n0 = (await one("select count(*)::int n from site_staff_invites where site_id=$1 and role='superstaff'", [A.id])).n;
    const r = await call("inviteSiteStaffForm", [null, F({ site_id: A.id, role: "superstaff", email: `ss-${RUN}@test.invalid` })], "superstaff");
    const n1 = (await one("select count(*)::int n from site_staff_invites where site_id=$1 and role='superstaff'", [A.id])).n;
    check(/Hanya pemilik/.test(r.text) && n1 === n0, "superstaff cannot invite a superstaff");
    const ok = await call("inviteSiteStaffForm", [null, F({ site_id: A.id, role: "front_office", email: `fo-${RUN}@test.invalid` })], "superstaff");
    check(/\/invite\/site\//.test(ok.text), "superstaff can invite a front_office");
    const r2 = await call("revokeSiteStaffRoleForm", [null, F({ site_id: A.id, user_id: users.superstaff2.id, role: "superstaff" })], "superstaff");
    const still = await one("select count(*)::int n from site_staff where site_id=$1 and user_id=$2 and role='superstaff'", [A.id, users.superstaff2.id]);
    check(/Hanya pemilik/.test(r2.text) && still.n === 1, "superstaff cannot revoke another superstaff");
    const r3 = await call("revokeSiteStaffRoleForm", [null, F({ site_id: A.id, user_id: users.ownerA.id, role: "superstaff" })], "superstaff");
    check(/Hanya pemilik|Not found/.test(r3.text), "superstaff cannot revoke the owner");
    const r4 = await call("inviteSiteStaffForm", [null, F({ site_id: A.id, role: "superstaff", email: `ss2-${RUN}@test.invalid` })], "ownerA");
    check(/\/invite\/site\//.test(r4.text), "site owner can invite a superstaff");
  }
  {
    const valid = { id: A.id, name: A.name, status: "active", site_type: "coworking" };
    const r = await call("updateSite", [F({ ...valid, owner_id: ownerB })], "ownerA");
    const cur = await one("select owner_id from sites where id=$1", [A.id]);
    check(/Hanya superadmin/.test(r.text) && cur.owner_id === ownerA, "site owner cannot change owner_id");
    const r5 = await call("updateSite", [F({ ...valid, owner_id: ownerB })], "superstaff");
    check(/Hanya superadmin/.test(r5.text) && (await one("select owner_id from sites where id=$1", [A.id])).owner_id === ownerA, "superstaff cannot change owner_id");
    const r6 = await call("updateSite", [F({ ...valid, owner_id: ownerB })], "admin_general");
    check(/Hanya superadmin/.test(r6.text) && (await one("select owner_id from sites where id=$1", [A.id])).owner_id === ownerA, "admin_general cannot change owner_id");
    const r7 = await call("updateSite", [F({ ...valid, notes: `edited-${RUN}` })], "back_office");
    check(!refused(r7) && (await one("select notes, owner_id from sites where id=$1", [A.id])).notes === `edited-${RUN}`
      && (await one("select owner_id from sites where id=$1", [A.id])).owner_id === ownerA, "back_office edits site details without touching owner_id");
    const r8 = await call("updateSite", [F({ ...valid, owner_id: ownerB })], "superadmin");
    check(!refused(r8) && (await one("select owner_id from sites where id=$1", [A.id])).owner_id === ownerB, "superadmin can change owner_id");
    await q("update sites set owner_id=$1 where id=$2", [ownerA, A.id]);
    const c1 = await call("createSite", [F({ name: `SITEISO-C-${RUN}`, owner_id: ownerA })], "admin_general");
    check(/Hanya superadmin/.test(c1.text) && !(await one("select 1 x from sites where name=$1", [`SITEISO-C-${RUN}`])), "admin_general cannot set owner_id when creating a site");
    for (const who of ["ownerA", "superstaff", "back_office"]) {
      const c = await call("createSite", [F({ name: `SITEISO-D-${who}-${RUN}` })], who);
      check(!(await one("select 1 x from sites where name=$1", [`SITEISO-D-${who}-${RUN}`])) && (c.status >= 500 || /permission|signed in as staff/.test(c.text)), `${who} cannot create a site (HTTP ${c.status})`);
    }
    for (const who of ["ownerA", "superstaff", "admin_general"]) {
      const lo = await call("listOwnerOptions", [], who);
      check(lo.status >= 500 || /Admin access required/.test(lo.text), `listOwnerOptions refused for ${who}`);
    }
  }
  {
    // revocation takes effect on the next request
    await freshFo2();
    const cookieFo2 = cookies.fo2;
    const okBefore = await call("createMembership", [A.id, F()], "fo2");
    check(!refused(okBefore), "fo2 (front_office) can create memberships before revocation");
    const rv = await call("revokeSiteStaffRoleForm", [null, F({ site_id: A.id, user_id: users.fo2.id, role: "front_office" })], "ownerA");
    check(/"success":true/.test(rv.text), "owner revokes fo2's front_office role");
    const okAfter = await call("createMembership", [A.id, F()], "fo2");
    check(refused(okAfter), "fo2 is refused on the very next request (same session cookie)");
    check(cookies.fo2 === cookieFo2, "…with the same session, not a new sign-in");
    const pg = await page(`/site/${A.slug}`, "fo2");
    check(pg.status !== 200, "fo2's site page is refused after revocation");

    await q("update owners set portal_access='revoked' where id=$1", [ownerA]);
    const g = await call("getSite", [A.id], "ownerA");
    check(refused(g), "a site owner whose portal access is revoked is refused on the next request");
    await q("update owners set portal_access='active' where id=$1", [ownerA]);
    const g2 = await call("getSite", [A.id], "ownerA");
    check(!refused(g2), "…and allowed again once restored");
  }

  // ── 6. invites ──────────────────────────────────────────────────────────
  {
    const mk = async (email, role = "back_office") => {
      const r = await call("inviteSiteStaffForm", [null, F({ site_id: A.id, role, email })], "ownerA");
      const m = r.text.match(/\/invite\/site\/([A-Za-z0-9_-]{20,})/);
      return m ? m[1] : null;
    };
    const accept = (token, who) => call("acceptSiteStaffInvite", [null, F({ token })], who);
    const isStaff = async (who, role) => !!(await one("select 1 x from site_staff where site_id=$1 and user_id=$2 and role=$3", [A.id, users[who].id, role]));

    const tok = await mk(users.inviteeX.email.toUpperCase()); // stored lower-cased
    check(!!tok, "owner gets an invite link");
    const row = await one("select * from site_staff_invites where token_hash=$1", [crypto.createHash("sha256").update(tok ?? "").digest("hex")]);
    check(!!row && row.email === users.inviteeX.email.toLowerCase() && !JSON.stringify(row).includes(tok), "only the token's hash is stored, email lower-cased");

    const wrong = await accept(crypto.randomBytes(32).toString("base64url"), "inviteeX");
    check(/tidak valid/.test(wrong.text) && !(await isStaff("inviteeX", "back_office")), "wrong token is refused");
    const other = await accept(tok, "inviteeY");
    if (process.env.DEBUG_ACTIONS) console.log("   · accept other", other.status, other.text.slice(0, 1500));
    check(/email lain/.test(other.text) && !(await isStaff("inviteeY", "back_office")), "another account's email is refused");
    const good = await accept(tok, "inviteeX");
    check(!!good.redirect && await isStaff("inviteeX", "back_office"), `the invited account redeems it (redirect ${good.redirect})`);
    const twice = await accept(tok, "inviteeX");
    check(/sudah dipakai/.test(twice.text), "the same invite cannot be used twice");
    const g = await call("getSite", [A.id], "inviteeX");
    const gB = await call("getSite", [B.id], "inviteeX");
    check(!refused(g) && refused(gB), "the new back_office reaches site A and not site B");

    const tokE = await mk(users.inviteeZ.email);
    await q("update site_staff_invites set expires_at = now() - interval '1 minute' where token_hash=$1", [crypto.createHash("sha256").update(tokE).digest("hex")]);
    const exp = await accept(tokE, "inviteeZ");
    check(/kedaluwarsa/.test(exp.text) && !(await isStaff("inviteeZ", "back_office")), "an expired invite is refused");

    const tokR = await mk(users.inviteeZ.email, "finance");
    const idR = (await one("select id from site_staff_invites where token_hash=$1", [crypto.createHash("sha256").update(tokR).digest("hex")])).id;
    const rv = await call("revokeSiteStaffInviteForm", [null, F({ invite_id: idR })], "ownerA");
    check(/"success":true/.test(rv.text), "owner revokes an open invite");
    const revd = await accept(tokR, "inviteeZ");
    check(/dicabut/.test(revd.text) && !(await isStaff("inviteeZ", "finance")), "a revoked invite is refused");

    // An account under the invited address whose email is not confirmed:
    // registering someone else's address does not make you them.
    const tokU = await mk(users.inviteeU.email, "front_office");
    await q("update auth.users set email_confirmed_at = null where id=$1", [users.inviteeU.id]);
    const unconf = await accept(tokU, "inviteeU");
    check(/belum dikonfirmasi/.test(unconf.text) && !(await isStaff("inviteeU", "front_office")), "an unconfirmed email cannot redeem an invite");
    const stillOpen = await one("select redeemed_at from site_staff_invites where token_hash=$1", [crypto.createHash("sha256").update(tokU).digest("hex")]);
    check(stillOpen.redeemed_at === null, "…and the invite is not consumed by the attempt");
    await q("update auth.users set email_confirmed_at = now() where id=$1", [users.inviteeU.id]);
    const conf = await accept(tokU, "inviteeU");
    check(!!conf.redirect && await isStaff("inviteeU", "front_office"), "once confirmed, the same invite redeems");

    const page1 = await fetch(`${BASE}/invite/site/${tok}`, { redirect: "manual" });
    check(page1.status >= 300 && page1.status < 400 && /auth\/login/.test(page1.headers.get("location") ?? ""), "signed-out visitor to an invite is sent to sign in, then back");
  }

  // ── 6b. the invite table and function are service-role only ────────────
  {
    const anon = createClient(SUPA, ANON, { auth: { persistSession: false } });
    const sel = await anon.from("site_staff_invites").select("id").limit(1);
    check(!!sel.error, `anon cannot read site_staff_invites (${sel.error?.code ?? "no error"})`);
    const rpc = await anon.rpc("redeem_site_staff_invite", { p_token_hash: "x", p_user_id: users.nobody.id });
    check(!!rpc.error && !/invite_/.test(rpc.error.message), `anon cannot execute redeem_site_staff_invite (${rpc.error?.code ?? "no error"})`);
    const g = await one(`select has_function_privilege('authenticated','public.redeem_site_staff_invite(text,uuid)','execute') a,
      has_table_privilege('authenticated','public.site_staff_invites','select') b,
      has_table_privilege('authenticated','public.site_staff','select') c,
      (select relrowsecurity from pg_class where oid='public.site_staff_invites'::regclass) rls`);
    check(!g.a && !g.b && !g.c && g.rls, "authenticated holds no grant on site_staff / site_staff_invites / redeem; RLS on");
  }

  // ── 7. B4: createMembership ignores payment_status ─────────────────────
  {
    const n0 = (await one("select count(*)::int n from ledger_entries")).n;
    const name = `B4-${RUN}`;
    const r = await call("createMembership", [A.id, F({ member_name: name, starts_on: "2030-01-01", ends_on: "2030-12-31", price: "100000", status: "active", payment_status: "paid" })], "front_office");
    const m = await one("select payment_status from memberships where member_name=$1", [name]);
    const n1 = (await one("select count(*)::int n from ledger_entries")).n;
    check(!refused(r) && m?.payment_status === "unpaid", "createMembership with payment_status=paid stores it unpaid");
    check(n1 === n0, "…and posts nothing to the ledger");
  }

  // ── 7b. a paid membership cannot leave 'paid' (no refund policy yet) ───
  {
    const name = `PAID-${RUN}`;
    const [{ id: mid }] = await q(`insert into memberships(membership_code, site_id, member_name, starts_on, ends_on, price, period, status, payment_status)
      values ($1,$2,$3, current_date, current_date + 30, 250000, 'monthly', 'pending', 'unpaid') returning id`, [`MB-PAID-${RUN}`, A.id, name]);
    const refundedFromUnpaid = await call("setMembershipPayment", [A.id, mid, "refunded"], "superadmin");
    check(/Refund membership belum/.test(refundedFromUnpaid.text)
      && (await one("select payment_status from memberships where id=$1", [mid])).payment_status === "unpaid",
      "'refunded' is refused even from unpaid (superadmin)");
    const settle = await call("setMembershipPayment", [A.id, mid, "paid"], "finance");
    check(!refused(settle) && (await one("select payment_status from memberships where id=$1", [mid])).payment_status === "paid",
      "finance settles a membership to paid through settle_membership_payment");
    const ledger0 = JSON.stringify(await q("select id from ledger_entries order by id"));
    for (const who of ["finance", "ownerA", "superstaff", "admin_finance", "superadmin"]) {
      for (const to of ["refunded", "unpaid", "pending_verification"]) {
        const r = await call("setMembershipPayment", [A.id, mid, to], who);
        const st = (await one("select payment_status from memberships where id=$1", [mid])).payment_status;
        check(/Refund membership belum/.test(r.text) && st === "paid", `paid → ${to} refused for ${who} (still ${st})`);
      }
    }
    const ledger1 = JSON.stringify(await q("select id from ledger_entries order by id"));
    check(ledger0 === ledger1, "the ledger is untouched by every refused transition");
    const again = await call("setMembershipPayment", [A.id, mid, "paid"], "finance");
    check(/Sudah lunas sebelumnya/.test(again.text) && JSON.stringify(await q("select id from ledger_entries order by id")) === ledger1,
      "paid → paid again posts nothing");
    const pg = await page(`/site/${A.slug}/members`, "finance");
    check(pg.text.includes(name) && !/<option value="refunded"/.test(pg.text), "members page offers no 'refunded' option");
  }

  // ── 8. sidebar ──────────────────────────────────────────────────────────
  const sidebarHrefs = (html) => {
    const i = html.indexOf("data-app-sidebar");
    if (i < 0) return [];
    const chunk = html.slice(i, html.indexOf("</aside>", i));
    return [...chunk.matchAll(/href="([^"]+)"/g)].map((m) => m[1]).filter((h) => h.startsWith("/site"));
  };
  const SITE_PAGES = [["", ["site.view"]], ["/dashboard", ["site.view"]], ["/members", ["site.members.view"]], ["/calendar", ["site.reservations.view"]], ["/staff", ["site.staff"]]];
  for (const who of A_SIDE) {
    const r = await page(`/site/${A.slug}/dashboard`, who);
    const hrefs = sidebarHrefs(r.text);
    const expected = SITE_PAGES.filter(([, need]) => canOnA(who, need)).map(([p]) => `/site/${A.slug}${p}`);
    check(sameSet([...new Set(hrefs)], expected), `sidebar for ${who}: exactly ${expected.map((h) => h.replace(`/site/${A.slug}`, "") || "/").join(" ")} (got ${[...new Set(hrefs)].map((h) => h.replace(`/site/${A.slug}`, "") || "/").join(" ")})`);
    check(!hrefs.some((h) => h.includes(B.slug)), `sidebar for ${who}: no link into site B`);
    for (const h of expected) check((await page(h, who)).status === 200, `sidebar link ${h.replace(RUN, "…")} opens for ${who}`);
  }
  {
    const r = await page(`/site/${A.slug}`, "superadmin");
    const hrefs = sidebarHrefs(r.text);
    check(hrefs.includes("/site") && hrefs.includes(`/site/${A.slug}/staff`) && hrefs.includes(`/site/${B.slug}`), "superadmin sidebar: All sites, both sites, staff pages");
    const g = await page(`/site/${A.slug}`, "admin_general");
    check(!sidebarHrefs(g.text).includes(`/site/${A.slug}/staff`), "admin_general sidebar: no staff page");
    const l = await page("/site", "ownerA");
    check(l.status === 307 || l.status === 308, `/site for a one-site owner redirects to that site (HTTP ${l.status})`);
  }

  await db.end();
  console.log(`\n${pass.length} passed, ${fail.length} failed`);
  process.exit(fail.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
