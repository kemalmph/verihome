import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Derives the publish checklist from the data itself, rather than trusting the
 * stored flags.
 *
 * The flags are written by three separate subsystems — the survey importer, the
 * rate editor, the photo uploader — each at the moment it happens to run. None
 * of them re-checks the others, and nothing re-checks any of them afterwards.
 * A flag therefore records "this was true once", which is not the question the
 * publish gate is asking.
 *
 * Two items are deliberately NOT derived. price_verified and
 * owner_contact_active are attestations: a person confirmed a price is real, or
 * that they reached the owner. There is no column that makes either true, and
 * computing one from adjacent data would invent a fact nobody checked.
 */

export type ChecklistKey =
  | "min_photos_uploaded"
  | "video_walkthrough_done"
  | "rla_completed"
  | "pros_cons_written"
  | "area_overview_filled"
  | "rental_mode_configured"
  | "price_verified"
  | "owner_contact_active";

export interface ChecklistItem {
  key: ChecklistKey;
  label: string;
  /** false for the two human attestations, which are read from storage. */
  derived: boolean;
  pass: boolean;
  /** Plain language, naming the shortfall. "Incomplete" helps nobody. */
  missing: string | null;
}

export interface DerivedChecklist {
  propertyId: string;
  propertyName: string;
  status: string;
  rentalMode: string | null;
  items: ChecklistItem[];
  allPass: boolean;
  failed: ChecklistItem[];
}

const MIN_PHOTOS = 15;
const MIN_PROS_CONS = 2;
const MIN_AREA_POINTS = 3;

/** The eight RLA dimensions. A 1–10 scale, so 0 is not a score. */
const RLA_DIMENSIONS: [key: string, label: string][] = [
  ["building_condition", "kondisi bangunan"],
  ["natural_lighting",   "pencahayaan"],
  ["ventilation",        "sirkulasi udara"],
  ["noise_level",        "kebisingan"],
  ["cleanliness",        "kebersihan"],
  ["security_level",     "keamanan"],
  ["bathroom_condition", "kamar mandi"],
  ["furniture_quality",  "perabot"],
];

/** Transit and amenity fields that count towards the area overview. */
const AREA_POINTS: [key: string, label: string][] = [
  ["nearest_mrt",          "MRT"],
  ["nearest_transjakarta", "TransJakarta"],
  ["nearest_minimarket",   "minimarket"],
  ["nearest_clinic",       "klinik"],
  ["nearest_food",         "tempat makan"],
  ["nearest_gym",          "gym"],
];

const arrLen = (v: unknown) => (Array.isArray(v) ? v.length : 0);
const present = (v: unknown) => typeof v === "string" && v.trim().length > 0;

