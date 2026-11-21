#!/usr/bin/env node
/**
 * Import a Co&co unit/contract register (.xlsx) into sites, lettable_units,
 * unit_reservations and reservation_instalments.
 *
 *   node scripts/import-coworking-register.js <register.xlsx> [--site-slug=...] [--apply]
 *
 * Without --apply it prints exactly what it would do and writes nothing. That
 * is the default on purpose: this reads a file nobody in the repo can see and
 * writes to a real database.
 *
 * THE REGISTER IS NOT IN THIS REPOSITORY AND MUST NOT BE.
 * It carries tenant names, a mobile number and a personal email address, and
 * this repository is public. Keep the file outside the working tree and pass
 * its path.
 *
 * Re-running is safe and is the expected workflow — the owner's tenant list is
 * incomplete and will grow. Units match on (site, name), reservations on
 * contract_ref, instalments on (reservation, seq). Existing rows are updated
 * in place, so nothing is duplicated and no id changes.
 *
 * Needs: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY, read from .env.local unless
 * already set, so pointing it at production is a deliberate act.
 */
const fs = require("fs");
const path = require("path");
const openpyxlNote = null; // the reading is done by a tiny python helper, see readWorkbook

const APPLY = process.argv.includes("--apply");
const FILE = process.argv.find((a) => a.endsWith(".xlsx"));
const SITE_SLUG = (process.argv.find((a) => a.startsWith("--site-slug=")) ?? "").split("=")[1] || "coco-lokalima";
const SITE_NAME = (process.argv.find((a) => a.startsWith("--site-name=")) ?? "").split("=")[1] || "Co&co Lokalima";

if (!FILE) {
  console.error("usage: node scripts/import-coworking-register.js <register.xlsx> [--apply]");
  process.exit(2);
}

