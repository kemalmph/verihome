#!/usr/bin/env node
/**
 * check-migration-completeness.js
 *
 * Static guard for §20.4: "the migrations cannot build the database from nothing".
 *
 * Replays the migration files *symbolically*, in filename order, and asks one
 * question of each statement: does it touch a table that no earlier migration
 * created? If so, a clean `supabase db reset` against an empty database cannot
 * get past it.
 *
 * This is not a substitute for an actual replay — only `supabase db reset`
 * proves the files build the database (see the migration checklist in §19).
 * It is the cheap check that runs without Docker and without production, so a
 * new migration that quietly assumes a dashboard-made table is caught at the
 * commit that adds it rather than at a restore.
 *
 * Exits non-zero when any assumed table is found, so it can gate a commit.
 *
 *   node scripts/check-migration-completeness.js
 *   node scripts/check-migration-completeness.js --baseline   (see below)
 *
 * --baseline treats the 15 tables already known to be missing as expected and
 * fails only on *new* ones. Use it in CI until the base-schema migration lands;
 * drop the flag once it has, and this becomes a full from-zero assertion.
 */

const fs = require("fs");
const path = require("path");

const MIGRATIONS_DIR = path.join(__dirname, "..", "supabase", "migrations");

/**
 * Tables that exist in production but are created by no migration.
 *
 * EMPTY, and that is the point. Until 2026-11-21 this held fifteen tables —
 * users, owners, properties, viewings, consultations, reviews, saved_listings,
 * publish_checklist, property_details, property_media, area_overviews,
 * rla_assessments, property_surveys, pending_survey_imports and
 * survey_import_log — every one made through the Supabase dashboard and never
 * written down. The baseline migration now creates all of them, so there is
 * nothing left to excuse and `--baseline` has nothing left to do.
 *
 * If you find yourself adding a name here, stop: that is the §20.4 gap
 * reopening. Add the CREATE TABLE to a migration instead.
 */
const KNOWN_MISSING = new Set([]);

/**
 * Strip the things that must not be scanned for DDL dependencies:
 *
 *  - line and block comments, which routinely name tables in prose;
 *  - dollar-quoted bodies ($$ ... $$), i.e. plpgsql function bodies. A function
 *    body referencing a table is NOT a replay dependency: plpgsql is not
 *    validated until execution, so `CREATE FUNCTION` succeeds against a
 *    database where the table is absent (that is exactly how §19.3's broken
 *    credit RPCs came to exist). Scanning bodies would bury the real findings
 *    in noise.
 */
function stripNonDDL(sql) {
  let out = sql.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/--[^\n]*/g, " ");
  // Remove dollar-quoted strings, honouring named tags ($fn$ ... $fn$).
  out = out.replace(/\$([A-Za-z_]\w*)?\$[\s\S]*?\$\1?\$/g, " '' ");
  // Remove ordinary single-quoted literals (may contain table-ish words).
  out = out.replace(/'(?:[^']|'')*'/g, " '' ");
  return out;
}

/** Normalise `public."Foo"` / `"foo"` / `public.foo` -> {schema, table}. */
function parseRef(raw) {
  const parts = raw.split(".").map((p) => p.replace(/^"|"$/g, ""));
  return parts.length > 1
    ? { schema: parts[0].toLowerCase(), table: parts[1] }
    : { schema: "public", table: parts[0] };
}

// A schema-qualified-or-bare identifier: public.foo, "foo", auth.users, foo
const IDENT = String.raw`((?:"[^"]+"|\w+)(?:\s*\.\s*(?:"[^"]+"|\w+))?)`;

const CREATE_PATTERNS = [
  new RegExp(String.raw`\bCREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?${IDENT}`, "gi"),
];

/** Each entry: how a statement depends on a table that must already exist. */
const REFERENCE_PATTERNS = [
  { what: "ALTER TABLE", re: new RegExp(String.raw`\bALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:ONLY\s+)?${IDENT}`, "gi") },
  { what: "REFERENCES", re: new RegExp(String.raw`\bREFERENCES\s+${IDENT}`, "gi") },
  { what: "CREATE INDEX", re: new RegExp(String.raw`\bCREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:CONCURRENTLY\s+)?(?:IF\s+NOT\s+EXISTS\s+)?(?:"[^"]+"|\w+)\s+ON\s+${IDENT}`, "gi") },
  { what: "CREATE POLICY", re: new RegExp(String.raw`\bCREATE\s+POLICY\s+(?:"[^"]+"|\w+)\s+ON\s+${IDENT}`, "gi") },
  { what: "DROP POLICY", re: new RegExp(String.raw`\bDROP\s+POLICY\s+(?:IF\s+EXISTS\s+)?(?:"[^"]+"|\w+)\s+ON\s+${IDENT}`, "gi") },
  // The negative lookahead keeps `GRANT ALL ON ALL TABLES IN SCHEMA public`
  // and `GRANT ... ON SCHEMA x` out: those name no table, and without it the
  // words ALL and SCHEMA get reported as missing tables.
  { what: "GRANT/REVOKE", re: new RegExp(String.raw`\b(?:GRANT|REVOKE)\b[\s\S]{0,200}?\bON\s+(?!ALL\s|SCHEMA\s)(?:TABLE\s+)?${IDENT}`, "gi") },
  { what: "CREATE TRIGGER", re: new RegExp(String.raw`\bCREATE\s+(?:OR\s+REPLACE\s+)?TRIGGER\s+(?:"[^"]+"|\w+)[\s\S]{0,120}?\bON\s+${IDENT}`, "gi") },
  { what: "DROP TRIGGER", re: new RegExp(String.raw`\bDROP\s+TRIGGER\s+(?:IF\s+EXISTS\s+)?(?:"[^"]+"|\w+)\s+ON\s+${IDENT}`, "gi") },
  { what: "INSERT INTO", re: new RegExp(String.raw`\bINSERT\s+INTO\s+${IDENT}`, "gi") },
  { what: "UPDATE", re: new RegExp(String.raw`\bUPDATE\s+(?:ONLY\s+)?${IDENT}\s+SET\b`, "gi") },
];

