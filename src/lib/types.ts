// VeriHome — shared TypeScript interfaces

export interface Property {
  id: string;
  slug: string;
  title: string;
  title_id?: string;
  area: string;
  district: string;
  property_type: "apartment" | "kost" | "house" | "villa";
  price_per_month: number;
  bedrooms: number;
  bathrooms: number;
  size_sqm: number;
  available_from: string;
  min_stay_months: number;
  status: "live" | "unverified" | "pending" | "archived";
  submission_type: "owner" | "agent" | "curated";
  is_featured: boolean;
  published_at: string | null;
  thumbnail_url?: string;
  rla_score?: number;
}

export interface PropertyMedia {
  id: string;
  property_id: string;
  url: string;
  media_type: "photo" | "video";
  is_primary: boolean;
  order_index: number;
}

export interface PropertyDetails {
  property_id: string;
  furnished: "full" | "semi" | "unfurnished";
  has_ac: boolean;
  has_wifi: boolean;
  has_parking: boolean;
  has_gym: boolean;
  has_pool: boolean;
  has_kitchen: boolean;
  contract_type: string;
  utilities_included: string[];
  utilities_excluded: string[];
  house_rules: string[];
  facilities: string[];
  pros: string[];
  cons: string[];
}

export interface RLAAssessment {
  property_id: string;
  rla_score: number;
  building_condition: number;
  natural_lighting: number;
  bathroom: number;
  ventilation: number;
  noise_level: string;
  security_level: string;
  assessor_notes: string;
  assessed_at: string;
}

export interface AreaOverview {
  area_slug: string;
  name: string;
  description: string;
  expat_friendly: boolean;
  nearby: NearbyPlace[];
  vibe_tags: string[];
}

export interface NearbyPlace {
  name: string;
  distance: string;
}

export interface Review {
  id: string;
  property_id: string;
  reviewer_name: string;
  rating: number;
  comment: string;
  moderation_status: "pending" | "approved" | "rejected";
  created_at: string;
}

export interface User {
  id: string;
  email: string;
  full_name: string;
  phone?: string;
  nationality?: string;
  is_active_client: boolean;
  role: "user" | "admin";
  created_at: string;
}

export interface SavedListing {
  id: string;
  user_id: string;
  property_id: string;
  saved_at: string;
  property?: Property;
}

export interface Consultation {
  id: string;
  user_id: string;
  property_id: string;
  package_type: "basic" | "premium";
  status: "pending" | "paid" | "scheduled" | "completed" | "cancelled";
  amount: number;
  payment_url?: string;
  booking_url?: string;
  created_at: string;
  scheduled_at?: string;
}

export interface Appointment {
  id: string;
  user_id: string;
  property_id: string;
  appointment_type: "viewing" | "consultation";
  status: "pending" | "confirmed" | "cancelled" | "completed";
  scheduled_at: string;
  advisor_name?: string;
  notes?: string;
  property?: Property;
}

export interface PublishChecklist {
  property_id: string;
  photos_uploaded: boolean;
  rla_completed: boolean;
  area_overview_filled: boolean;
  description_written: boolean;
  pricing_confirmed: boolean;
  legal_verified: boolean;
}
