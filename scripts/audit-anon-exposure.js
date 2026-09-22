#!/usr/bin/env node
/**
 * Anon / authenticated exposure audit.
 *
 * §19.12 of the system reference: what a page renders is not what the database
 * will answer. This asks the database directly, as the two roles that any
 * visitor can obtain — the anon key ships in the client bundle, and an
 * authenticated session is one sign-up away.
 *
 * For every table it issues a real `select=*` through PostgREST and records the
 * columns that actually came back. Schema inspection is not evidence: a table
 * can hold RLS with a permissive policy, or a grant nobody remembers.
 *
 *   node scripts/audit-anon-exposure.js            # report
 *   node scripts/audit-anon-exposure.js --verify   # expect flagged tables closed
 *
 * Exits non-zero under --verify if anything sensitive is still readable.
 */

const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

const envPath = path.join(__dirname, "..", ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const SUPA = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const VERIFY = process.argv.includes("--verify");

const admin = createClient(SUPA, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const TABLES = [
  "area_overviews", "availability_blocks", "bookings", "consultations",
  "cron_runs", "ledger_entries", "owner_change_requests", "owner_documents",
  "owner_invites", "owners", "pending_survey_imports", "placements",
  "platform_settings", "properties", "property_details", "property_media",
  "property_surveys", "publish_checklist", "reviews", "rla_assessments",
  "saved_listings", "short_stay_rates", "survey_import_log", "user_credits",
  "users", "viewings",
];

/**
 * Columns whose disclosure to a stranger is the finding. Grouped by what kind
 * of harm exposure does, because "PII" flattens distinctions that matter:
 * an occupancy date says a home is empty, which is not the same problem as a
 * phone number.
 */
const SENSITIVE = {
  contact:   ["email", "phone", "phone_whatsapp", "pic_whatsapp", "pic_name",
              "payer_email", "surveyor_name", "name", "full_name"],
  identity:  ["id_number", "id_type", "verification_status", "object_key",
              "payment_proof_url", "original_name"],
  financial: ["amount", "payout_bank", "payout_account_number", "payout_account_holder",
              "monthly_rent", "commission_amount", "commission_pct", "total_price",
              "deposit_amount", "final_price",
              "credit_applied", "bank_transfer_code", "payment_external_id",
              "token_hash", "proposed", "previous"],
  occupancy: ["check_in_date", "check_out_date", "start_date", "end_date",
              "scheduled_at", "preferred_dates", "attended", "guests",
              "lease_start_date", "address", "google_maps_url"],
};

/**
 * Published prices are disclosure, not leakage: a guest has to see the nightly
 * rate and the security deposit before they can agree to pay them. Flagging
 * them trains the reader to skim past real findings.
 */
const PRICE_IS_PUBLIC = new Set(["short_stay_rates", "properties"]);
const PRICE_COLUMNS = new Set([
  "security_deposit", "price_per_night", "price_per_night_weekend",
  "price_per_week", "price_per_month", "cleaning_fee", "price_monthly", "price",
]);

function classify(col, table) {
  if (PRICE_IS_PUBLIC.has(table) && PRICE_COLUMNS.has(col)) return null;
  for (const [kind, cols] of Object.entries(SENSITIVE)) {
    if (cols.includes(col)) return kind;
  }
  return null;
}

/** Tables where ANY readable row is a finding — nothing here is public data. */
const MUST_BE_CLOSED = new Set([
  "owners", "users", "bookings", "availability_blocks", "viewings", "placements",
  "consultations", "ledger_entries", "owner_change_requests", "owner_documents",
  "owner_invites", "user_credits", "saved_listings", "cron_runs",
  "platform_settings", "property_surveys", "pending_survey_imports",
  "survey_import_log",
]);

/**
 * `limit=1` returning a row proves nothing on its own: for a table with a
 * correct own-row policy, that row is the caller's own and the table is behaving
 * exactly as intended. This is what made the first run of this audit report
 * `users` as leaking every account's email — a guest sees one row of twenty-one,
 * their own. The count header is what separates the two cases, so every probe
 * asks for it and the caller compares against the true total.
 */
async function probe(table, token) {
  const res = await fetch(
    `${SUPA}/rest/v1/${table}?select=*&limit=1`,
    { headers: { apikey: ANON, Authorization: `Bearer ${token}`, Prefer: "count=exact" } }
  );
  const visible = Number((res.headers.get("content-range") ?? "*/0").split("/")[1]) || 0;
  const body = await res.json().catch(() => null);

  if (!res.ok) {
    return { readable: false, reason: body?.code ?? String(res.status), columns: [], visible: 0 };
  }
  if (!Array.isArray(body) || body.length === 0) {
    // 200 with no rows: the grant allows the read, RLS returned nothing. Worth
    // distinguishing — an empty table today is not a closed door tomorrow.
    return { readable: true, reason: "200 empty", columns: [], visible };
  }
  return { readable: true, reason: "200 rows", columns: Object.keys(body[0]), visible };
}

async function guestToken() {
  const email = `audit-${Date.now()}@test.invalid`;
  const password = "AuditProbe!13579";
  const { data, error } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
  });
  if (error) throw new Error(`createUser: ${error.message}`);
  const pub = createClient(SUPA, ANON, { auth: { persistSession: false } });
  const { data: s, error: e2 } = await pub.auth.signInWithPassword({ email, password });
  if (e2) throw new Error(`signIn: ${e2.message}`);
  return { token: s.session.access_token, userId: data.user.id };
}

