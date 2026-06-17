import { createClient } from "./server";
import { createClient as createBuildClient } from "@supabase/supabase-js";

export type PropertyRow = {
  id: string;
  name: string;
  slug: string;
  property_type: "kost" | "apartment" | "house";
  status: string;
  price_monthly: number;
  area: string;
  address: string;
  size_sqm: number;
  bedrooms: number;
  bathrooms: number;
  min_stay_months: number;
  photo_urls: string[];
  rla_assessments: {
    rla_score: number;
    building_condition: number;
    natural_lighting: number;
    bathroom_condition: number;
    ventilation: number;
    noise_level: string;
    water_pressure: string;
    security_level: string;
    pros: string[];
    cons: string[];
    overall_notes: string;
  }[];
};

export type PropertyDetailRow = PropertyRow & {
  property_details: {
    included_utilities: string[];
    facilities: string[];
    rules: string;
  }[];
  area_overviews: {
    nearest_mrt: string;
    walk_time_to_transit_min: number;
    nearest_minimarket: string;
    nearest_clinic: string;
    neighborhood_character: string;
    expat_friendly: boolean;
    time_to_scbd_min: number;
    time_to_sudirman_min: number;
  }[];
};

const PROPERTY_LIST_SELECT = `
  id, name, slug, property_type, status, price_monthly, area, address, size_sqm, bedrooms, bathrooms, min_stay_months, photo_urls,
  rla_assessments ( rla_score, building_condition, natural_lighting, bathroom_condition, ventilation, noise_level, water_pressure, security_level, pros, cons, overall_notes )
`;

const PROPERTY_DETAIL_SELECT = `
  ${PROPERTY_LIST_SELECT},
  property_details ( included_utilities, facilities, rules ),
  area_overviews ( nearest_mrt, walk_time_to_transit_min, nearest_minimarket, nearest_clinic, neighborhood_character, expat_friendly, time_to_scbd_min, time_to_sudirman_min )
`;

export async function getLiveProperties(filters?: {
  area?: string;
  type?: string;
  minPrice?: number;
  maxPrice?: number;
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
  return data as PropertyDetailRow;
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
