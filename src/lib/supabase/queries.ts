import { createClient } from "./server";
import { createClient as createBuildClient } from "@supabase/supabase-js";

export type RLAAssessment = {
  rla_score: number;
  building_condition: number;
  natural_lighting: number;
  bathroom_condition: number;
  ventilation: number;
  noise_level: number | null;
  security_level: number | null;
  cleanliness: number | null;
  furniture_quality: number | null;
  pros: string[];
  cons: string[];
  overall_notes: string;
};

export type PropertyMedia = {
  photos_exterior: string[];
  photos_common_area: string[];
  photos_unit: string[];
  photos_bathroom: string[];
  total_photo_count: number;
  video_url: string | null;
};

export type AreaOverview = {
  nearest_mrt: string;
  mrt_distance: string | null;
  walk_time_to_transit_min: number;
  nearest_transjakarta: string | null;
  transjakarta_distance: string | null;
  nearest_minimarket: string;
  nearest_clinic: string;
  nearest_food: string | null;
  nearest_gym: string | null;
  neighborhood_character: string;
  expat_friendly: number;
  time_to_scbd_min: number;
  time_to_sudirman_min: number;
  area_notes: string | null;
};

export type PropertyRow = {
  id: string;
  name: string;
  slug: string;
  property_type: "kost" | "apartment" | "house";
  status: string;
  price_monthly: number;
  area: string;
  size_sqm: number;
  bedrooms: number;
  bathrooms: number;
  min_stay_months: number;
  photo_urls: string[];
  rental_mode: "long_term" | "short_stay" | "both";
  is_furnished: boolean;
  is_instant_bookable: boolean;
  rla_assessments: RLAAssessment[];
};

export type ShortStayRateRow = {
  price_per_night: number;
  price_per_night_weekend: number | null;
  price_per_week: number | null;
  price_per_month: number | null;
  min_nights: number;
  max_nights: number | null;
  cleaning_fee: number;
  security_deposit: number;
  check_in_time: string;
  check_out_time: string;
  active: boolean;
};

export type PropertyDetailRow = PropertyRow & {
  property_details: {
    included_utilities: string[];
    facilities: string[];
    rules: string;
  }[];
  area_overviews: AreaOverview[];
  property_media: PropertyMedia[];
  // property_id is UNIQUE on short_stay_rates, so PostgREST embeds it as a
  // single object (to-one), not an array.
  short_stay_rates: ShortStayRateRow | null;
};

// `address` and `google_maps_url` are deliberately absent. Everything reached
// through this file is public, and migration 040 revokes both columns from the
// anon and authenticated roles — selecting them here would now fail outright
// rather than leak, which is the intended shape.
const PROPERTY_LIST_SELECT = `
  id, name, slug, property_type, status, price_monthly, area, size_sqm, bedrooms, bathrooms, min_stay_months, photo_urls,
  rental_mode, is_furnished, is_instant_bookable,
  rla_assessments ( rla_score, building_condition, natural_lighting, bathroom_condition, ventilation, noise_level, security_level, cleanliness, furniture_quality, pros, cons, overall_notes )
`;

const PROPERTY_DETAIL_SELECT = `
  ${PROPERTY_LIST_SELECT},
  property_details ( included_utilities, facilities, rules ),
  area_overviews ( nearest_mrt, mrt_distance, walk_time_to_transit_min, nearest_transjakarta, transjakarta_distance, nearest_minimarket, nearest_clinic, nearest_food, nearest_gym, neighborhood_character, expat_friendly, time_to_scbd_min, time_to_sudirman_min, area_notes ),
  property_media ( photos_exterior, photos_common_area, photos_unit, photos_bathroom, total_photo_count, video_url ),
  short_stay_rates ( price_per_night, price_per_night_weekend, price_per_week, price_per_month, min_nights, max_nights, cleaning_fee, security_deposit, check_in_time, check_out_time, active )
`;

export async function getLiveProperties(filters?: {
  area?: string;
  type?: string;
  minPrice?: number;
  maxPrice?: number;
  rentalMode?: string;
}) {
  const supabase = await createClient();
  let query = supabase
    .from("properties")
    .select(PROPERTY_LIST_SELECT)
    .eq("status", "live")
    .order("created_at", { ascending: false });

  if (filters?.area) query = query.eq("area", filters.area);
  if (filters?.type) query = query.eq("property_type", filters.type);
  if (filters?.minPrice) query = query.gte("price_monthly", filters.minPrice);
  if (filters?.maxPrice) query = query.lte("price_monthly", filters.maxPrice);
  if (filters?.rentalMode && filters.rentalMode !== "all") {
    query = query.or(`rental_mode.eq.${filters.rentalMode},rental_mode.eq.both`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as PropertyRow[];
}

export async function getFeaturedProperties(limit = 6) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("properties")
    .select(PROPERTY_LIST_SELECT)
    .eq("status", "live")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as PropertyRow[];
}

export async function getPropertyBySlug(slug: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("properties")
    .select(PROPERTY_DETAIL_SELECT)
    .eq("slug", slug)
    .single();
  if (error) return null;
  // Cast via unknown: typegen models short_stay_rates as an array, but PostgREST
  // embeds it as a single object because property_id is UNIQUE.
  return data as unknown as PropertyDetailRow;
}

// Uses a cookie-free client safe for generateStaticParams at build time
export async function getLiveSlugs() {
  const supabase = createBuildClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const { data } = await supabase
    .from("properties")
    .select("slug")
    .eq("status", "live");
  return (data ?? []).map((r) => r.slug as string);
}