(async () => {
  const guest = await guestToken();
  const findings = [];
  const rows = [];

  for (const table of TABLES) {
    const a = await probe(table, ANON);
    const g = await probe(table, guest.token);

    for (const [role, r] of [["anon", a], ["authenticated", g]]) {
      const { count: total } = await admin
        .from(table).select("*", { count: "exact", head: true });
      const everything = r.visible >= (total ?? 0) && (total ?? 0) > 0;

      rows.push({ table, role, readable: r.readable, reason: r.reason,
                  columns: r.columns, visible: r.visible, total: total ?? 0, everything });

      if (r.columns.length > 0) {
        const flagged = r.columns
          .map((c) => ({ col: c, kind: classify(c, table) }))
          .filter((x) => x.kind);

        // Seeing SOME rows of a table with an own-row policy is the policy
        // working. Only seeing them ALL is the finding.
        if (everything && (flagged.length || MUST_BE_CLOSED.has(table))) {
          findings.push({ table, role, flagged, all: r.columns,
                          visible: r.visible, total: total ?? 0 });
        }
      }
    }
  }

  // ── Report ───────────────────────────────────────────────────────────────
  const w = (s, n) => String(s).padEnd(n);
  console.log("\n" + w("TABLE", 24) + w("ROLE", 16) + w("VISIBLE", 13) + "COLUMNS RETURNED");
  console.log("-".repeat(100));
  for (const r of rows) {
    const result = !r.readable ? "denied"
      : r.columns.length === 0 ? "no rows"
      : r.everything ? `ALL ${r.visible}/${r.total}`
      : `own ${r.visible}/${r.total}`;
    const cols = r.columns.length
      ? r.columns.map((c) => (classify(c, r.table) ? `*${c}` : c)).join(", ")
      : r.readable ? "(no rows)" : r.reason;
    console.log(w(r.table, 24) + w(r.role, 16) + w(result, 13) + cols.slice(0, 190));
  }

  console.log("\n\nFLAGGED — sensitive columns returned to a role any visitor can hold");
  console.log("-".repeat(100));
  if (findings.length === 0) {
    console.log("  none");
  } else {
    for (const f of findings) {
      const by = {};
      for (const x of f.flagged) (by[x.kind] ??= []).push(x.col);
      console.log(`\n  ${f.table}  [${f.role}]  ${f.visible}/${f.total} rows readable`);
      for (const [kind, cols] of Object.entries(by)) {
        console.log(`    ${w(kind, 11)} ${cols.join(", ")}`);
      }
      if (f.flagged.length === 0) {
        console.log(`    ${w("scope", 11)} table should not be readable at all`);
      }
    }
  }

  await admin.from("saved_listings").delete().eq("user_id", guest.userId);
  await admin.auth.admin.deleteUser(guest.userId).catch(() => {});

  const openCount = findings.length;
  console.log(`\n\n${rows.filter((r) => r.columns.length).length} table/role pairs returned data; ${openCount} flagged.\n`);

  if (VERIFY && openCount > 0) {
    console.error(`VERIFY FAILED: ${openCount} table/role pairs still expose sensitive data.\n`);
    process.exit(1);
  }
  process.exit(0);
})().catch((e) => {
  console.error("\naudit error:", e.message, "\n");
  process.exit(1);
});