export async function deriveChecklist(propertyId: string): Promise<DerivedChecklist> {
  const admin = createAdminClient();

  const [{ data: property }, { data: media }, { data: rla }, { data: area }, { data: rate }, { data: stored }] =
    await Promise.all([
      admin.from("properties").select("id, name, status, rental_mode").eq("id", propertyId).single(),
      admin.from("property_media").select("*").eq("property_id", propertyId).maybeSingle(),
      admin.from("rla_assessments").select("*").eq("property_id", propertyId).limit(1).maybeSingle(),
      admin.from("area_overviews").select("*").eq("property_id", propertyId).limit(1).maybeSingle(),
      admin.from("short_stay_rates").select("*").eq("property_id", propertyId).maybeSingle(),
      admin.from("publish_checklist").select("*").eq("property_id", propertyId).maybeSingle(),
    ]);

  const items: ChecklistItem[] = [];

  // ── Photos ────────────────────────────────────────────────────────────────
  // Counted from the arrays themselves, not from total_photo_count. The
  // counter is a cached number written at upload time; the arrays are the
  // photos. Where they disagree the arrays win, and the disagreement is said
  // out loud rather than silently resolved.
  const actual =
    arrLen(media?.photos_exterior) + arrLen(media?.photos_common_area) +
    arrLen(media?.photos_unit) + arrLen(media?.photos_bathroom);
  const counter = Number(media?.total_photo_count ?? 0);
  const counterDisagrees = media != null && counter !== actual;

  items.push({
    key: "min_photos_uploaded",
    label: "Foto properti",
    derived: true,
    pass: actual >= MIN_PHOTOS,
    missing: actual >= MIN_PHOTOS ? null
      : `${actual} dari ${MIN_PHOTOS} foto` +
        (counterDisagrees ? ` (total_photo_count mencatat ${counter} — tidak cocok)` : ""),
  });

  // ── Video ─────────────────────────────────────────────────────────────────
  items.push({
    key: "video_walkthrough_done",
    label: "Video keliling unit",
    derived: true,
    pass: present(media?.video_url),
    missing: present(media?.video_url) ? null : "belum ada tautan video",
  });

  // ── RLA: all eight scored ─────────────────────────────────────────────────
  const unscored = RLA_DIMENSIONS.filter(([k]) => {
    const v = rla?.[k as keyof typeof rla];
    return v == null || Number(v) <= 0;   // the scale starts at 1
  });
  items.push({
    key: "rla_completed",
    label: "Penilaian RLA",
    derived: true,
    pass: rla != null && unscored.length === 0,
    missing: rla == null ? "belum ada penilaian sama sekali"
      : unscored.length === 0 ? null
      : `${unscored.length} belum dinilai: ${unscored.map(([, l]) => l).join(", ")}`,
  });

  // ── Pros and cons ─────────────────────────────────────────────────────────
  const pros = arrLen(rla?.pros);
  const cons = arrLen(rla?.cons);
  const prosConsOk = pros >= MIN_PROS_CONS && cons >= MIN_PROS_CONS;
  items.push({
    key: "pros_cons_written",
    label: "Kelebihan dan kekurangan",
    derived: true,
    pass: prosConsOk,
    missing: prosConsOk ? null
      : `kelebihan ${pros}/${MIN_PROS_CONS}, kekurangan ${cons}/${MIN_PROS_CONS}`,
  });

  // ── Area overview ─────────────────────────────────────────────────────────
  const points = AREA_POINTS.filter(([k]) => present(area?.[k as keyof typeof area]));
  items.push({
    key: "area_overview_filled",
    label: "Data lingkungan sekitar",
    derived: true,
    pass: points.length >= MIN_AREA_POINTS,
    missing: points.length >= MIN_AREA_POINTS ? null
      : `${points.length} dari ${MIN_AREA_POINTS} titik transit/fasilitas`,
  });

  // ── Rental mode, and a usable rate when the mode allows short stay ────────
  const mode = (property?.rental_mode as string) ?? null;
  const needsRate = mode === "short_stay" || mode === "both";
  const rateComplete =
    rate != null &&
    Number(rate.price_per_night ?? 0) > 0 &&
    Number(rate.min_nights ?? 0) >= 1 &&
    rate.active === true;

  let modeMissing: string | null = null;
  if (!mode) modeMissing = "jenis sewa belum dipilih";
  else if (needsRate && rate == null) modeMissing = "sewa harian aktif tetapi tarif belum dibuat";
  else if (needsRate && !rateComplete) {
    const gaps: string[] = [];
    if (!(Number(rate?.price_per_night ?? 0) > 0)) gaps.push("tarif per malam");
    if (!(Number(rate?.min_nights ?? 0) >= 1)) gaps.push("minimum malam");
    if (rate?.active !== true) gaps.push("tarif belum diaktifkan");
    modeMissing = gaps.join(", ");
  }

  items.push({
    key: "rental_mode_configured",
    label: "Jenis sewa dan tarif",
    derived: true,
    pass: modeMissing === null,
    missing: modeMissing,
  });

  // ── The two attestations, read as stored ──────────────────────────────────
  items.push({
    key: "price_verified",
    label: "Harga diverifikasi tim",
    derived: false,
    pass: stored?.price_verified === true,
    missing: stored?.price_verified === true ? null : "belum dikonfirmasi orang",
  });
  items.push({
    key: "owner_contact_active",
    label: "Kontak pemilik dikonfirmasi",
    derived: false,
    pass: stored?.owner_contact_active === true,
    missing: stored?.owner_contact_active === true ? null : "belum dikonfirmasi orang",
  });

  const failed = items.filter((i) => !i.pass);
  return {
    propertyId,
    propertyName: (property?.name as string) ?? "—",
    status: (property?.status as string) ?? "—",
    rentalMode: mode,
    items,
    allPass: failed.length === 0,
    failed,
  };
}

/**
 * Recomputes every property's checklist and writes the derived items back.
 *
 * The two attestations are carried through untouched: this function has no
 * standing to decide whether somebody phoned an owner. A property with no row
 * gets one, with both attestations false — absence of a record is not
 * confirmation.
 *
 * Writes nothing to properties.status. Whether an incomplete listing should
 * come down is a business call, not a consequence of running a report.
 */
export async function recomputeAllChecklists(opts: { commit?: boolean } = {}) {
  const admin = createAdminClient();
  const { data: properties } = await admin
    .from("properties").select("id").order("name");

  const results: DerivedChecklist[] = [];
  let created = 0;
  let updated = 0;

  for (const p of properties ?? []) {
    const derived = await deriveChecklist(p.id as string);
    results.push(derived);

    if (!opts.commit) continue;

    const patch: Record<string, boolean> = {};
    for (const item of derived.items) {
      if (item.derived) patch[item.key] = item.pass;
    }

    const { data: existing } = await admin
      .from("publish_checklist").select("property_id").eq("property_id", p.id).maybeSingle();

    if (existing) {
      await admin.from("publish_checklist").update(patch).eq("property_id", p.id);
      updated++;
    } else {
      await admin.from("publish_checklist").insert({
        property_id: p.id,
        ...patch,
        price_verified: false,
        owner_contact_active: false,
      });
      created++;
    }
  }

  return { results, created, updated };
}