// ── env ─────────────────────────────────────────────────────────────────────
const envPath = path.join(__dirname, "..", ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
const { createClient } = require("@supabase/supabase-js");
const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

/**
 * The register is .xlsx, and this project has no xlsx reader in node. Python
 * has openpyxl, so the sheets come across as JSON through one subprocess
 * rather than adding a dependency for one script.
 *
 * -I so the interpreter ignores the current directory and the user site
 * packages: the file being read is untrusted input and lives in a folder this
 * script does not control.
 */
function readWorkbook(file) {
  const py = `
import json, sys, datetime
import openpyxl
wb = openpyxl.load_workbook(sys.argv[1], data_only=True)
def val(v):
    if isinstance(v, (datetime.datetime, datetime.date)):
        return v.strftime("%Y-%m-%d")
    return v
out = {}
for ws in wb.worksheets:
    rows = [[val(c) for c in r] for r in ws.iter_rows(values_only=True)]
    rows = [r for r in rows if any(c not in (None, "") for c in r)]
    if not rows: continue
    hdr = [str(h).strip() if h is not None else "" for h in rows[0]]
    out[ws.title] = [dict(zip(hdr, r)) for r in rows[1:]]
print(json.dumps(out))
`;
  const { execFileSync } = require("child_process");
  const raw = execFileSync("python3", ["-I", "-c", py, file], {
    maxBuffer: 64 * 1024 * 1024,
    encoding: "utf8",
  });
  return JSON.parse(raw);
}

// ── mapping ─────────────────────────────────────────────────────────────────
//
// The register's vocabulary is Indonesian and the schema's is English. The
// mapping is explicit and refuses anything it does not recognise, rather than
// defaulting — a silently mistyped unit is a unit that books under the wrong
// rules.

const UNIT_TYPE = {
  "private office": "private_room",
  "meeting room": "meeting_room",
  "hot desk": "hot_desk",
  "dedicated desk": "dedicated_desk",
  "event space": "event_space",
  "retail": "retail_lot",
  "cafe": "cafe",
  "storage": "storage",
};

/**
 * `Status` in the register mixes two different things, and they must not be
 * flattened:
 *
 *   Kosong / Booked / Tersewa  -> whether anyone holds it *right now*
 *   available / maintenance    -> whether it may be let at all
 *
 * All three register values mean the unit is lettable. Occupancy is expressed
 * by a reservation, which is the whole point of having that table: a unit is
 * not "Tersewa" forever, it is held until a date.
 */
const LETTABLE_FROM_REGISTER = new Set(["kosong", "booked", "tersewa"]);

const money = (v) => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(String(v).replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : null;
};
const num = money;
const text = (v) => {
  const s = (v ?? "").toString().trim();
  return s === "" ? null : s;
};

(async () => {
  const wb = readWorkbook(FILE);
  const units = wb["Unit"] ?? [];
  const contracts = wb["Kontrak"] ?? [];
  const schedule = wb["Jadwal Bayar"] ?? [];

  console.log(`Register: ${path.basename(FILE)}`);
  console.log(`  units     ${units.length}`);
  console.log(`  contracts ${contracts.length}`);
  console.log(`  instalments ${schedule.length}`);
  console.log(`  target    ${process.env.NEXT_PUBLIC_SUPABASE_URL}`);
  console.log(`  mode      ${APPLY ? "APPLY — will write" : "dry run — writes nothing"}\n`);

  const problems = [];
  const plan = [];

  // ── site ──────────────────────────────────────────────────────────────────
  let site = null;
  {
    const { data } = await db.from("sites").select("*").eq("slug", SITE_SLUG).maybeSingle();
    site = data;
    plan.push(site ? `site: update "${SITE_NAME}" (${SITE_SLUG})` : `site: create "${SITE_NAME}" (${SITE_SLUG})`);
  }

  if (APPLY) {
    const payload = {
      name: SITE_NAME, slug: SITE_SLUG, site_type: "coworking", status: "active",
      area: "Dipati Ukur", address: "Jl. Dipati Ukur No. 5, Bandung 40132",
      opening_time: "08:00", closing_time: "18:00",
    };
    if (site) {
      const { error } = await db.from("sites").update(payload).eq("id", site.id);
      if (error) throw new Error(`site update: ${error.message}`);
    } else {
      const { data, error } = await db.from("sites").insert(payload).select().single();
      if (error) throw new Error(`site insert: ${error.message}`);
      site = data;
    }
  }

  // ── units ─────────────────────────────────────────────────────────────────
  const unitIdByName = new Map();
  for (const row of units) {
    const name = text(row["Unit"]);
    if (!name) continue;
    const rawType = (text(row["Tipe"]) ?? "").toLowerCase();
    const unit_type = UNIT_TYPE[rawType];
    if (!unit_type) {
      problems.push(`unit ${name}: unknown Tipe "${row["Tipe"]}" — not imported`);
      continue;
    }
    const rawStatus = (text(row["Status"]) ?? "").toLowerCase();
    if (!LETTABLE_FROM_REGISTER.has(rawStatus)) {
      problems.push(`unit ${name}: unexpected Status "${row["Status"]}" — treated as lettable anyway, check it`);
    }

    // A meeting room is let by the session; an office by the year.
    const letting_mode = unit_type === "meeting_room" ? "hourly" : "lease";

    const payload = {
      site_id: site?.id,
      name,
      unit_type,
      letting_mode,
      size_sqm: num(row["Luas (m²)"]),
      price: money(row["Harga / tahun (Rp)"]),
      status: "available",
      notes: [text(row["Dimensi (m)"]) && `Dimensi ${text(row["Dimensi (m)"])}`, text(row["Catatan"])]
        .filter(Boolean).join(". ") || null,
    };

    if (payload.price === null) {
      problems.push(`unit ${name}: no price in the register — it cannot be quoted or let until one exists`);
    }

    plan.push(`  unit ${name.padEnd(5)} ${unit_type.padEnd(13)} ${letting_mode.padEnd(7)} ${payload.size_sqm ?? "?"} m²  ${payload.price ? "Rp" + payload.price.toLocaleString("id-ID") : "no price"}`);

    if (APPLY) {
      const { data: existing } = await db
        .from("lettable_units").select("id").eq("site_id", site.id).eq("name", name).maybeSingle();
      if (existing) {
        const { error } = await db.from("lettable_units").update(payload).eq("id", existing.id);
        if (error) throw new Error(`unit ${name}: ${error.message}`);
        unitIdByName.set(name, existing.id);
      } else {
        const { data, error } = await db.from("lettable_units").insert(payload).select("id").single();
        if (error) throw new Error(`unit ${name}: ${error.message}`);
        unitIdByName.set(name, data.id);
      }
    }
  }

  // ── contracts as reservations ─────────────────────────────────────────────
  //
  // Inserted directly rather than through create_unit_reservation_if_available,
  // because these are contracts that already exist on paper. The availability
  // check would be answering a question nobody asked — the unit IS let. The
  // exclusion constraint still applies, so a register that double-books a unit
  // will be refused here, which is the right place to find that out.
  const resIdByContract = new Map();
  for (const row of contracts) {
    const contract_ref = text(row["No. Kontrak"]);
    const unitName = text(row["Unit"]);
    if (!contract_ref || !unitName) continue;

    const starts = text(row["Mulai"]);
    const ends = text(row["Selesai"]);
    if (!starts || !ends) {
      problems.push(`contract ${contract_ref}: missing Mulai or Selesai — not imported`);
      continue;
    }

    const annual = money(row["Harga / tahun (Rp)"]);
    const tenant_name = text(row["Penyewa"]);
    const pic = text(row["Penanggung jawab"]);
    const kontak = text(row["Kontak"]);

    // The contract's own money, not the annualised column: what the tenant
    // actually owes over this period is the sum of the instalments. The
    // annual figure is a comparison aid and in one case disagrees with it.
    const instalments = schedule.filter((s) => text(s["No. Kontrak"]) === contract_ref);
    const scheduled = instalments.reduce((n, s) => n + (money(s["Jumlah (Rp)"]) ?? 0), 0);

    if (!instalments.length) {
      problems.push(`contract ${contract_ref}: no instalments in Jadwal Bayar — total taken from the annual column`);
    }
    const total_price = scheduled > 0 ? scheduled : (annual ?? 0);

    const months = (new Date(ends) - new Date(starts)) / (1000 * 60 * 60 * 24 * 30.44);
    if (annual && scheduled && months > 0) {
      const impliedAnnual = Math.round((scheduled / months) * 12);
      if (Math.abs(impliedAnnual - annual) / annual > 0.2) {
        problems.push(
          `contract ${contract_ref}: the annual column says Rp${annual.toLocaleString("id-ID")}, ` +
          `but the instalments total Rp${scheduled.toLocaleString("id-ID")} over ~${months.toFixed(1)} months, ` +
          `which annualises to about Rp${impliedAnnual.toLocaleString("id-ID")}. Using the instalments.`,
        );
      }
    }

    const anyPaid = instalments.some((s) => (text(s["Status"]) ?? "").toLowerCase() === "lunas");
    const allPaid = instalments.length > 0 && instalments.every((s) => (text(s["Status"]) ?? "").toLowerCase() === "lunas");

    const payload = {
      unit_id: unitIdByName.get(unitName),
      user_id: null,
      tenant_name,
      tenant_contact: [pic, kontak].filter(Boolean).join(" · ") || null,
      contract_ref,
      starts_at: `${starts}T00:00:00+07:00`,
      ends_at: `${ends}T23:59:59+07:00`,
      seats: 1,
      letting_mode: "lease",
      unit_price: annual ?? total_price,
      total_price,
      exclusive_use: true,
      // A signed contract is confirmed, whatever the document's own draft
      // status — the unit is held either way, which is what this table is for.
      status: "confirmed",
      payment_status: allPaid ? "paid" : anyPaid ? "pending_verification" : "unpaid",
      notes: [
        text(row["Bidang usaha"]) && `Bidang usaha: ${text(row["Bidang usaha"])}`,
        text(row["Skema bayar"]) && `Skema bayar: ${text(row["Skema bayar"])}`,
        text(row["Status dokumen"]) && `Status dokumen: ${text(row["Status dokumen"])}`,
        text(row["Catatan"]),
      ].filter(Boolean).join("\n"),
    };

    plan.push(
      `  contract ${contract_ref}  unit ${unitName}  ${starts} → ${ends}  ` +
      `Rp${total_price.toLocaleString("id-ID")}  ${payload.payment_status}  ${tenant_name}`,
    );

    if (APPLY) {
      if (!payload.unit_id) {
        problems.push(`contract ${contract_ref}: unit ${unitName} not found — not imported`);
        continue;
      }
      const { data: existing } = await db
        .from("unit_reservations").select("id, reservation_code").eq("contract_ref", contract_ref).maybeSingle();
      if (existing) {
        const { error } = await db.from("unit_reservations").update(payload).eq("id", existing.id);
        if (error) throw new Error(`contract ${contract_ref}: ${error.message}`);
        resIdByContract.set(contract_ref, existing.id);
      } else {
        const { data: code } = await db.rpc("generate_reservation_code");
        const { data, error } = await db
          .from("unit_reservations").insert({ ...payload, reservation_code: code }).select("id").single();
        if (error) throw new Error(`contract ${contract_ref}: ${error.message}`);
        resIdByContract.set(contract_ref, data.id);
      }
    }
  }

  // ── instalments ───────────────────────────────────────────────────────────
  const SEQ = (v) => {
    const m = String(v ?? "").match(/(\d+)\s*dari\s*(\d+)/i);
    return m ? Number(m[1]) : null;
  };
  for (const row of schedule) {
    const contract_ref = text(row["No. Kontrak"]);
    const seq = SEQ(row["Termin"]);
    const due = text(row["Jatuh tempo"]);
    const amount = money(row["Jumlah (Rp)"]);
    if (!contract_ref || !seq || !due || !amount) {
      problems.push(`instalment on ${contract_ref ?? "?"}: incomplete row — not imported`);
      continue;
    }
    const rawStatus = (text(row["Status"]) ?? "").toLowerCase();
    const paid = rawStatus === "lunas";

    // "Di muka" is not a date. Paid in advance means paid on or before the due
    // date, and the due date is the only date the register actually gives.
    const rawPaidOn = text(row["Tgl dibayar"]);
    const paid_at = paid ? (/^\d{4}-\d{2}-\d{2}$/.test(rawPaidOn ?? "") ? rawPaidOn : due) : null;
    if (paid && rawPaidOn && !/^\d{4}-\d{2}-\d{2}$/.test(rawPaidOn)) {
      problems.push(`instalment ${contract_ref} #${seq}: "Tgl dibayar" is "${rawPaidOn}", not a date — recorded as ${due}`);
    }

    plan.push(`  instalment ${contract_ref} #${seq}  due ${due}  Rp${amount.toLocaleString("id-ID")}  ${paid ? "paid" : "due"}`);

    if (APPLY) {
      const reservation_id = resIdByContract.get(contract_ref);
      if (!reservation_id) {
        problems.push(`instalment ${contract_ref} #${seq}: contract not imported — skipped`);
        continue;
      }
      const payload = {
        reservation_id, seq, due_date: due, amount,
        status: paid ? "paid" : "due", paid_at,
        notes: text(row["Catatan"]),
      };
      const { data: existing } = await db
        .from("reservation_instalments").select("id").eq("reservation_id", reservation_id).eq("seq", seq).maybeSingle();
      const { error } = existing
        ? await db.from("reservation_instalments").update(payload).eq("id", existing.id)
        : await db.from("reservation_instalments").insert(payload);
      if (error) throw new Error(`instalment ${contract_ref} #${seq}: ${error.message}`);
    }
  }

  console.log(plan.join("\n"));

  if (problems.length) {
    console.log(`\n${problems.length} thing(s) worth a human looking at:`);
    for (const p of problems) console.log(`  ! ${p}`);
  } else {
    console.log("\nNothing ambiguous in the register.");
  }

  console.log(APPLY ? "\nApplied." : "\nDry run — nothing was written. Re-run with --apply.");
})().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