function collect(sql, patterns) {
  const found = [];
  for (const entry of patterns) {
    const re = entry.re || entry;
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(sql)) !== null) {
      found.push({ ...parseRef(m[1].replace(/\s+/g, "")), what: entry.what });
    }
  }
  return found;
}

/**
 * Split into statements so they can be walked in order. A table created and
 * then altered in the *same* migration is perfectly replayable, so references
 * must be resolved against creates that precede them, not against the file as
 * a whole. Safe to split on ';' because stripNonDDL has already removed
 * dollar-quoted bodies and quoted literals, the only places a ';' can hide.
 */
function statements(sql) {
  return sql.split(";").filter((s) => s.trim().length > 0);
}

function main() {
  const baselineMode = process.argv.includes("--baseline");

  if (!fs.existsSync(MIGRATIONS_DIR)) {
    console.error(`No migrations directory at ${MIGRATIONS_DIR}`);
    process.exit(2);
  }

  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const created = new Map(); // table -> migration that creates it
  const assumed = new Map(); // table -> {file, what}  (first offending use)

  for (const file of files) {
    const sql = stripNonDDL(fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8"));

    // Walk statements in order: a reference is a replay failure only if no
    // statement before it — in this file or an earlier migration — created the
    // table.
    for (const stmt of statements(sql)) {
      // Creates register first, within the statement as well as before it: a
      // CREATE TABLE carrying a self-referencing FK (ledger_entries.reversed_by)
      // names itself, and that is replayable, not a missing dependency.
      for (const made of collect(stmt, CREATE_PATTERNS)) {
        if (made.schema !== "public") continue;
        if (!created.has(made.table)) created.set(made.table, file);
      }

      for (const ref of collect(stmt, REFERENCE_PATTERNS)) {
        if (ref.schema !== "public") continue; // auth.users et al. are Supabase's
        if (created.has(ref.table)) continue;
        if (!assumed.has(ref.table)) assumed.set(ref.table, { file, what: ref.what });
      }
    }
  }

  console.log(`Scanned ${files.length} migration files in ${path.relative(process.cwd(), MIGRATIONS_DIR)}`);
  console.log(`  created by a migration : ${created.size}`);
  console.log(`  assumed to pre-exist   : ${assumed.size}\n`);

  if (assumed.size === 0) {
    console.log("OK — every public table a migration touches is created by a migration.");
    console.log("The history can describe the database from zero. Confirm with `supabase db reset`.");
    return 0;
  }

  const sorted = [...assumed.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const unexpected = sorted.filter(([t]) => !KNOWN_MISSING.has(t));
  const expected = sorted.filter(([t]) => KNOWN_MISSING.has(t));

  if (expected.length) {
    console.log(`Known missing (§20.4 base-schema scope) — ${expected.length}:`);
    for (const [table, { file, what }] of expected) {
      console.log(`  ${table.padEnd(26)} first assumed by ${file}  (${what})`);
    }
    console.log("");
  }

  if (unexpected.length) {
    console.log(`NEW assumed tables — not in the known-missing baseline — ${unexpected.length}:`);
    for (const [table, { file, what }] of unexpected) {
      console.log(`  ${table.padEnd(26)} first assumed by ${file}  (${what})`);
    }
    console.log("");
    console.log("A migration touches a table that nothing in the history creates.");
    console.log("Either add the CREATE TABLE to a migration, or, if it is a dashboard-made");
    console.log("table being captured, add it to the base-schema migration.");
    return 1;
  }

  const missingFromHistory = [...KNOWN_MISSING].filter((t) => !created.has(t));
  if (baselineMode) {
    console.log(`No new assumed tables. ${missingFromHistory.length} known-missing table(s) still uncaptured.`);
    console.log("Baseline mode: passing. Drop --baseline once the base-schema migration lands.");
    return 0;
  }

  console.log("Every assumed table is a known one, but they are still assumed:");
  console.log(`${missingFromHistory.length} of the ${KNOWN_MISSING.size} tables in the §20.4 scope are created by no migration,`);
  console.log("so `supabase db reset` fails on the first file. This is the open risk, not a regression.");
  console.log("Run with --baseline to assert only that nothing NEW was added.");
  return 1;
}

process.exit(main());
