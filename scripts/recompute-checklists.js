#!/usr/bin/env node
/**
 * Recomputes every property's publish checklist from actual data.
 *
 *   node scripts/recompute-checklists.js            # report only, writes nothing
 *   node scripts/recompute-checklists.js --commit   # write the derived items
 *
 * Never touches properties.status. Whether an incomplete listing comes down is
 * a business decision, not a side effect of running a report.
 */
const { createClient } = require("@supabase/supabase-js");
const fs = require("fs"), path = require("path");

for (const line of fs.readFileSync(path.join(__dirname, "..", ".env.local"), "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } });

const COMMIT = process.argv.includes("--commit");
const MIN_PHOTOS = 15, MIN_PROS_CONS = 2, MIN_AREA_POINTS = 3;

const RLA = [["building_condition","kondisi bangunan"],["natural_lighting","pencahayaan"],
  ["ventilation","sirkulasi udara"],["noise_level","kebisingan"],["cleanliness","kebersihan"],
  ["security_level","keamanan"],["bathroom_condition","kamar mandi"],["furniture_quality","perabot"]];
const AREA = [["nearest_mrt","MRT"],["nearest_transjakarta","TransJakarta"],
  ["nearest_minimarket","minimarket"],["nearest_clinic","klinik"],
  ["nearest_food","tempat makan"],["nearest_gym","gym"]];

const arrLen = (v) => Array.isArray(v) ? v.length : 0;
const present = (v) => typeof v === "string" && v.trim().length > 0;

async function derive(p) {
  const [media, rla, area, rate, stored] = await Promise.all([
    admin.from("property_media").select("*").eq("property_id", p.id).maybeSingle(),
    admin.from("rla_assessments").select("*").eq("property_id", p.id).limit(1).maybeSingle(),
    admin.from("area_overviews").select("*").eq("property_id", p.id).limit(1).maybeSingle(),
    admin.from("short_stay_rates").select("*").eq("property_id", p.id).maybeSingle(),
    admin.from("publish_checklist").select("*").eq("property_id", p.id).maybeSingle(),
  ]).then(rs => rs.map(r => r.data));

  const items = [];
  const actual = arrLen(media?.photos_exterior)+arrLen(media?.photos_common_area)
               + arrLen(media?.photos_unit)+arrLen(media?.photos_bathroom);
  const counter = Number(media?.total_photo_count ?? 0);
  items.push({key:"min_photos_uploaded",derived:true,pass:actual>=MIN_PHOTOS,
    missing: actual>=MIN_PHOTOS?null:`${actual}/${MIN_PHOTOS} foto`
      + (media && counter!==actual ? ` (counter says ${counter})` : "")});

  items.push({key:"video_walkthrough_done",derived:true,pass:present(media?.video_url),
    missing: present(media?.video_url)?null:"no video URL"});

  const unscored = RLA.filter(([k]) => rla?.[k] == null || Number(rla[k]) <= 0);
  items.push({key:"rla_completed",derived:true,pass:rla!=null&&unscored.length===0,
    missing: rla==null?"no assessment at all"
      : unscored.length===0?null:`${unscored.length} unscored: ${unscored.map(x=>x[1]).join(", ")}`});

  const pros=arrLen(rla?.pros), cons=arrLen(rla?.cons);
  const pcOk = pros>=MIN_PROS_CONS && cons>=MIN_PROS_CONS;
  items.push({key:"pros_cons_written",derived:true,pass:pcOk,
    missing: pcOk?null:`pros ${pros}/${MIN_PROS_CONS}, cons ${cons}/${MIN_PROS_CONS}`});

  const pts = AREA.filter(([k]) => present(area?.[k]));
  items.push({key:"area_overview_filled",derived:true,pass:pts.length>=MIN_AREA_POINTS,
    missing: pts.length>=MIN_AREA_POINTS?null:`${pts.length}/${MIN_AREA_POINTS} transit/amenity points`});

  const mode = p.rental_mode ?? null;
  const needsRate = mode==="short_stay"||mode==="both";
  const rateOk = rate!=null && Number(rate.price_per_night??0)>0
              && Number(rate.min_nights??0)>=1 && rate.active===true;
  let modeMissing=null;
  if (!mode) modeMissing="rental mode not set";
  else if (needsRate && rate==null) modeMissing="short stay allowed but no rate row";
  else if (needsRate && !rateOk) {
    const g=[];
    if(!(Number(rate.price_per_night??0)>0)) g.push("price_per_night");
    if(!(Number(rate.min_nights??0)>=1)) g.push("min_nights");
    if(rate.active!==true) g.push("rate not active");
    modeMissing=g.join(", ");
  }
  items.push({key:"rental_mode_configured",derived:true,pass:modeMissing===null,missing:modeMissing});

  items.push({key:"price_verified",derived:false,pass:stored?.price_verified===true,
    missing: stored?.price_verified===true?null:"not attested"});
  items.push({key:"owner_contact_active",derived:false,pass:stored?.owner_contact_active===true,
    missing: stored?.owner_contact_active===true?null:"not attested"});

  return { property:p, items, hadRow: stored!=null, failed: items.filter(i=>!i.pass) };
}

(async () => {
  const { data: props } = await admin.from("properties")
    .select("id,name,status,rental_mode").order("name");

  const results = [];
  for (const p of props) results.push(await derive(p));

  const KEYS=["min_photos_uploaded","video_walkthrough_done","rla_completed",
    "pros_cons_written","area_overview_filled","rental_mode_configured",
    "price_verified","owner_contact_active"];
  const HEAD={min_photos_uploaded:"photos",video_walkthrough_done:"video",
    rla_completed:"rla",pros_cons_written:"pros/cons",area_overview_filled:"area",
    rental_mode_configured:"mode+rate",price_verified:"price*",owner_contact_active:"contact*"};

  const w=(s,n)=>String(s).padEnd(n);
  console.log("\n" + w("PROPERTY",34) + w("STATUS",8) + KEYS.map(k=>w(HEAD[k],11)).join(""));
  console.log("-".repeat(34+8+11*KEYS.length));
  for (const r of results) {
    const cells = KEYS.map(k => w(r.items.find(i=>i.key===k).pass ? "pass" : "FAIL", 11)).join("");
    console.log(w(r.property.name,34) + w(r.property.status,8) + cells);
  }
  console.log("\n* = human attestation, read as stored, not derived\n");

  console.log("WHAT IS MISSING");
  console.log("-".repeat(96));
  for (const r of results) {
    if (!r.failed.length) { console.log(`\n  ${r.property.name} — complete`); continue; }
    console.log(`\n  ${r.property.name}  [${r.property.status}]${r.hadRow?"":"  (no checklist row existed)"}`);
    for (const f of r.failed) console.log(`    ${w(HEAD[f.key],11)} ${f.missing}`);
  }

  const live = results.filter(r=>r.property.status==="live");
  const liveFail = live.filter(r=>r.failed.length);
  console.log(`\n\n${results.length} properties; ${live.length} live; ` +
              `${liveFail.length} live would be REFUSED if re-published today.\n`);

  if (COMMIT) {
    let created=0, updated=0;
    for (const r of results) {
      const patch={};
      for (const i of r.items) if (i.derived) patch[i.key]=i.pass;
      if (r.hadRow) {
        await admin.from("publish_checklist").update(patch).eq("property_id", r.property.id);
        updated++;
      } else {
        await admin.from("publish_checklist").insert({
          property_id:r.property.id, ...patch,
          price_verified:false, owner_contact_active:false });
        created++;
      }
    }
    console.log(`committed: ${created} rows created, ${updated} updated. No property status changed.\n`);
  } else {
    console.log("report only — nothing written. Re-run with --commit to store derived items.\n");
  }
})().catch(e => { console.error("\nerror:", e.message, "\n"); process.exit(1); });
