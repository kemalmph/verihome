/**
 * The vocabulary of the coworking module, in one place.
 *
 * These lists mirror the CHECK constraints on `lettable_units` exactly. They
 * live here, once, because the alternative is the form offering an option the
 * database rejects — or worse, the database accepting one the form never shows.
 * §10 is the same lesson from the viewing policy: copy that exists once cannot
 * disagree with itself.
 *
 * Changing either list means a migration that widens the CHECK, and the two
 * have to land together.
 */

export const UNIT_TYPES = [
  { value: "hot_desk",       label: "Hot desk",        hint: "Meja bebas, siapa pun yang datang" },
  { value: "dedicated_desk", label: "Dedicated desk",  hint: "Meja tetap atas nama satu orang" },
  { value: "private_room",   label: "Ruang privat",    hint: "Ruang tertutup untuk tim kecil" },
  { value: "meeting_room",   label: "Ruang rapat",     hint: "Dipesan per sesi" },
  { value: "event_space",    label: "Ruang acara",     hint: "Aula atau area serbaguna" },
  { value: "retail_lot",     label: "Lot ritel",       hint: "Disewakan ke penyewa ritel" },
  { value: "cafe",           label: "Kafe",            hint: "Area kafe di dalam gedung" },
  { value: "storage",        label: "Gudang / loker",  hint: "Penyimpanan" },
] as const;

export const LETTING_MODES = [
  { value: "hourly",  label: "Per jam",   hint: "Dipesan per slot waktu" },
  { value: "daily",   label: "Harian",    hint: "Dipesan per hari" },
  { value: "monthly", label: "Bulanan",   hint: "Langganan berjalan" },
  { value: "lease",   label: "Sewa",      hint: "Kontrak jangka panjang" },
] as const;

export const UNIT_STATUSES = [
  { value: "available",   label: "Tersedia",    hint: "Boleh disewakan" },
  { value: "maintenance", label: "Perbaikan",   hint: "Sementara tidak disewakan" },
  { value: "retired",     label: "Tidak aktif", hint: "Tidak lagi dipakai" },
] as const;

/**
 * What kind of building a site is.
 *
 * One value today. Kosan, hostel and event space are on the roadmap and are
 * deliberately absent: a dropdown offering a business line that does not exist
 * is a promise the product cannot keep.
 *
 * Adding one means widening sites_site_type_check in the same change — a DROP
 * then ADD, never an ALTER, and the new value proven by writing a row with it
 * (§19.9).
 */
export const SITE_TYPES = [
  { value: "coworking", label: "Coworking" },
] as const;

export const SITE_STATUSES = [
  { value: "draft",  label: "Draf" },
  { value: "active", label: "Aktif" },
  { value: "closed", label: "Tutup" },
] as const;

export type UnitType    = (typeof UNIT_TYPES)[number]["value"];
export type LettingMode = (typeof LETTING_MODES)[number]["value"];
export type UnitStatus  = (typeof UNIT_STATUSES)[number]["value"];
export type SiteStatus  = (typeof SITE_STATUSES)[number]["value"];
export type SiteType    = (typeof SITE_TYPES)[number]["value"];

const setOf = (xs: readonly { value: string }[]) => new Set(xs.map((x) => x.value));

export const isUnitType    = (v: unknown): v is UnitType    => typeof v === "string" && setOf(UNIT_TYPES).has(v);
export const isLettingMode = (v: unknown): v is LettingMode => typeof v === "string" && setOf(LETTING_MODES).has(v);
export const isUnitStatus  = (v: unknown): v is UnitStatus  => typeof v === "string" && setOf(UNIT_STATUSES).has(v);
export const isSiteStatus  = (v: unknown): v is SiteStatus  => typeof v === "string" && setOf(SITE_STATUSES).has(v);
export const isSiteType    = (v: unknown): v is SiteType    => typeof v === "string" && setOf(SITE_TYPES).has(v);

export const unitTypeLabel = (v: string) =>
  UNIT_TYPES.find((t) => t.value === v)?.label ?? v;
export const lettingModeLabel = (v: string) =>
  LETTING_MODES.find((m) => m.value === v)?.label ?? v;
export const unitStatusLabel = (v: string) =>
  UNIT_STATUSES.find((s) => s.value === v)?.label ?? v;
export const siteStatusLabel = (v: string) =>
  SITE_STATUSES.find((s) => s.value === v)?.label ?? v;
export const siteTypeLabel = (v: string) =>
  SITE_TYPES.find((t) => t.value === v)?.label ?? v;

/** What a price means, given how the unit is let. Shown next to every amount. */
export const pricePeriodLabel = (mode: string) =>
  ({ hourly: "/jam", daily: "/hari", monthly: "/bulan", lease: "/bulan" } as Record<string, string>)[mode] ?? "";
