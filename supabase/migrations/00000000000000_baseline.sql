-- ============================================================================
-- Cosystem — production schema (project still named verihome in Supabase)
-- Project ref : hxktoewssuahtkrksbpx   (org "maldev", region ap-northeast-1)
-- Postgres    : 17.6.1.127
-- Captured    : 2026-11-21, read-only, from the live database's system catalogs
--
-- HOW THIS WAS MADE, AND WHAT THAT MEANS
-- This file was reconstructed from pg_catalog / information_schema, not produced
-- by pg_dump. Every statement below was read out of the running database
-- (pg_get_constraintdef, pg_get_functiondef, pg_get_triggerdef, pg_indexes,
-- pg_policies, information_schema privileges), so nothing here is invented.
-- It is still a reconstruction: pg_dump remains the reference tool for a backup
-- you may one day restore from. Treat this as the schema of record for
-- rebuilding, and verify by replaying it into an empty Postgres 17 before
-- trusting it (see section 20.4 of the system reference).
--
-- WHAT IS DELIBERATELY NOT HERE
--   * No data. Not one row. See the separate data file.
--   * No Supabase-managed schemas (auth, storage, realtime, vault, extensions).
--     The local Supabase stack creates those itself.
--
-- TWO DEPENDENCIES ON THE auth SCHEMA, which must exist before this runs:
--   * public.users.id is a foreign key to auth.users(id)
--   * the trigger on_auth_user_created sits on auth.users
--
-- ORDER MATTERS in two places and is already correct:
--   * extensions first — column defaults call uuid_generate_v4() and
--     gen_random_uuid()
--   * ledger_account_kind() before the four SQL-language ledger_* reporting
--     functions that call it. plpgsql bodies are not validated at creation,
--     but SQL-language bodies are, so those four would fail if it came later.
-- ============================================================================

-- ─── 0. Search path ─────────────────────────────────────────────────────────
-- Supabase installs extensions into a schema called "extensions" and puts that
-- schema on the database's search_path, so uuid_generate_v4() and
-- gen_random_uuid() resolve unqualified. A plain Postgres does not, and the
-- very first CREATE TABLE below then fails with
--   ERROR: function uuid_generate_v4() does not exist
-- because column defaults are resolved at creation time. Setting it here makes
-- this file replay anywhere, which is the whole point of having it.
-- (Found by actually replaying this file into an empty Postgres 17, not by
-- reading it.)

SET search_path TO public, extensions;

-- ─── 1. Extensions ──────────────────────────────────────────────────────────
-- Installed in the "extensions" schema by Supabase. Listed for completeness;
-- a stock Supabase project already has these.
CREATE SCHEMA IF NOT EXISTS extensions;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp"          WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "pgcrypto"           WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA extensions;
-- supabase_vault is managed by the platform and is not created here.

-- ─── 2. Tables (26) ─────────────────────────────────────────────────────────
-- Constraints are added separately below so table order does not matter.

CREATE TABLE public.area_overviews (
  id uuid default uuid_generate_v4() not null,
  property_id uuid,
  nearest_mrt text,
  walk_time_to_transit_min integer,
  nearest_minimarket text,
  nearest_clinic text,
  neighborhood_character text,
  time_to_scbd_min integer,
  time_to_sudirman_min integer,
  area_notes text,
  mrt_distance text,
  nearest_transjakarta text,
  transjakarta_distance text,
  nearest_food text,
  nearest_gym text,
  expat_friendly integer,
  survey_id uuid
);

CREATE TABLE public.availability_blocks (
  id uuid default gen_random_uuid() not null,
  property_id uuid not null,
  start_date date not null,
  end_date date not null,
  reason text default 'booked'::text not null,
  booking_id uuid,
  created_at timestamp with time zone default now() not null,
  created_by_owner uuid,
  note text
);

CREATE TABLE public.bookings (
  id uuid default gen_random_uuid() not null,
  booking_code text not null,
  property_id uuid not null,
  user_id uuid not null,
  booking_type text default 'short_stay'::text not null,
  check_in_date date not null,
  check_out_date date not null,
  nights integer GENERATED ALWAYS AS ((check_out_date - check_in_date)) STORED not null,
  guests integer default 1 not null,
  price_per_night numeric(12,0) default 0 not null,
  cleaning_fee numeric(12,0) default 0 not null,
  total_price numeric(12,0) not null,
  status text default 'pending'::text not null,
  payment_status text default 'unpaid'::text not null,
  payment_provider text default 'manual'::text not null,
  bank_transfer_code text,
  payment_proof_url text,
  admin_notes text,
  confirmed_at timestamp with time zone,
  cancelled_at timestamp with time zone,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  expires_at timestamp with time zone,
  checkin_reminder_sent_at timestamp with time zone,
  expiry_reminder_sent_at timestamp with time zone,
  payment_external_id text,
  security_deposit numeric(12,0) default 0 not null,
  credit_applied numeric(12,0) default 0 not null,
  commission_pct numeric(5,2),
  cleaning_fee_goes_to text
);

CREATE TABLE public.consultations (
  id uuid default uuid_generate_v4() not null,
  property_id uuid,
  user_id uuid,
  package_type text,
  price integer,
  status text default 'pending'::text,
  cal_booking_id text,
  xendit_invoice_id text,
  scheduled_at timestamp with time zone,
  completed_at timestamp with time zone,
  notes text,
  created_at timestamp with time zone default now(),
  credit_applied numeric(12,2) default 0 not null,
  final_price numeric(12,2),
  payment_status text default 'unpaid'::text not null,
  payment_proof_url text,
  bank_transfer_code text,
  payment_external_id text,
  payment_provider text default 'manual'::text not null
);

CREATE TABLE public.cron_runs (
  id uuid default gen_random_uuid() not null,
  started_at timestamp with time zone default now() not null,
  finished_at timestamp with time zone,
  step text not null,
  candidates integer default 0 not null,
  succeeded integer default 0 not null,
  failed integer default 0 not null,
  errors jsonb default '[]'::jsonb
);

CREATE TABLE public.ledger_entries (
  id uuid default gen_random_uuid() not null,
  entry_date timestamp with time zone default now() not null,
  event_type text not null,
  account text not null,
  direction text not null,
  amount numeric(12,0) not null,
  booking_id uuid,
  viewing_id uuid,
  consultation_id uuid,
  property_id uuid,
  user_id uuid,
  owner_id uuid,
  description text,
  created_by uuid,
  reversed_by uuid,
  created_at timestamp with time zone default now() not null
);

CREATE TABLE public.owner_change_requests (
  id uuid default gen_random_uuid() not null,
  owner_id uuid not null,
  property_id uuid,
  kind text not null,
  proposed jsonb not null,
  previous jsonb,
  status text default 'pending'::text not null,
  reviewed_by uuid,
  reviewed_at timestamp with time zone,
  review_note text,
  created_at timestamp with time zone default now() not null
);

CREATE TABLE public.owner_documents (
  id uuid default gen_random_uuid() not null,
  owner_id uuid not null,
  kind text not null,
  object_key text not null,
  original_name text,
  uploaded_at timestamp with time zone default now() not null,
  uploaded_by uuid
);

CREATE TABLE public.owner_invites (
  id uuid default gen_random_uuid() not null,
  owner_id uuid not null,
  token_hash text not null,
  expires_at timestamp with time zone not null,
  used_at timestamp with time zone,
  used_by uuid,
  created_by uuid,
  created_at timestamp with time zone default now() not null,
  revoked_at timestamp with time zone
);

CREATE TABLE public.owners (
  id uuid default uuid_generate_v4() not null,
  name text not null,
  phone_whatsapp text,
  email text,
  id_type text,
  id_number text,
  verification_status text default 'unverified'::text,
  cooperation_status text default 'active'::text,
  notes text,
  created_at timestamp with time zone default now(),
  user_id uuid,
  portal_access text default 'none'::text not null,
  invited_at timestamp with time zone,
  activated_at timestamp with time zone,
  payout_bank text,
  payout_account_number text,
  payout_account_holder text,
  payout_verified_at timestamp with time zone,
  payout_verified_by uuid
);

CREATE TABLE public.pending_survey_imports (
  id uuid default uuid_generate_v4() not null,
  tally_submission_id text,
  raw_payload jsonb,
  property_name_text text,
  status text default 'pending'::text,
  linked_property_id uuid,
  created_at timestamp with time zone default now()
);

CREATE TABLE public.placements (
  id uuid default gen_random_uuid() not null,
  property_id uuid,
  user_id uuid,
  viewing_id uuid,
  monthly_rent numeric(12,0) not null,
  commission_pct numeric(5,2) not null,
  commission_amount numeric(12,0) not null,
  status text default 'reported'::text,
  lease_start_date date,
  reported_by text,
  notes text,
  created_at timestamp with time zone default now()
);

CREATE TABLE public.platform_settings (
  id integer default 1 not null,
  default_commission_pct numeric(5,2),
  updated_at timestamp with time zone default now() not null,
  updated_by uuid
);

CREATE TABLE public.properties (
  id uuid default uuid_generate_v4() not null,
  name text not null,
  slug text not null,
  property_type text,
  status text default 'new_lead'::text,
  submission_type text,
  price_monthly integer,
  area text,
  address text,
  size_sqm numeric,
  bedrooms integer,
  bathrooms integer,
  available_from date,
  min_stay_months integer default 1,
  owner_id uuid,
  approved_at timestamp with time zone,
  published_at timestamp with time zone,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  photo_urls text[] default '{}'::text[],
  google_maps_url text,
  rejection_reason text,
  rental_mode text default 'long_term'::text not null,
  is_furnished boolean default false not null,
  is_instant_bookable boolean default false not null,
  platform_commission_pct numeric(5,2),
  cleaning_fee_goes_to text default 'platform'::text
);

CREATE TABLE public.property_details (
  id uuid default uuid_generate_v4() not null,
  property_id uuid,
  included_utilities jsonb default '{}'::jsonb,
  facilities jsonb default '[]'::jsonb,
  rules text,
  additional_notes text
);

CREATE TABLE public.property_media (
  id uuid default uuid_generate_v4() not null,
  property_id uuid,
  video_url text,
  media_status text default 'pending'::text,
  uploaded_at timestamp with time zone,
  photos_exterior jsonb default '[]'::jsonb,
  photos_common_area jsonb default '[]'::jsonb,
  photos_unit jsonb default '[]'::jsonb,
  photos_bathroom jsonb default '[]'::jsonb,
  total_photo_count integer GENERATED ALWAYS AS ((((jsonb_array_length(COALESCE(photos_exterior, '[]'::jsonb)) + jsonb_array_length(COALESCE(photos_common_area, '[]'::jsonb))) + jsonb_array_length(COALESCE(photos_unit, '[]'::jsonb))) + jsonb_array_length(COALESCE(photos_bathroom, '[]'::jsonb)))) STORED,
  survey_id uuid
);

CREATE TABLE public.property_surveys (
  id uuid default uuid_generate_v4() not null,
  property_id uuid,
  survey_date date not null,
  surveyor_name text not null,
  pic_name text not null,
  pic_whatsapp text not null,
  duration_minutes integer,
  video_walkthrough_url text,
  created_at timestamp with time zone default now(),
  submitted_by uuid
);

CREATE TABLE public.publish_checklist (
  id uuid default uuid_generate_v4() not null,
  property_id uuid,
  min_photos_uploaded boolean default false,
  video_walkthrough_done boolean default false,
  rla_completed boolean default false,
  pros_cons_written boolean default false,
  price_verified boolean default false,
  owner_contact_active boolean default false,
  area_overview_filled boolean default false,
  rental_mode_configured boolean default false not null
);

CREATE TABLE public.reviews (
  id uuid default uuid_generate_v4() not null,
  property_id uuid,
  user_id uuid,
  overall_rating integer,
  value_rating integer,
  accuracy_rating integer,
  owner_rating integer,
  location_rating integer,
  review_text text,
  moderation_status text default 'pending'::text,
  published_at timestamp with time zone,
  created_at timestamp with time zone default now()
);

CREATE TABLE public.rla_assessments (
  id uuid default uuid_generate_v4() not null,
  property_id uuid,
  building_condition integer,
  natural_lighting integer,
  bathroom_condition integer,
  ventilation integer,
  overall_notes text,
  issues_found text,
  pros jsonb default '[]'::jsonb,
  cons jsonb default '[]'::jsonb,
  assessed_at timestamp with time zone default now(),
  noise_level integer,
  security_level integer,
  cleanliness integer,
  furniture_quality integer,
  rla_score numeric GENERATED ALWAYS AS ((((((((((COALESCE(building_condition, 0) + COALESCE(natural_lighting, 0)) + COALESCE(ventilation, 0)) + COALESCE(noise_level, 0)) + COALESCE(cleanliness, 0)) + COALESCE(security_level, 0)) + COALESCE(bathroom_condition, 0)) + COALESCE(furniture_quality, 0)))::numeric / 8.0)) STORED,
  survey_id uuid
);

CREATE TABLE public.saved_listings (
  id uuid default uuid_generate_v4() not null,
  user_id uuid,
  property_id uuid,
  saved_at timestamp with time zone default now(),
  saved_price numeric(12,0)
);

CREATE TABLE public.short_stay_rates (
  id uuid default gen_random_uuid() not null,
  property_id uuid not null,
  price_per_night numeric(12,0) not null,
  price_per_night_weekend numeric(12,0),
  min_nights integer default 1 not null,
  max_nights integer,
  cleaning_fee numeric(12,0) default 0 not null,
  active boolean default true not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  price_per_week numeric(12,0),
  price_per_month numeric(12,0),
  security_deposit numeric(12,0) default 0 not null,
  check_in_time text default '14:00'::text not null,
  check_out_time text default '12:00'::text not null,
  buffer_days integer default 0 not null
);

CREATE TABLE public.survey_import_log (
  id uuid default uuid_generate_v4() not null,
  tally_submission_id text,
  property_id uuid,
  match_confidence text,
  raw_payload jsonb,
  imported_at timestamp with time zone default now()
);

CREATE TABLE public.user_credits (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  amount numeric(12,0) not null,
  reason text not null,
  viewing_id uuid,
  created_at timestamp with time zone default now() not null,
  expires_at timestamp with time zone,
  redeemed_at timestamp with time zone,
  booking_id uuid,
  consultation_id uuid,
  status text default 'active'::text not null,
  refund_requested_at timestamp with time zone,
  refunded_at timestamp with time zone
);

CREATE TABLE public.users (
  id uuid not null,
  name text,
  email text,
  phone_whatsapp text,
  user_type text,
  preferred_area text,
  budget_min integer,
  budget_max integer,
  is_active_client boolean default false,
  created_at timestamp with time zone default now(),
  is_admin boolean default false,
  is_surveyor boolean default false not null
);

CREATE TABLE public.viewings (
  id uuid default uuid_generate_v4() not null,
  property_id uuid,
  user_id uuid,
  preferred_dates jsonb default '[]'::jsonb,
  status text default 'pending'::text,
  confirmed_at timestamp with time zone,
  team_notes text,
  created_at timestamp with time zone default now(),
  deposit_amount numeric(12,0) not null,
  deposit_paid boolean default false not null,
  deposit_paid_at timestamp with time zone,
  deposit_refunded boolean default false not null,
  deposit_refunded_at timestamp with time zone,
  payment_proof_url text,
  bank_transfer_code text,
  attended boolean,
  attended_at timestamp with time zone,
  credit_issued boolean default false not null,
  credit_issued_at timestamp with time zone,
  cancelled_at timestamp with time zone,
  cancel_reason text,
  scheduled_at timestamp with time zone,
  deposit_refund_requested_at timestamp with time zone,
  payment_external_id text,
  payment_provider text default 'manual'::text not null,
  policy_acknowledged_at timestamp with time zone,
  policy_version text
);

-- ─── 3. Primary keys ────────────────────────────────────────────────────────

ALTER TABLE public.area_overviews ADD CONSTRAINT area_overviews_pkey PRIMARY KEY (id);
ALTER TABLE public.availability_blocks ADD CONSTRAINT availability_blocks_pkey PRIMARY KEY (id);
ALTER TABLE public.bookings ADD CONSTRAINT bookings_pkey PRIMARY KEY (id);
ALTER TABLE public.consultations ADD CONSTRAINT consultations_pkey PRIMARY KEY (id);
ALTER TABLE public.cron_runs ADD CONSTRAINT cron_runs_pkey PRIMARY KEY (id);
ALTER TABLE public.ledger_entries ADD CONSTRAINT ledger_entries_pkey PRIMARY KEY (id);
ALTER TABLE public.owner_change_requests ADD CONSTRAINT owner_change_requests_pkey PRIMARY KEY (id);
ALTER TABLE public.owner_documents ADD CONSTRAINT owner_documents_pkey PRIMARY KEY (id);
ALTER TABLE public.owner_invites ADD CONSTRAINT owner_invites_pkey PRIMARY KEY (id);
ALTER TABLE public.owners ADD CONSTRAINT owners_pkey PRIMARY KEY (id);
ALTER TABLE public.pending_survey_imports ADD CONSTRAINT pending_survey_imports_pkey PRIMARY KEY (id);
ALTER TABLE public.placements ADD CONSTRAINT placements_pkey PRIMARY KEY (id);
ALTER TABLE public.platform_settings ADD CONSTRAINT platform_settings_pkey PRIMARY KEY (id);
ALTER TABLE public.properties ADD CONSTRAINT properties_pkey PRIMARY KEY (id);
ALTER TABLE public.property_details ADD CONSTRAINT property_details_pkey PRIMARY KEY (id);
ALTER TABLE public.property_media ADD CONSTRAINT property_media_pkey PRIMARY KEY (id);
ALTER TABLE public.property_surveys ADD CONSTRAINT property_surveys_pkey PRIMARY KEY (id);
ALTER TABLE public.publish_checklist ADD CONSTRAINT publish_checklist_pkey PRIMARY KEY (id);
ALTER TABLE public.reviews ADD CONSTRAINT reviews_pkey PRIMARY KEY (id);
ALTER TABLE public.rla_assessments ADD CONSTRAINT rla_assessments_pkey PRIMARY KEY (id);
ALTER TABLE public.saved_listings ADD CONSTRAINT saved_listings_pkey PRIMARY KEY (id);
ALTER TABLE public.short_stay_rates ADD CONSTRAINT short_stay_rates_pkey PRIMARY KEY (id);
ALTER TABLE public.survey_import_log ADD CONSTRAINT survey_import_log_pkey PRIMARY KEY (id);
ALTER TABLE public.user_credits ADD CONSTRAINT user_credits_pkey PRIMARY KEY (id);
ALTER TABLE public.users ADD CONSTRAINT users_pkey PRIMARY KEY (id);
ALTER TABLE public.viewings ADD CONSTRAINT viewings_pkey PRIMARY KEY (id);

-- ─── 4. Unique constraints ──────────────────────────────────────────────────
-- short_stay_rates and publish_checklist are UNIQUE on property_id, which is
-- load-bearing: it makes PostgREST embed them as an object, not an array.

ALTER TABLE public.bookings ADD CONSTRAINT bookings_booking_code_key UNIQUE (booking_code);
ALTER TABLE public.owner_invites ADD CONSTRAINT owner_invites_token_hash_key UNIQUE (token_hash);
ALTER TABLE public.owners ADD CONSTRAINT owners_user_id_key UNIQUE (user_id);
ALTER TABLE public.pending_survey_imports ADD CONSTRAINT pending_survey_imports_tally_submission_id_key UNIQUE (tally_submission_id);
ALTER TABLE public.properties ADD CONSTRAINT properties_slug_key UNIQUE (slug);
ALTER TABLE public.publish_checklist ADD CONSTRAINT publish_checklist_property_id_key UNIQUE (property_id);
ALTER TABLE public.saved_listings ADD CONSTRAINT saved_listings_user_id_property_id_key UNIQUE (user_id, property_id);
ALTER TABLE public.short_stay_rates ADD CONSTRAINT short_stay_rates_property_id_key UNIQUE (property_id);
ALTER TABLE public.survey_import_log ADD CONSTRAINT survey_import_log_tally_submission_id_key UNIQUE (tally_submission_id);

-- ─── 5. Foreign keys (54) ───────────────────────────────────────────────────

ALTER TABLE public.area_overviews ADD CONSTRAINT area_overviews_property_id_fkey FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE;
ALTER TABLE public.area_overviews ADD CONSTRAINT area_overviews_survey_id_fkey FOREIGN KEY (survey_id) REFERENCES property_surveys(id);
ALTER TABLE public.availability_blocks ADD CONSTRAINT availability_blocks_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE SET NULL;
ALTER TABLE public.availability_blocks ADD CONSTRAINT availability_blocks_created_by_owner_fkey FOREIGN KEY (created_by_owner) REFERENCES owners(id);
ALTER TABLE public.availability_blocks ADD CONSTRAINT availability_blocks_property_id_fkey FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE;
ALTER TABLE public.bookings ADD CONSTRAINT bookings_property_id_fkey FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE RESTRICT;
ALTER TABLE public.bookings ADD CONSTRAINT bookings_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT;
ALTER TABLE public.consultations ADD CONSTRAINT consultations_property_id_fkey FOREIGN KEY (property_id) REFERENCES properties(id);
ALTER TABLE public.consultations ADD CONSTRAINT consultations_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id);
ALTER TABLE public.ledger_entries ADD CONSTRAINT ledger_entries_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES bookings(id);
ALTER TABLE public.ledger_entries ADD CONSTRAINT ledger_entries_consultation_id_fkey FOREIGN KEY (consultation_id) REFERENCES consultations(id);
ALTER TABLE public.ledger_entries ADD CONSTRAINT ledger_entries_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id);
ALTER TABLE public.ledger_entries ADD CONSTRAINT ledger_entries_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES owners(id);
ALTER TABLE public.ledger_entries ADD CONSTRAINT ledger_entries_property_id_fkey FOREIGN KEY (property_id) REFERENCES properties(id);
ALTER TABLE public.ledger_entries ADD CONSTRAINT ledger_entries_reversed_by_fkey FOREIGN KEY (reversed_by) REFERENCES ledger_entries(id);
ALTER TABLE public.ledger_entries ADD CONSTRAINT ledger_entries_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id);
ALTER TABLE public.ledger_entries ADD CONSTRAINT ledger_entries_viewing_id_fkey FOREIGN KEY (viewing_id) REFERENCES viewings(id);
ALTER TABLE public.owner_change_requests ADD CONSTRAINT owner_change_requests_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES owners(id);
ALTER TABLE public.owner_change_requests ADD CONSTRAINT owner_change_requests_property_id_fkey FOREIGN KEY (property_id) REFERENCES properties(id);
ALTER TABLE public.owner_change_requests ADD CONSTRAINT owner_change_requests_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES users(id);
ALTER TABLE public.owner_documents ADD CONSTRAINT owner_documents_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES owners(id) ON DELETE CASCADE;
ALTER TABLE public.owner_documents ADD CONSTRAINT owner_documents_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES users(id);
ALTER TABLE public.owner_invites ADD CONSTRAINT owner_invites_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id);
ALTER TABLE public.owner_invites ADD CONSTRAINT owner_invites_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES owners(id) ON DELETE CASCADE;
ALTER TABLE public.owner_invites ADD CONSTRAINT owner_invites_used_by_fkey FOREIGN KEY (used_by) REFERENCES users(id);
ALTER TABLE public.owners ADD CONSTRAINT owners_payout_verified_by_fkey FOREIGN KEY (payout_verified_by) REFERENCES users(id);
ALTER TABLE public.owners ADD CONSTRAINT owners_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id);
ALTER TABLE public.pending_survey_imports ADD CONSTRAINT pending_survey_imports_linked_property_id_fkey FOREIGN KEY (linked_property_id) REFERENCES properties(id);
ALTER TABLE public.placements ADD CONSTRAINT placements_property_id_fkey FOREIGN KEY (property_id) REFERENCES properties(id);
ALTER TABLE public.placements ADD CONSTRAINT placements_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id);
ALTER TABLE public.placements ADD CONSTRAINT placements_viewing_id_fkey FOREIGN KEY (viewing_id) REFERENCES viewings(id);
ALTER TABLE public.platform_settings ADD CONSTRAINT platform_settings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES users(id);
ALTER TABLE public.properties ADD CONSTRAINT properties_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES owners(id);
ALTER TABLE public.property_details ADD CONSTRAINT property_details_property_id_fkey FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE;
ALTER TABLE public.property_media ADD CONSTRAINT property_media_property_id_fkey FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE;
ALTER TABLE public.property_media ADD CONSTRAINT property_media_survey_id_fkey FOREIGN KEY (survey_id) REFERENCES property_surveys(id);
ALTER TABLE public.property_surveys ADD CONSTRAINT property_surveys_property_id_fkey FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE;
ALTER TABLE public.property_surveys ADD CONSTRAINT property_surveys_submitted_by_fkey FOREIGN KEY (submitted_by) REFERENCES users(id);
ALTER TABLE public.publish_checklist ADD CONSTRAINT publish_checklist_property_id_fkey FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE;
ALTER TABLE public.reviews ADD CONSTRAINT reviews_property_id_fkey FOREIGN KEY (property_id) REFERENCES properties(id);
ALTER TABLE public.reviews ADD CONSTRAINT reviews_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id);
ALTER TABLE public.rla_assessments ADD CONSTRAINT rla_assessments_property_id_fkey FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE;
ALTER TABLE public.rla_assessments ADD CONSTRAINT rla_assessments_survey_id_fkey FOREIGN KEY (survey_id) REFERENCES property_surveys(id);
ALTER TABLE public.saved_listings ADD CONSTRAINT saved_listings_property_id_fkey FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE;
ALTER TABLE public.saved_listings ADD CONSTRAINT saved_listings_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE public.short_stay_rates ADD CONSTRAINT short_stay_rates_property_id_fkey FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE;
ALTER TABLE public.survey_import_log ADD CONSTRAINT survey_import_log_property_id_fkey FOREIGN KEY (property_id) REFERENCES properties(id);
ALTER TABLE public.user_credits ADD CONSTRAINT user_credits_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE SET NULL;
ALTER TABLE public.user_credits ADD CONSTRAINT user_credits_consultation_id_fkey FOREIGN KEY (consultation_id) REFERENCES consultations(id);
ALTER TABLE public.user_credits ADD CONSTRAINT user_credits_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE public.user_credits ADD CONSTRAINT user_credits_viewing_id_fkey FOREIGN KEY (viewing_id) REFERENCES viewings(id) ON DELETE SET NULL;
ALTER TABLE public.users ADD CONSTRAINT users_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id);
ALTER TABLE public.viewings ADD CONSTRAINT viewings_property_id_fkey FOREIGN KEY (property_id) REFERENCES properties(id);
ALTER TABLE public.viewings ADD CONSTRAINT viewings_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id);

-- ─── 6. Check constraints (48) ──────────────────────────────────────────────

ALTER TABLE public.area_overviews ADD CONSTRAINT area_overviews_expat_score_check CHECK (((expat_friendly >= 0) AND (expat_friendly <= 10)));
ALTER TABLE public.area_overviews ADD CONSTRAINT area_overviews_neighborhood_character_check CHECK ((neighborhood_character = ANY (ARRAY['quiet'::text, 'mixed'::text, 'busy'::text])));
ALTER TABLE public.availability_blocks ADD CONSTRAINT availability_blocks_dates_check CHECK ((end_date > start_date));
ALTER TABLE public.availability_blocks ADD CONSTRAINT availability_blocks_reason_check CHECK ((reason = ANY (ARRAY['booked'::text, 'maintenance'::text, 'owner_use'::text, 'other'::text])));
ALTER TABLE public.bookings ADD CONSTRAINT bookings_booking_type_check CHECK ((booking_type = ANY (ARRAY['short_stay'::text, 'long_term'::text, 'viewing'::text])));
ALTER TABLE public.bookings ADD CONSTRAINT bookings_cleaning_fee_goes_to_check CHECK (((cleaning_fee_goes_to IS NULL) OR (cleaning_fee_goes_to = ANY (ARRAY['platform'::text, 'owner'::text]))));
ALTER TABLE public.bookings ADD CONSTRAINT bookings_commission_pct_check CHECK (((commission_pct IS NULL) OR ((commission_pct >= (0)::numeric) AND (commission_pct <= (100)::numeric))));
ALTER TABLE public.bookings ADD CONSTRAINT bookings_payment_status_check CHECK ((payment_status = ANY (ARRAY['unpaid'::text, 'pending_verification'::text, 'paid'::text, 'refunded'::text])));
ALTER TABLE public.bookings ADD CONSTRAINT bookings_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'confirmed'::text, 'cancelled'::text, 'completed'::text, 'expired'::text])));
ALTER TABLE public.consultations ADD CONSTRAINT consultations_package_type_check CHECK ((package_type = ANY (ARRAY['basic'::text, 'premium'::text])));
ALTER TABLE public.consultations ADD CONSTRAINT consultations_payment_status_check CHECK ((payment_status = ANY (ARRAY['unpaid'::text, 'pending_verification'::text, 'paid'::text, 'complimentary'::text])));
ALTER TABLE public.ledger_entries ADD CONSTRAINT ledger_entries_account_check CHECK ((account = ANY (ARRAY['cash'::text, 'commission_receivable'::text, 'owner_payable'::text, 'deposits_held'::text, 'credits_outstanding'::text, 'unearned_revenue'::text, 'revenue_booking_margin'::text, 'revenue_consultation'::text, 'revenue_cleaning'::text, 'revenue_commission'::text, 'revenue_forfeited_deposit'::text, 'expense_operating'::text, 'equity_drawings'::text])));
ALTER TABLE public.ledger_entries ADD CONSTRAINT ledger_entries_amount_check CHECK ((amount >= (0)::numeric));
ALTER TABLE public.ledger_entries ADD CONSTRAINT ledger_entries_direction_check CHECK ((direction = ANY (ARRAY['debit'::text, 'credit'::text])));
ALTER TABLE public.ledger_entries ADD CONSTRAINT ledger_entries_event_type_check CHECK ((event_type = ANY (ARRAY['booking_payment_received'::text, 'booking_revenue_earned'::text, 'booking_refund_issued'::text, 'consultation_payment_received'::text, 'consultation_revenue_earned'::text, 'viewing_deposit_received'::text, 'viewing_deposit_refunded'::text, 'viewing_deposit_forfeited'::text, 'viewing_deposit_converted_to_credit'::text, 'security_deposit_received'::text, 'security_deposit_refunded'::text, 'security_deposit_claimed'::text, 'credit_issued'::text, 'credit_redeemed'::text, 'credit_expired'::text, 'credit_refunded'::text, 'owner_payout_due'::text, 'owner_payout_paid'::text, 'placement_commission_earned'::text, 'placement_commission_received'::text, 'cleaning_fee_received'::text, 'operating_expense_paid'::text, 'equity_drawing_paid'::text])));
ALTER TABLE public.owner_change_requests ADD CONSTRAINT owner_change_requests_kind_check CHECK ((kind = ANY (ARRAY['rate_change'::text, 'payout_account'::text])));
ALTER TABLE public.owner_change_requests ADD CONSTRAINT owner_change_requests_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'cancelled'::text])));
ALTER TABLE public.owner_documents ADD CONSTRAINT owner_documents_kind_check CHECK ((kind = ANY (ARRAY['right_to_let'::text, 'cooperation_agreement'::text])));
ALTER TABLE public.owners ADD CONSTRAINT owners_id_type_check CHECK ((id_type = ANY (ARRAY['ktp'::text, 'passport'::text])));
ALTER TABLE public.owners ADD CONSTRAINT owners_portal_access_check CHECK ((portal_access = ANY (ARRAY['none'::text, 'invited'::text, 'active'::text, 'revoked'::text])));
ALTER TABLE public.pending_survey_imports ADD CONSTRAINT pending_survey_imports_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'linked'::text, 'rejected'::text])));
ALTER TABLE public.placements ADD CONSTRAINT placements_reported_by_check CHECK ((reported_by = ANY (ARRAY['owner'::text, 'tenant'::text, 'team'::text])));
ALTER TABLE public.placements ADD CONSTRAINT placements_status_check CHECK ((status = ANY (ARRAY['reported'::text, 'invoiced'::text, 'paid'::text, 'disputed'::text, 'written_off'::text])));
ALTER TABLE public.platform_settings ADD CONSTRAINT platform_settings_default_commission_pct_check CHECK (((default_commission_pct IS NULL) OR ((default_commission_pct >= (0)::numeric) AND (default_commission_pct <= (100)::numeric))));
ALTER TABLE public.platform_settings ADD CONSTRAINT platform_settings_id_check CHECK ((id = 1));
ALTER TABLE public.properties ADD CONSTRAINT properties_cleaning_fee_goes_to_check CHECK ((cleaning_fee_goes_to = ANY (ARRAY['platform'::text, 'owner'::text])));
ALTER TABLE public.properties ADD CONSTRAINT properties_platform_commission_pct_check CHECK (((platform_commission_pct >= (0)::numeric) AND (platform_commission_pct <= (100)::numeric)));
ALTER TABLE public.properties ADD CONSTRAINT properties_property_type_check CHECK ((property_type = ANY (ARRAY['kost'::text, 'apartment'::text, 'house'::text])));
ALTER TABLE public.properties ADD CONSTRAINT properties_rental_mode_check CHECK ((rental_mode = ANY (ARRAY['long_term'::text, 'short_stay'::text, 'both'::text])));
ALTER TABLE public.properties ADD CONSTRAINT properties_status_check CHECK ((status = ANY (ARRAY['new_lead'::text, 'owner_approved'::text, 'survey_scheduled'::text, 'survey_completed'::text, 'draft'::text, 'approved'::text, 'live'::text, 'closed'::text, 'archived'::text])));
ALTER TABLE public.properties ADD CONSTRAINT properties_submission_type_check CHECK ((submission_type = ANY (ARRAY['owner'::text, 'internal'::text])));
ALTER TABLE public.reviews ADD CONSTRAINT reviews_accuracy_rating_check CHECK (((accuracy_rating >= 1) AND (accuracy_rating <= 5)));
ALTER TABLE public.reviews ADD CONSTRAINT reviews_location_rating_check CHECK (((location_rating >= 1) AND (location_rating <= 5)));
ALTER TABLE public.reviews ADD CONSTRAINT reviews_overall_rating_check CHECK (((overall_rating >= 1) AND (overall_rating <= 5)));
ALTER TABLE public.reviews ADD CONSTRAINT reviews_owner_rating_check CHECK (((owner_rating >= 1) AND (owner_rating <= 5)));
ALTER TABLE public.reviews ADD CONSTRAINT reviews_value_rating_check CHECK (((value_rating >= 1) AND (value_rating <= 5)));
ALTER TABLE public.rla_assessments ADD CONSTRAINT rla_assessments_bathroom_condition_check CHECK (((bathroom_condition >= 0) AND (bathroom_condition <= 10)));
ALTER TABLE public.rla_assessments ADD CONSTRAINT rla_assessments_building_condition_check CHECK (((building_condition >= 0) AND (building_condition <= 10)));
ALTER TABLE public.rla_assessments ADD CONSTRAINT rla_assessments_cleanliness_check CHECK (((cleanliness >= 0) AND (cleanliness <= 10)));
ALTER TABLE public.rla_assessments ADD CONSTRAINT rla_assessments_furniture_quality_check CHECK (((furniture_quality >= 0) AND (furniture_quality <= 10)));
ALTER TABLE public.rla_assessments ADD CONSTRAINT rla_assessments_natural_lighting_check CHECK (((natural_lighting >= 0) AND (natural_lighting <= 10)));
ALTER TABLE public.rla_assessments ADD CONSTRAINT rla_assessments_noise_level_check CHECK (((noise_level >= 0) AND (noise_level <= 10)));
ALTER TABLE public.rla_assessments ADD CONSTRAINT rla_assessments_security_level_check CHECK (((security_level >= 0) AND (security_level <= 10)));
ALTER TABLE public.rla_assessments ADD CONSTRAINT rla_assessments_ventilation_check CHECK (((ventilation >= 0) AND (ventilation <= 10)));
ALTER TABLE public.survey_import_log ADD CONSTRAINT survey_import_log_match_confidence_check CHECK ((match_confidence = ANY (ARRAY['auto_matched'::text, 'manual_required'::text, 'failed'::text])));
ALTER TABLE public.user_credits ADD CONSTRAINT user_credits_status_check CHECK ((status = ANY (ARRAY['active'::text, 'refund_requested'::text, 'refunded'::text, 'expired'::text])));
ALTER TABLE public.users ADD CONSTRAINT users_user_type_check CHECK ((user_type = ANY (ARRAY['intern'::text, 'local'::text, 'expat'::text])));
ALTER TABLE public.viewings ADD CONSTRAINT viewings_deposit_amount_check CHECK ((deposit_amount > (0)::numeric));

-- Note: viewings.status carries no CHECK constraint in production, unlike
-- bookings.status. Recorded as observed, not corrected.

-- ─── 7. Indexes (27 not already created by a constraint) ────────────────────
-- The three ledger_once_per_* partial unique indexes are the double-posting
-- guard: they enforce one posting per once-only event.

CREATE INDEX availability_blocks_property_dates_idx ON public.availability_blocks USING btree (property_id, start_date, end_date);
CREATE INDEX idx_blocks_created_by_owner ON public.availability_blocks USING btree (created_by_owner) WHERE (created_by_owner IS NOT NULL);
CREATE INDEX bookings_check_in_date_idx ON public.bookings USING btree (check_in_date);
CREATE UNIQUE INDEX bookings_payment_external_id_key ON public.bookings USING btree (payment_external_id) WHERE (payment_external_id IS NOT NULL);
CREATE INDEX bookings_property_id_idx ON public.bookings USING btree (property_id);
CREATE INDEX bookings_status_idx ON public.bookings USING btree (status);
CREATE INDEX bookings_user_id_idx ON public.bookings USING btree (user_id);
CREATE UNIQUE INDEX consultations_payment_external_id_key ON public.consultations USING btree (payment_external_id) WHERE (payment_external_id IS NOT NULL);
CREATE INDEX idx_cron_runs_failed ON public.cron_runs USING btree (started_at DESC) WHERE (failed > 0);
CREATE INDEX idx_cron_runs_started ON public.cron_runs USING btree (started_at DESC);
CREATE INDEX idx_ledger_account ON public.ledger_entries USING btree (account, entry_date);
CREATE INDEX idx_ledger_booking ON public.ledger_entries USING btree (booking_id);
CREATE INDEX idx_ledger_date ON public.ledger_entries USING btree (entry_date);
CREATE INDEX idx_ledger_owner ON public.ledger_entries USING btree (owner_id);
CREATE UNIQUE INDEX ledger_once_per_booking ON public.ledger_entries USING btree (event_type, booking_id, account, direction) WHERE ((booking_id IS NOT NULL) AND (event_type = ANY (ARRAY['booking_payment_received'::text, 'booking_revenue_earned'::text, 'credit_redeemed'::text])));
CREATE UNIQUE INDEX ledger_once_per_consultation ON public.ledger_entries USING btree (event_type, consultation_id, account, direction) WHERE ((consultation_id IS NOT NULL) AND (event_type = ANY (ARRAY['consultation_payment_received'::text, 'consultation_revenue_earned'::text, 'credit_redeemed'::text])));
CREATE UNIQUE INDEX ledger_once_per_viewing ON public.ledger_entries USING btree (event_type, viewing_id, account, direction) WHERE ((viewing_id IS NOT NULL) AND (event_type = ANY (ARRAY['viewing_deposit_received'::text, 'viewing_deposit_converted_to_credit'::text, 'viewing_deposit_forfeited'::text, 'viewing_deposit_refunded'::text])));
CREATE UNIQUE INDEX idx_ocr_one_pending_payout ON public.owner_change_requests USING btree (owner_id) WHERE ((kind = 'payout_account'::text) AND (status = 'pending'::text));
CREATE INDEX idx_ocr_owner ON public.owner_change_requests USING btree (owner_id);
CREATE INDEX idx_ocr_pending ON public.owner_change_requests USING btree (created_at) WHERE (status = 'pending'::text);
CREATE INDEX idx_owner_documents_owner ON public.owner_documents USING btree (owner_id);
CREATE INDEX idx_owner_invites_owner ON public.owner_invites USING btree (owner_id);
CREATE INDEX idx_placements_property ON public.placements USING btree (property_id);
CREATE INDEX idx_placements_status ON public.placements USING btree (status);
CREATE INDEX idx_property_surveys_submitted_by ON public.property_surveys USING btree (submitted_by);
CREATE INDEX user_credits_user_id_idx ON public.user_credits USING btree (user_id);
CREATE UNIQUE INDEX viewings_payment_external_id_key ON public.viewings USING btree (payment_external_id) WHERE (payment_external_id IS NOT NULL);
-- ============================================================================
-- VeriHome — functions (38)
--
-- In alphabetical order, which is not cosmetic: ledger_account_kind() must be
-- created before ledger_balances(), ledger_monthly_revenue(),
-- ledger_property_performance() and ledger_revenue_by_stream(), because those
-- four are SQL-language and their bodies ARE validated at creation time.
-- plpgsql bodies are not, so the settle_* functions may precede
-- post_ledger_entries() without trouble. Alphabetical order satisfies both.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.apply_consultation_credit(p_consultation_id uuid, p_user_id uuid)
 RETURNS TABLE(applied numeric, final_price numeric, fully_covered boolean)
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_hex       text;
  v_c         consultations%ROWTYPE;
  v_credit    user_credits%ROWTYPE;
  v_applied   numeric := 0;
  v_remaining numeric;
  v_final     numeric;
BEGIN
  v_hex := replace(p_user_id::text, '-', '');
  PERFORM pg_advisory_xact_lock(
    ('x' || left(v_hex,  8))::bit(32)::int,
    ('x' || right(v_hex, 8))::bit(32)::int
  );

  SELECT * INTO v_c FROM consultations WHERE id = p_consultation_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'consultation_not_found' USING ERRCODE = 'P0001';
  END IF;
  IF v_c.user_id IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'not_your_consultation' USING ERRCODE = 'P0001';
  END IF;
  IF v_c.payment_status = 'paid' THEN
    RAISE EXCEPTION 'already_paid' USING ERRCODE = 'P0001';
  END IF;
  IF COALESCE(v_c.credit_applied, 0) > 0 THEN
    RAISE EXCEPTION 'credit_already_applied' USING ERRCODE = 'P0001';
  END IF;

  v_remaining := v_c.price;

  FOR v_credit IN
    SELECT * FROM user_credits
     WHERE user_id    = p_user_id
       AND redeemed_at IS NULL
       AND status     = 'active'
       AND (expires_at IS NULL OR expires_at > now())
     ORDER BY expires_at ASC NULLS LAST, created_at ASC
     FOR UPDATE
  LOOP
    EXIT WHEN v_remaining <= 0;
    CONTINUE WHEN v_credit.amount > v_remaining;

    UPDATE user_credits
       SET redeemed_at     = now(),
           consultation_id = p_consultation_id
     WHERE id = v_credit.id;

    v_applied   := v_applied + v_credit.amount;
    v_remaining := v_remaining - v_credit.amount;
  END LOOP;

  IF v_applied = 0 THEN
    RETURN QUERY SELECT 0::numeric, v_c.price::numeric, false;
    RETURN;
  END IF;

  v_final := v_c.price - v_applied;

  UPDATE consultations
     SET credit_applied = v_applied,
         final_price    = v_final,
         payment_status = CASE WHEN v_final = 0 THEN 'paid' ELSE payment_status END,
         status         = CASE WHEN v_final = 0 THEN 'paid' ELSE status END
   WHERE id = p_consultation_id;

  PERFORM post_ledger_entries(jsonb_build_array(
    jsonb_build_object(
      'event_type','credit_redeemed','account','credits_outstanding','direction','debit',
      'amount',v_applied,'consultation_id',p_consultation_id,'user_id',p_user_id,
      'description','Kredit dipakai untuk konsultasi'),
    jsonb_build_object(
      'event_type','credit_redeemed','account','unearned_revenue','direction','credit',
      'amount',v_applied,'consultation_id',p_consultation_id,'user_id',p_user_id,
      'description','Sesi belum diberikan')
  ));

  RETURN QUERY SELECT v_applied, v_final, (v_final = 0);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.confirm_credit_refund(p_credit_id uuid, p_admin_id uuid)
 RETURNS user_credits
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_credit user_credits%ROWTYPE;
  v_hex text;
BEGIN
  SELECT * INTO v_credit FROM user_credits WHERE id = p_credit_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'credit_not_found' USING ERRCODE = 'P0001';
  END IF;
  IF v_credit.status <> 'refund_requested' THEN
    RAISE EXCEPTION 'no_refund_request' USING ERRCODE = 'P0001';
  END IF;

  v_hex := replace(v_credit.user_id::text, '-', '');
  PERFORM pg_advisory_xact_lock(
    ('x' || left(v_hex,  8))::bit(32)::int,
    ('x' || right(v_hex, 8))::bit(32)::int
  );

  UPDATE user_credits
     SET status = 'refunded', refunded_at = now()
   WHERE id = p_credit_id
  RETURNING * INTO v_credit;

  PERFORM post_ledger_entries(jsonb_build_array(
    jsonb_build_object(
      'event_type','credit_refunded','account','credits_outstanding','direction','debit',
      'amount',v_credit.amount,'user_id',v_credit.user_id,'viewing_id',v_credit.viewing_id,
      'created_by',p_admin_id,'description','Kredit ditukar kembali menjadi uang'),
    jsonb_build_object(
      'event_type','credit_refunded','account','cash','direction','credit',
      'amount',v_credit.amount,'user_id',v_credit.user_id,'viewing_id',v_credit.viewing_id,
      'created_by',p_admin_id,'description','Transfer pengembalian kredit')
  ));

  RETURN v_credit;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.create_booking_if_available(p_property_id uuid, p_user_id uuid, p_check_in date, p_check_out date, p_guests integer, p_price_per_night numeric, p_cleaning_fee numeric, p_total_price numeric, p_transfer_code text, p_expires_hours integer DEFAULT 48)
 RETURNS bookings
 LANGUAGE plpgsql
AS $function$
DECLARE v_booking bookings; v_code TEXT; v_buffer INT; v_hex TEXT;
BEGIN
  v_hex := replace(p_property_id::text, '-', '');
  PERFORM pg_advisory_xact_lock(('x'||left(v_hex,8))::bit(32)::int, ('x'||right(v_hex,8))::bit(32)::int);
  SELECT COALESCE(buffer_days,0) INTO v_buffer FROM short_stay_rates WHERE property_id=p_property_id AND active=true LIMIT 1;
  IF EXISTS(SELECT 1 FROM availability_blocks WHERE property_id=p_property_id AND start_date<p_check_out AND end_date+v_buffer>p_check_in FOR UPDATE) THEN
    RAISE EXCEPTION 'dates_unavailable' USING ERRCODE='P0001';
  END IF;
  v_code := generate_booking_code();
  INSERT INTO bookings(booking_code,property_id,user_id,check_in_date,check_out_date,guests,price_per_night,cleaning_fee,total_price,bank_transfer_code,expires_at)
  VALUES(v_code,p_property_id,p_user_id,p_check_in,p_check_out,p_guests,p_price_per_night,p_cleaning_fee,p_total_price,p_transfer_code,now()+(p_expires_hours||' hours')::interval)
  RETURNING * INTO v_booking;
  INSERT INTO availability_blocks(property_id,start_date,end_date,reason,booking_id) VALUES(p_property_id,p_check_in,p_check_out,'booked',v_booking.id);
  RETURN v_booking;
END;$function$
;

CREATE OR REPLACE FUNCTION public.create_booking_with_credits(p_property_id uuid, p_user_id uuid, p_check_in date, p_check_out date, p_guests integer, p_price_per_night numeric, p_cleaning_fee numeric, p_gross_price numeric, p_credit_amount numeric, p_total_price numeric, p_transfer_code text, p_expires_hours integer DEFAULT 48)
 RETURNS bookings
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_booking bookings; v_code TEXT; v_buffer INT; v_hex TEXT;
  v_credit user_credits%ROWTYPE; v_remaining NUMERIC := p_credit_amount;
  v_deduct NUMERIC; v_avail_total NUMERIC;
BEGIN
  v_hex := replace(p_property_id::text,'-','');
  PERFORM pg_advisory_xact_lock(('x'||left(v_hex,8))::bit(32)::int,('x'||right(v_hex,8))::bit(32)::int);

  IF p_credit_amount > 0 THEN
    SELECT COALESCE(SUM(amount),0) INTO v_avail_total
      FROM user_credits
     WHERE user_id = p_user_id AND redeemed_at IS NULL
       AND status = 'active'
       AND (expires_at IS NULL OR expires_at > now());
    IF v_avail_total < p_credit_amount THEN
      RAISE EXCEPTION 'insufficient_credits' USING ERRCODE='P0001';
    END IF;
  END IF;

  SELECT COALESCE(buffer_days,0) INTO v_buffer
    FROM short_stay_rates WHERE property_id=p_property_id AND active=true LIMIT 1;

  IF EXISTS(SELECT 1 FROM availability_blocks
             WHERE property_id=p_property_id
               AND start_date<p_check_out AND end_date+v_buffer>p_check_in
             FOR UPDATE) THEN
    RAISE EXCEPTION 'dates_unavailable' USING ERRCODE='P0001';
  END IF;

  v_code := generate_booking_code();

  INSERT INTO bookings(booking_code,property_id,user_id,check_in_date,check_out_date,
                       guests,price_per_night,cleaning_fee,total_price,credit_applied,
                       bank_transfer_code,expires_at)
  VALUES(v_code,p_property_id,p_user_id,p_check_in,p_check_out,
         p_guests,p_price_per_night,p_cleaning_fee,p_total_price,COALESCE(p_credit_amount,0),
         p_transfer_code,now()+(p_expires_hours||' hours')::interval)
  RETURNING * INTO v_booking;

  INSERT INTO availability_blocks(property_id,start_date,end_date,reason,booking_id)
  VALUES(p_property_id,p_check_in,p_check_out,'booked',v_booking.id);

  IF p_credit_amount > 0 THEN
    FOR v_credit IN
      SELECT * FROM user_credits
       WHERE user_id=p_user_id AND redeemed_at IS NULL
         AND status='active'
         AND (expires_at IS NULL OR expires_at>now())
       ORDER BY expires_at ASC NULLS LAST
       FOR UPDATE
    LOOP
      EXIT WHEN v_remaining<=0;
      v_deduct := LEAST(v_credit.amount, v_remaining);
      v_remaining := v_remaining - v_deduct;
      UPDATE user_credits SET redeemed_at=now(), booking_id=v_booking.id WHERE id=v_credit.id;
    END LOOP;
  END IF;

  RETURN v_booking;
END;$function$
;

CREATE OR REPLACE FUNCTION public.expire_single_booking(p_booking_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_property_id uuid;
  v_hex         TEXT;
  v_rows        INT := 0;
BEGIN
  SELECT property_id INTO v_property_id
    FROM bookings
   WHERE id             = p_booking_id
     AND payment_status = 'unpaid'
     AND status NOT IN ('confirmed', 'cancelled', 'expired', 'completed')
     AND expires_at IS NOT NULL
     AND expires_at < now();

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  v_hex := replace(v_property_id::text, '-', '');
  PERFORM pg_advisory_xact_lock(
    ('x' || left(v_hex,  8))::bit(32)::int,
    ('x' || right(v_hex, 8))::bit(32)::int
  );

  UPDATE bookings
     SET status     = 'expired',
         updated_at = now()
   WHERE id             = p_booking_id
     AND payment_status = 'unpaid'
     AND status NOT IN ('confirmed', 'cancelled', 'expired', 'completed')
     AND expires_at IS NOT NULL
     AND expires_at < now();

  GET DIAGNOSTICS v_rows = ROW_COUNT;

  IF v_rows = 0 THEN
    RETURN false;
  END IF;

  DELETE FROM availability_blocks WHERE booking_id = p_booking_id;

  RETURN true;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.expire_single_credit(p_credit_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
AS $function$
DECLARE v_c user_credits%ROWTYPE;
BEGIN
  SELECT * INTO v_c FROM user_credits WHERE id = p_credit_id FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;

  IF v_c.redeemed_at IS NOT NULL
     OR v_c.status <> 'active'
     OR v_c.expires_at IS NULL
     OR v_c.expires_at > now() THEN
    RETURN false;
  END IF;

  UPDATE user_credits SET status = 'expired' WHERE id = p_credit_id;

  IF COALESCE(v_c.amount, 0) > 0 THEN
    PERFORM post_ledger_entries(jsonb_build_array(
      jsonb_build_object('event_type','credit_expired','account','credits_outstanding','direction','debit',
        'amount',v_c.amount,'user_id',v_c.user_id,'viewing_id',v_c.viewing_id,
        'description','Credit expired'),
      jsonb_build_object('event_type','credit_expired','account','revenue_forfeited_deposit','direction','credit',
        'amount',v_c.amount,'user_id',v_c.user_id,'viewing_id',v_c.viewing_id,
        'description','Unspent credit lapsed')
    ));
  END IF;

  RETURN true;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.generate_booking_code()
 RETURNS text
 LANGUAGE plpgsql
AS $function$
DECLARE
  code TEXT;
  suffix TEXT;
BEGIN
  LOOP
    suffix := upper(substr(md5(random()::text), 1, 4));
    code := 'VH-' || to_char(now(), 'YYYYMMDD') || '-' || suffix;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM bookings WHERE booking_code = code);
  END LOOP;
  RETURN code;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_property_buffer_days(p_property_id uuid)
 RETURNS integer
 LANGUAGE sql
 STABLE
AS $function$
  SELECT COALESCE(
    (SELECT buffer_days FROM short_stay_rates
      WHERE property_id = p_property_id AND active = true
      LIMIT 1),
    0
  );
$function$
;

CREATE OR REPLACE FUNCTION public.get_user_credit_balance(p_user_id uuid)
 RETURNS numeric
 LANGUAGE sql
 STABLE
AS $function$
  SELECT COALESCE(SUM(amount), 0)
    FROM user_credits
   WHERE user_id     = p_user_id
     AND redeemed_at IS NULL
     AND (expires_at IS NULL OR expires_at > now());
$function$
;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.users (id, email, name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.issue_viewing_credit(p_viewing_id uuid)
 RETURNS user_credits
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_viewing  viewings;
  v_credit   user_credits;
  v_hex      TEXT;
BEGIN
  v_hex := replace(p_viewing_id::text, '-', '');
  PERFORM pg_advisory_xact_lock(
    ('x' || left(v_hex,  8))::bit(32)::int,
    ('x' || right(v_hex, 8))::bit(32)::int
  );

  SELECT * INTO v_viewing FROM viewings WHERE id = p_viewing_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'viewing_not_found' USING ERRCODE = 'P0001';
  END IF;

  IF v_viewing.deposit_paid IS NOT TRUE THEN
    RAISE EXCEPTION 'deposit_not_confirmed' USING ERRCODE = 'P0001';
  END IF;

  IF v_viewing.attended IS NOT TRUE THEN
    RAISE EXCEPTION 'viewing_not_attended' USING ERRCODE = 'P0001';
  END IF;

  IF v_viewing.credit_issued THEN
    SELECT * INTO v_credit FROM user_credits WHERE viewing_id = p_viewing_id LIMIT 1;
    RETURN v_credit;
  END IF;

  INSERT INTO user_credits (user_id, viewing_id, amount, reason, expires_at)
  VALUES (
    v_viewing.user_id,
    p_viewing_id,
    COALESCE(v_viewing.deposit_amount, 50000),
    'viewing_deposit',
    now() + interval '6 months'
  )
  RETURNING * INTO v_credit;

  UPDATE viewings
     SET credit_issued    = true,
         credit_issued_at = now()
   WHERE id = p_viewing_id;

  RETURN v_credit;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.ledger_account_kind(p_account text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
AS $function$
  SELECT CASE
    WHEN p_account IN ('cash','commission_receivable') THEN 'asset'
    WHEN p_account IN ('owner_payable','deposits_held','credits_outstanding','unearned_revenue') THEN 'liability'
    WHEN p_account IN ('expense_operating','equity_drawings') THEN 'expense'
    ELSE 'income'
  END;
$function$
;

CREATE OR REPLACE FUNCTION public.ledger_balances(p_from timestamp with time zone DEFAULT NULL::timestamp with time zone, p_to timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS TABLE(account text, kind text, debits numeric, credits numeric, balance numeric)
 LANGUAGE sql
 STABLE
AS $function$
  SELECT
    l.account,
    ledger_account_kind(l.account),
    COALESCE(SUM(l.amount) FILTER (WHERE l.direction = 'debit'),  0),
    COALESCE(SUM(l.amount) FILTER (WHERE l.direction = 'credit'), 0),
    CASE WHEN ledger_account_kind(l.account) IN ('asset','expense')
      THEN COALESCE(SUM(l.amount) FILTER (WHERE l.direction = 'debit'),  0)
         - COALESCE(SUM(l.amount) FILTER (WHERE l.direction = 'credit'), 0)
      ELSE COALESCE(SUM(l.amount) FILTER (WHERE l.direction = 'credit'), 0)
         - COALESCE(SUM(l.amount) FILTER (WHERE l.direction = 'debit'),  0)
    END
  FROM ledger_entries l
  WHERE (p_from IS NULL OR l.entry_date >= p_from)
    AND (p_to   IS NULL OR l.entry_date <  p_to)
  GROUP BY l.account;
$function$
;

CREATE OR REPLACE FUNCTION public.ledger_entries_immutable()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  RAISE EXCEPTION
    'ledger_entries is append-only -- % is not permitted. Correct a mistake by posting a reversing entry whose reversed_by references the original.',
    TG_OP USING ERRCODE = 'P0001';
END;
$function$
;

CREATE OR REPLACE FUNCTION public.ledger_gbv(p_from timestamp with time zone, p_to timestamp with time zone)
 RETURNS numeric
 LANGUAGE sql
 STABLE
AS $function$
  SELECT COALESCE(SUM(amount), 0)
    FROM ledger_entries
   WHERE account = 'cash' AND direction = 'debit'
     AND event_type IN ('booking_payment_received',
                        'consultation_payment_received',
                        'viewing_deposit_received')
     AND (p_from IS NULL OR entry_date >= p_from)
     AND (p_to   IS NULL OR entry_date <  p_to);
$function$
;

CREATE OR REPLACE FUNCTION public.ledger_monthly_revenue(p_months integer DEFAULT 12)
 RETURNS TABLE(month date, account text, amount numeric)
 LANGUAGE sql
 STABLE
AS $function$
  SELECT date_trunc('month', l.entry_date)::date,
         l.account,
         COALESCE(SUM(l.amount) FILTER (WHERE l.direction = 'credit'), 0)
       - COALESCE(SUM(l.amount) FILTER (WHERE l.direction = 'debit'),  0)
    FROM ledger_entries l
   WHERE ledger_account_kind(l.account) = 'income'
     AND l.entry_date >= date_trunc('month', now()) - make_interval(months => p_months - 1)
   GROUP BY 1, 2
   ORDER BY 1;
$function$
;

CREATE OR REPLACE FUNCTION public.ledger_property_performance(p_from timestamp with time zone, p_to timestamp with time zone)
 RETURNS TABLE(property_id uuid, revenue numeric, owner_payable numeric, gbv numeric, booking_count bigint)
 LANGUAGE sql
 STABLE
AS $function$
  SELECT l.property_id,
         COALESCE(SUM(CASE WHEN ledger_account_kind(l.account) = 'income'
                           THEN CASE WHEN l.direction='credit' THEN l.amount ELSE -l.amount END
                      END), 0),
         COALESCE(SUM(CASE WHEN l.account = 'owner_payable'
                           THEN CASE WHEN l.direction='credit' THEN l.amount ELSE -l.amount END
                      END), 0),
         COALESCE(SUM(CASE WHEN l.account='cash' AND l.direction='debit'
                            AND l.event_type IN ('booking_payment_received',
                                                 'consultation_payment_received',
                                                 'viewing_deposit_received')
                           THEN l.amount END), 0),
         COUNT(DISTINCT l.booking_id) FILTER (WHERE l.event_type = 'booking_payment_received')
    FROM ledger_entries l
   WHERE l.property_id IS NOT NULL
     AND (p_from IS NULL OR l.entry_date >= p_from)
     AND (p_to   IS NULL OR l.entry_date <  p_to)
   GROUP BY l.property_id;
$function$
;

CREATE OR REPLACE FUNCTION public.ledger_revenue_by_stream(p_from timestamp with time zone, p_to timestamp with time zone)
 RETURNS TABLE(account text, amount numeric, entry_count bigint)
 LANGUAGE sql
 STABLE
AS $function$
  SELECT l.account,
         COALESCE(SUM(l.amount) FILTER (WHERE l.direction = 'credit'), 0)
       - COALESCE(SUM(l.amount) FILTER (WHERE l.direction = 'debit'),  0),
         COUNT(*) FILTER (WHERE l.direction = 'credit')
    FROM ledger_entries l
   WHERE ledger_account_kind(l.account) = 'income'
     AND (p_from IS NULL OR l.entry_date >= p_from)
     AND (p_to   IS NULL OR l.entry_date <  p_to)
   GROUP BY l.account;
$function$
;

CREATE OR REPLACE FUNCTION public.owner_block_dates(p_property_id uuid, p_owner_id uuid, p_start date, p_end date, p_note text DEFAULT NULL::text)
 RETURNS availability_blocks
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_hex   text;
  v_block availability_blocks;
BEGIN
  IF p_end <= p_start THEN
    RAISE EXCEPTION 'invalid_range' USING ERRCODE = 'P0001';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM properties WHERE id = p_property_id AND owner_id = p_owner_id) THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0001';
  END IF;

  v_hex := replace(p_property_id::text, '-', '');
  PERFORM pg_advisory_xact_lock(
    ('x' || left(v_hex,  8))::bit(32)::int,
    ('x' || right(v_hex, 8))::bit(32)::int
  );

  IF EXISTS (
    SELECT 1 FROM bookings
     WHERE property_id = p_property_id
       AND status NOT IN ('cancelled','expired')
       AND check_in_date < p_end
       AND check_out_date > p_start
  ) THEN
    RAISE EXCEPTION 'overlaps_booking' USING ERRCODE = 'P0001';
  END IF;

  IF EXISTS (
    SELECT 1 FROM availability_blocks
     WHERE property_id = p_property_id
       AND start_date < p_end
       AND end_date > p_start
  ) THEN
    RAISE EXCEPTION 'overlaps_block' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO availability_blocks(property_id, start_date, end_date, reason, created_by_owner, note)
  VALUES (p_property_id, p_start, p_end, 'owner_use', p_owner_id, p_note)
  RETURNING * INTO v_block;

  RETURN v_block;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.owner_remove_block(p_block_id uuid, p_owner_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
AS $function$
DECLARE v_rows int;
BEGIN
  DELETE FROM availability_blocks
   WHERE id = p_block_id
     AND created_by_owner = p_owner_id
     AND booking_id IS NULL;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows > 0;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.post_ledger_entries(p_entries jsonb)
 RETURNS SETOF ledger_entries
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_debits numeric; v_credits numeric; v_count int;
BEGIN
  v_count := jsonb_array_length(p_entries);
  IF v_count IS NULL OR v_count < 2 THEN
    RAISE EXCEPTION 'ledger_incomplete: a financial event needs at least two entries, got %', COALESCE(v_count,0)
      USING ERRCODE = 'P0001';
  END IF;

  SELECT
    COALESCE(SUM((e->>'amount')::numeric) FILTER (WHERE e->>'direction' = 'debit'),  0),
    COALESCE(SUM((e->>'amount')::numeric) FILTER (WHERE e->>'direction' = 'credit'), 0)
  INTO v_debits, v_credits
  FROM jsonb_array_elements(p_entries) e;

  IF v_debits <> v_credits THEN
    RAISE EXCEPTION 'ledger_unbalanced: debits=% credits=% (difference %)',
      v_debits, v_credits, v_debits - v_credits USING ERRCODE = 'P0001';
  END IF;

  IF v_debits = 0 THEN
    RAISE EXCEPTION 'ledger_zero_value: an event that moves no money should not be posted'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN QUERY
  INSERT INTO ledger_entries (
    entry_date, event_type, account, direction, amount,
    booking_id, viewing_id, consultation_id, property_id, user_id, owner_id,
    description, created_by, reversed_by
  )
  SELECT
    COALESCE((e->>'entry_date')::timestamptz, now()),
    e->>'event_type', e->>'account', e->>'direction', (e->>'amount')::numeric,
    (e->>'booking_id')::uuid, (e->>'viewing_id')::uuid, (e->>'consultation_id')::uuid,
    (e->>'property_id')::uuid, (e->>'user_id')::uuid, (e->>'owner_id')::uuid,
    e->>'description', (e->>'created_by')::uuid, (e->>'reversed_by')::uuid
  FROM jsonb_array_elements(p_entries) e
  RETURNING *;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.redeem_owner_invite(p_token_hash text, p_user_id uuid)
 RETURNS TABLE(owner_id uuid, owner_name text)
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_inv owner_invites%ROWTYPE;
  v_own owners%ROWTYPE;
BEGIN
  SELECT * INTO v_inv FROM owner_invites WHERE token_hash = p_token_hash FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'invite_invalid' USING ERRCODE = 'P0001';
  END IF;
  IF v_inv.used_at IS NOT NULL THEN
    RAISE EXCEPTION 'invite_already_used' USING ERRCODE = 'P0001';
  END IF;
  IF v_inv.revoked_at IS NOT NULL THEN
    RAISE EXCEPTION 'invite_revoked' USING ERRCODE = 'P0001';
  END IF;
  IF v_inv.expires_at < now() THEN
    RAISE EXCEPTION 'invite_expired' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_own FROM owners WHERE id = v_inv.owner_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'owner_not_found' USING ERRCODE = 'P0001';
  END IF;
  IF v_own.portal_access = 'revoked' THEN
    RAISE EXCEPTION 'owner_revoked' USING ERRCODE = 'P0001';
  END IF;

  IF v_own.user_id IS NOT NULL AND v_own.user_id <> p_user_id THEN
    RAISE EXCEPTION 'owner_already_linked' USING ERRCODE = 'P0001';
  END IF;

  IF EXISTS (SELECT 1 FROM owners WHERE user_id = p_user_id AND id <> v_own.id) THEN
    RAISE EXCEPTION 'user_already_owner' USING ERRCODE = 'P0001';
  END IF;

  UPDATE owners
     SET user_id = p_user_id,
         portal_access = 'active',
         activated_at = COALESCE(activated_at, now())
   WHERE id = v_own.id;

  UPDATE owner_invites
     SET used_at = now(), used_by = p_user_id
   WHERE id = v_inv.id;

  RETURN QUERY SELECT v_own.id, v_own.name;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.request_credit_refund(p_credit_id uuid, p_user_id uuid)
 RETURNS user_credits
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_hex text;
  v_credit user_credits%ROWTYPE;
BEGIN
  v_hex := replace(p_user_id::text, '-', '');
  PERFORM pg_advisory_xact_lock(
    ('x' || left(v_hex,  8))::bit(32)::int,
    ('x' || right(v_hex, 8))::bit(32)::int
  );

  SELECT * INTO v_credit FROM user_credits WHERE id = p_credit_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'credit_not_found' USING ERRCODE = 'P0001';
  END IF;
  IF v_credit.user_id IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'not_your_credit' USING ERRCODE = 'P0001';
  END IF;
  IF v_credit.redeemed_at IS NOT NULL THEN
    RAISE EXCEPTION 'already_spent' USING ERRCODE = 'P0001';
  END IF;
  IF v_credit.status <> 'active' THEN
    RAISE EXCEPTION 'not_refundable_status' USING ERRCODE = 'P0001';
  END IF;
  IF v_credit.viewing_id IS NULL THEN
    RAISE EXCEPTION 'not_from_viewing_deposit' USING ERRCODE = 'P0001';
  END IF;
  IF v_credit.created_at < now() - interval '14 days' THEN
    RAISE EXCEPTION 'refund_window_closed' USING ERRCODE = 'P0001';
  END IF;

  UPDATE user_credits
     SET status = 'refund_requested', refund_requested_at = now()
   WHERE id = p_credit_id
  RETURNING * INTO v_credit;

  RETURN v_credit;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.restore_booking_credits(p_booking_id uuid)
 RETURNS TABLE(restored integer, expired_skipped integer)
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_restored        INT := 0;
  v_expired_skipped INT := 0;
  v_row             user_credits%ROWTYPE;
BEGIN
  FOR v_row IN
    SELECT * FROM user_credits
     WHERE booking_id  = p_booking_id
       AND redeemed_at IS NOT NULL
     FOR UPDATE
  LOOP
    IF v_row.expires_at IS NULL OR v_row.expires_at > now() THEN
      UPDATE user_credits SET redeemed_at = NULL, booking_id = NULL WHERE id = v_row.id;
      v_restored := v_restored + 1;
    ELSE
      v_expired_skipped := v_expired_skipped + 1;
    END IF;
  END LOOP;
  RETURN QUERY SELECT v_restored, v_expired_skipped;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.set_admin_flag()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  IF NEW.email = 'admin@verihome.id' THEN
    NEW.is_admin := true;
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.settle_booking_cancellation(p_booking_id uuid, p_actor uuid DEFAULT NULL::uuid)
 RETURNS bookings
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_b        bookings;
  v_was_paid boolean;
  v_stay     numeric;
  v_deposit  numeric;
  v_entries  jsonb;
BEGIN
  SELECT * INTO v_b FROM bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'booking_not_found' USING ERRCODE = 'P0001';
  END IF;
  IF v_b.status = 'cancelled' THEN
    RETURN v_b;
  END IF;

  v_was_paid := (v_b.payment_status = 'paid');
  v_stay     := COALESCE(v_b.total_price, 0);
  v_deposit  := COALESCE(v_b.security_deposit, 0);

  UPDATE bookings
     SET status = 'cancelled', cancelled_at = now(), updated_at = now()
   WHERE id = p_booking_id
  RETURNING * INTO v_b;

  IF v_was_paid AND (v_stay + v_deposit) > 0 THEN
    v_entries := jsonb_build_array(
      jsonb_build_object(
        'event_type','booking_refund_issued','account','cash','direction','credit',
        'amount', v_stay + v_deposit, 'booking_id', v_b.id, 'property_id', v_b.property_id,
        'user_id', v_b.user_id, 'created_by', p_actor,
        'description','Refund paid to guest')
    );
    IF v_stay > 0 THEN
      v_entries := v_entries || jsonb_build_object(
        'event_type','booking_refund_issued','account','unearned_revenue','direction','debit',
        'amount', v_stay, 'booking_id', v_b.id, 'property_id', v_b.property_id,
        'user_id', v_b.user_id, 'created_by', p_actor,
        'description','Stay will not be delivered');
    END IF;
    IF v_deposit > 0 THEN
      v_entries := v_entries || jsonb_build_object(
        'event_type','booking_refund_issued','account','deposits_held','direction','debit',
        'amount', v_deposit, 'booking_id', v_b.id, 'property_id', v_b.property_id,
        'user_id', v_b.user_id, 'created_by', p_actor,
        'description','Security deposit returned');
    END IF;

    PERFORM post_ledger_entries(v_entries);
  END IF;

  PERFORM restore_booking_credits(p_booking_id);

  RETURN v_b;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.settle_booking_completion(p_booking_id uuid, p_actor uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_b        bookings;
  v_owner    uuid;
  v_pct      numeric;
  v_dest     text;
  v_stay     numeric;
  v_cleaning numeric;
  v_rent     numeric;
  v_margin   numeric;
  v_entries  jsonb;
  v_split    boolean := true;
BEGIN
  SELECT * INTO v_b FROM bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'booking_not_found' USING ERRCODE = 'P0001';
  END IF;
  IF v_b.status = 'completed' THEN
    RETURN jsonb_build_object('completed', false, 'reason', 'already_completed');
  END IF;
  IF v_b.status <> 'confirmed' THEN
    RETURN jsonb_build_object('completed', false, 'reason', 'not_confirmed');
  END IF;

  SELECT owner_id INTO v_owner FROM properties WHERE id = v_b.property_id;

  v_pct  := COALESCE(v_b.commission_pct,
                     (SELECT platform_commission_pct FROM properties WHERE id = v_b.property_id));
  v_dest := COALESCE(v_b.cleaning_fee_goes_to,
                     (SELECT cleaning_fee_goes_to FROM properties WHERE id = v_b.property_id),
                     'platform');

  IF v_b.payment_status <> 'paid' THEN
    UPDATE bookings SET status = 'completed', updated_at = now() WHERE id = p_booking_id;
    RETURN jsonb_build_object('completed', true, 'posted', false, 'reason', 'unpaid');
  END IF;

  v_stay     := COALESCE(v_b.total_price,0) + COALESCE(v_b.credit_applied,0);
  v_cleaning := LEAST(COALESCE(v_b.cleaning_fee,0), v_stay);
  v_rent     := v_stay - v_cleaning;

  IF v_stay <= 0 THEN
    UPDATE bookings SET status = 'completed', updated_at = now() WHERE id = p_booking_id;
    RETURN jsonb_build_object('completed', true, 'posted', false, 'reason', 'zero_value');
  END IF;

  v_entries := jsonb_build_array(
    jsonb_build_object(
      'event_type','booking_revenue_earned','account','unearned_revenue','direction','debit',
      'amount', v_stay, 'booking_id', v_b.id, 'property_id', v_b.property_id,
      'user_id', v_b.user_id, 'owner_id', v_owner, 'created_by', p_actor,
      'description','Stay delivered')
  );

  IF v_cleaning > 0 THEN
    v_entries := v_entries || jsonb_build_object(
      'event_type','booking_revenue_earned',
      'account', CASE WHEN v_dest = 'owner' THEN 'owner_payable' ELSE 'revenue_cleaning' END,
      'direction','credit','amount', v_cleaning, 'booking_id', v_b.id,
      'property_id', v_b.property_id, 'user_id', v_b.user_id, 'owner_id', v_owner,
      'created_by', p_actor,
      'description', CASE WHEN v_dest = 'owner' THEN 'Cleaning fee due to owner' ELSE 'Cleaning fee' END);
  END IF;

  IF v_rent > 0 AND v_pct IS NULL THEN
    v_split := false;
    v_entries := v_entries || jsonb_build_object(
      'event_type','booking_revenue_earned','account','owner_payable','direction','credit',
      'amount', v_rent, 'booking_id', v_b.id, 'property_id', v_b.property_id,
      'user_id', v_b.user_id, 'owner_id', v_owner, 'created_by', p_actor,
      'description','No commission rate configured - full rent to owner pending split');
  ELSIF v_rent > 0 THEN
    v_margin := round(v_rent * v_pct / 100);
    IF v_margin > 0 THEN
      v_entries := v_entries || jsonb_build_object(
        'event_type','booking_revenue_earned','account','revenue_booking_margin','direction','credit',
        'amount', v_margin, 'booking_id', v_b.id, 'property_id', v_b.property_id,
        'user_id', v_b.user_id, 'owner_id', v_owner, 'created_by', p_actor,
        'description', 'Platform margin at ' || v_pct || '%');
    END IF;
    IF v_rent - v_margin > 0 THEN
      v_entries := v_entries || jsonb_build_object(
        'event_type','booking_revenue_earned','account','owner_payable','direction','credit',
        'amount', v_rent - v_margin, 'booking_id', v_b.id, 'property_id', v_b.property_id,
        'user_id', v_b.user_id, 'owner_id', v_owner, 'created_by', p_actor,
        'description','Owner share of rent');
    END IF;
  END IF;

  PERFORM post_ledger_entries(v_entries);

  UPDATE bookings SET status = 'completed', updated_at = now() WHERE id = p_booking_id;

  RETURN jsonb_build_object('completed', true, 'posted', true, 'split', v_split, 'rate', v_pct);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.settle_booking_payment(p_booking_id uuid, p_actor uuid DEFAULT NULL::uuid)
 RETURNS bookings
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_b       bookings;
  v_stay    numeric;
  v_deposit numeric;
  v_entries jsonb;
BEGIN
  SELECT * INTO v_b FROM bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'booking_not_found' USING ERRCODE = 'P0001';
  END IF;

  IF v_b.payment_status = 'paid' THEN
    RETURN v_b;
  END IF;

  UPDATE bookings
     SET payment_status = 'paid',
         status       = CASE WHEN status = 'pending' THEN 'confirmed' ELSE status END,
         confirmed_at = CASE WHEN status = 'pending' THEN now() ELSE confirmed_at END,
         updated_at   = now()
   WHERE id = p_booking_id
  RETURNING * INTO v_b;

  v_stay    := COALESCE(v_b.total_price, 0);
  v_deposit := COALESCE(v_b.security_deposit, 0);

  IF v_stay + v_deposit > 0 THEN
    v_entries := jsonb_build_array(
      jsonb_build_object(
        'event_type','booking_payment_received','account','cash','direction','debit',
        'amount', v_stay + v_deposit, 'booking_id', v_b.id, 'property_id', v_b.property_id,
        'user_id', v_b.user_id, 'created_by', p_actor,
        'description','Guest payment received')
    );
    IF v_stay > 0 THEN
      v_entries := v_entries || jsonb_build_object(
        'event_type','booking_payment_received','account','unearned_revenue','direction','credit',
        'amount', v_stay, 'booking_id', v_b.id, 'property_id', v_b.property_id,
        'user_id', v_b.user_id, 'created_by', p_actor,
        'description','Stay not yet delivered');
    END IF;
    IF v_deposit > 0 THEN
      v_entries := v_entries || jsonb_build_object(
        'event_type','booking_payment_received','account','deposits_held','direction','credit',
        'amount', v_deposit, 'booking_id', v_b.id, 'property_id', v_b.property_id,
        'user_id', v_b.user_id, 'created_by', p_actor,
        'description','Refundable security deposit');
    END IF;

    PERFORM post_ledger_entries(v_entries);
  END IF;

  RETURN v_b;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.settle_consultation_completion(p_consultation_id uuid, p_actor uuid DEFAULT NULL::uuid)
 RETURNS consultations
 LANGUAGE plpgsql
AS $function$
DECLARE v_c consultations; v_value numeric;
BEGIN
  SELECT * INTO v_c FROM consultations WHERE id = p_consultation_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'consultation_not_found' USING ERRCODE='P0001'; END IF;
  IF v_c.status = 'completed' THEN RETURN v_c; END IF;

  v_value := COALESCE(v_c.final_price, v_c.price, 0) + COALESCE(v_c.credit_applied, 0);

  UPDATE consultations SET status='completed', completed_at=now()
   WHERE id = p_consultation_id RETURNING * INTO v_c;

  IF v_value > 0 AND v_c.payment_status = 'paid' THEN
    PERFORM post_ledger_entries(jsonb_build_array(
      jsonb_build_object('event_type','consultation_revenue_earned','account','unearned_revenue','direction','debit',
        'amount',v_value,'consultation_id',v_c.id,'user_id',v_c.user_id,
        'created_by',p_actor,'description','Session delivered'),
      jsonb_build_object('event_type','consultation_revenue_earned','account','revenue_consultation','direction','credit',
        'amount',v_value,'consultation_id',v_c.id,'user_id',v_c.user_id,
        'created_by',p_actor,'description','Consultation fee earned')));
  END IF;
  RETURN v_c;
END; $function$
;

CREATE OR REPLACE FUNCTION public.settle_consultation_payment(p_consultation_id uuid, p_actor uuid DEFAULT NULL::uuid)
 RETURNS consultations
 LANGUAGE plpgsql
AS $function$
DECLARE v_c consultations; v_cash numeric;
BEGIN
  SELECT * INTO v_c FROM consultations WHERE id = p_consultation_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'consultation_not_found' USING ERRCODE='P0001'; END IF;
  IF v_c.payment_status = 'paid' THEN RETURN v_c; END IF;

  v_cash := COALESCE(v_c.final_price, v_c.price, 0);

  UPDATE consultations SET payment_status='paid', status='paid'
   WHERE id = p_consultation_id RETURNING * INTO v_c;

  IF v_cash > 0 THEN
    PERFORM post_ledger_entries(jsonb_build_array(
      jsonb_build_object('event_type','consultation_payment_received','account','cash','direction','debit',
        'amount',v_cash,'consultation_id',v_c.id,'user_id',v_c.user_id,
        'created_by',p_actor,'description','Consultation payment received'),
      jsonb_build_object('event_type','consultation_payment_received','account','unearned_revenue','direction','credit',
        'amount',v_cash,'consultation_id',v_c.id,'user_id',v_c.user_id,
        'created_by',p_actor,'description','Session not yet delivered')));
  END IF;
  RETURN v_c;
END; $function$
;

CREATE OR REPLACE FUNCTION public.settle_placement_payment(p_placement_id uuid, p_actor uuid DEFAULT NULL::uuid)
 RETURNS placements
 LANGUAGE plpgsql
AS $function$
DECLARE v_p placements; v_amt numeric; v_owner uuid;
BEGIN
  SELECT * INTO v_p FROM placements WHERE id = p_placement_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'placement_not_found' USING ERRCODE='P0001'; END IF;
  IF v_p.status = 'paid' THEN RETURN v_p; END IF;

  v_amt := COALESCE(v_p.commission_amount, 0);
  SELECT owner_id INTO v_owner FROM properties WHERE id = v_p.property_id;

  UPDATE placements SET status='paid' WHERE id = p_placement_id RETURNING * INTO v_p;

  IF v_amt > 0 THEN
    PERFORM post_ledger_entries(jsonb_build_array(
      jsonb_build_object('event_type','placement_commission_received','account','cash','direction','debit',
        'amount',v_amt,'property_id',v_p.property_id,'user_id',v_p.user_id,'owner_id',v_owner,
        'created_by',p_actor,'description','Placement commission paid by owner'),
      jsonb_build_object('event_type','placement_commission_received','account','commission_receivable','direction','credit',
        'amount',v_amt,'property_id',v_p.property_id,'user_id',v_p.user_id,'owner_id',v_owner,
        'created_by',p_actor,'description','Receivable settled')));
  END IF;
  RETURN v_p;
END; $function$
;

CREATE OR REPLACE FUNCTION public.settle_placement_recorded(p_placement_id uuid, p_actor uuid DEFAULT NULL::uuid)
 RETURNS placements
 LANGUAGE plpgsql
AS $function$
DECLARE v_p placements; v_amt numeric; v_owner uuid;
BEGIN
  SELECT * INTO v_p FROM placements WHERE id = p_placement_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'placement_not_found' USING ERRCODE='P0001'; END IF;

  v_amt := COALESCE(v_p.commission_amount, 0);
  SELECT owner_id INTO v_owner FROM properties WHERE id = v_p.property_id;

  IF v_amt > 0 THEN
    PERFORM post_ledger_entries(jsonb_build_array(
      jsonb_build_object('event_type','placement_commission_earned','account','commission_receivable','direction','debit',
        'amount',v_amt,'property_id',v_p.property_id,'user_id',v_p.user_id,'owner_id',v_owner,
        'created_by',p_actor,'description','Placement commission invoiced'),
      jsonb_build_object('event_type','placement_commission_earned','account','revenue_commission','direction','credit',
        'amount',v_amt,'property_id',v_p.property_id,'user_id',v_p.user_id,'owner_id',v_owner,
        'created_by',p_actor,'description','Placement commission earned')));
  END IF;
  RETURN v_p;
END; $function$
;

CREATE OR REPLACE FUNCTION public.settle_viewing_attendance(p_viewing_id uuid, p_actor uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
DECLARE v_v viewings; v_amt numeric; v_credit_id uuid;
BEGIN
  SELECT * INTO v_v FROM viewings WHERE id = p_viewing_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'viewing_not_found' USING ERRCODE='P0001'; END IF;
  IF v_v.credit_issued THEN
    RETURN jsonb_build_object('attended', true, 'credit_issued', false, 'reason','already_issued');
  END IF;
  IF v_v.status <> 'confirmed' THEN RAISE EXCEPTION 'viewing_not_confirmed' USING ERRCODE='P0001'; END IF;
  IF NOT v_v.deposit_paid THEN RAISE EXCEPTION 'deposit_not_confirmed' USING ERRCODE='P0001'; END IF;

  v_amt := COALESCE(v_v.deposit_amount, 0);

  UPDATE viewings
     SET attended=true, attended_at=now(), status='attended',
         credit_issued=true, credit_issued_at=now()
   WHERE id = p_viewing_id RETURNING * INTO v_v;

  INSERT INTO user_credits(user_id, amount, reason, viewing_id, expires_at, status)
  VALUES (v_v.user_id, v_amt, 'viewing_attendance', v_v.id, now() + interval '6 months', 'active')
  RETURNING id INTO v_credit_id;

  IF v_amt > 0 THEN
    PERFORM post_ledger_entries(jsonb_build_array(
      jsonb_build_object('event_type','viewing_deposit_converted_to_credit','account','deposits_held','direction','debit',
        'amount',v_amt,'viewing_id',v_v.id,'property_id',v_v.property_id,'user_id',v_v.user_id,
        'created_by',p_actor,'description','Deposit converted on attendance'),
      jsonb_build_object('event_type','viewing_deposit_converted_to_credit','account','credits_outstanding','direction','credit',
        'amount',v_amt,'viewing_id',v_v.id,'property_id',v_v.property_id,'user_id',v_v.user_id,
        'created_by',p_actor,'description','Credit issued to guest')));
  END IF;

  RETURN jsonb_build_object('attended',true,'credit_issued',true,'credit_id',v_credit_id,'amount',v_amt);
END; $function$
;

CREATE OR REPLACE FUNCTION public.settle_viewing_deposit(p_viewing_id uuid, p_scheduled_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_actor uuid DEFAULT NULL::uuid)
 RETURNS viewings
 LANGUAGE plpgsql
AS $function$
DECLARE v_v viewings; v_amt numeric;
BEGIN
  SELECT * INTO v_v FROM viewings WHERE id = p_viewing_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'viewing_not_found' USING ERRCODE='P0001'; END IF;
  IF v_v.deposit_paid THEN RETURN v_v; END IF;

  UPDATE viewings
     SET status='confirmed', deposit_paid=true, deposit_paid_at=now(),
         scheduled_at=COALESCE(p_scheduled_at, scheduled_at), confirmed_at=now()
   WHERE id = p_viewing_id RETURNING * INTO v_v;

  v_amt := COALESCE(v_v.deposit_amount, 0);
  IF v_amt > 0 THEN
    PERFORM post_ledger_entries(jsonb_build_array(
      jsonb_build_object('event_type','viewing_deposit_received','account','cash','direction','debit',
        'amount',v_amt,'viewing_id',v_v.id,'property_id',v_v.property_id,'user_id',v_v.user_id,
        'created_by',p_actor,'description','Viewing deposit received'),
      jsonb_build_object('event_type','viewing_deposit_received','account','deposits_held','direction','credit',
        'amount',v_amt,'viewing_id',v_v.id,'property_id',v_v.property_id,'user_id',v_v.user_id,
        'created_by',p_actor,'description','Refundable viewing deposit')));
  END IF;
  RETURN v_v;
END; $function$
;

CREATE OR REPLACE FUNCTION public.settle_viewing_no_show(p_viewing_id uuid, p_actor uuid DEFAULT NULL::uuid)
 RETURNS viewings
 LANGUAGE plpgsql
AS $function$
DECLARE v_v viewings; v_amt numeric; v_was_paid boolean;
BEGIN
  SELECT * INTO v_v FROM viewings WHERE id = p_viewing_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'viewing_not_found' USING ERRCODE='P0001'; END IF;
  IF v_v.status = 'no_show' THEN RETURN v_v; END IF;

  v_was_paid := v_v.deposit_paid;
  v_amt := COALESCE(v_v.deposit_amount, 0);

  UPDATE viewings SET attended=false, attended_at=now(), status='no_show'
   WHERE id = p_viewing_id RETURNING * INTO v_v;

  IF v_was_paid AND v_amt > 0 THEN
    PERFORM post_ledger_entries(jsonb_build_array(
      jsonb_build_object('event_type','viewing_deposit_forfeited','account','deposits_held','direction','debit',
        'amount',v_amt,'viewing_id',v_v.id,'property_id',v_v.property_id,'user_id',v_v.user_id,
        'created_by',p_actor,'description','Deposit forfeited on no-show'),
      jsonb_build_object('event_type','viewing_deposit_forfeited','account','revenue_forfeited_deposit','direction','credit',
        'amount',v_amt,'viewing_id',v_v.id,'property_id',v_v.property_id,'user_id',v_v.user_id,
        'created_by',p_actor,'description','Forfeited viewing deposit')));
  END IF;
  RETURN v_v;
END; $function$
;

CREATE OR REPLACE FUNCTION public.settle_viewing_refund(p_viewing_id uuid, p_actor uuid DEFAULT NULL::uuid)
 RETURNS viewings
 LANGUAGE plpgsql
AS $function$
DECLARE v_v viewings; v_amt numeric;
BEGIN
  SELECT * INTO v_v FROM viewings WHERE id = p_viewing_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'viewing_not_found' USING ERRCODE='P0001'; END IF;
  IF v_v.deposit_refunded THEN RETURN v_v; END IF;
  IF v_v.deposit_refund_requested_at IS NULL THEN
    RAISE EXCEPTION 'no_refund_request' USING ERRCODE='P0001';
  END IF;

  v_amt := COALESCE(v_v.deposit_amount, 0);

  UPDATE viewings SET deposit_refunded=true, deposit_refunded_at=now(), status='refunded'
   WHERE id = p_viewing_id RETURNING * INTO v_v;

  IF v_amt > 0 THEN
    PERFORM post_ledger_entries(jsonb_build_array(
      jsonb_build_object('event_type','viewing_deposit_refunded','account','deposits_held','direction','debit',
        'amount',v_amt,'viewing_id',v_v.id,'property_id',v_v.property_id,'user_id',v_v.user_id,
        'created_by',p_actor,'description','Viewing deposit refunded'),
      jsonb_build_object('event_type','viewing_deposit_refunded','account','cash','direction','credit',
        'amount',v_amt,'viewing_id',v_v.id,'property_id',v_v.property_id,'user_id',v_v.user_id,
        'created_by',p_actor,'description','Refund paid out')));
  END IF;
  RETURN v_v;
END; $function$
;

CREATE OR REPLACE FUNCTION public.snapshot_booking_commission()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_pct  numeric(5,2);
  v_dest text;
BEGIN
  SELECT platform_commission_pct, cleaning_fee_goes_to
    INTO v_pct, v_dest
    FROM properties WHERE id = NEW.property_id;

  IF NEW.commission_pct IS NULL THEN
    IF v_pct IS NULL THEN
      SELECT default_commission_pct INTO v_pct FROM platform_settings WHERE id = 1;
    END IF;
    NEW.commission_pct := v_pct;
  END IF;

  IF NEW.cleaning_fee_goes_to IS NULL THEN
    NEW.cleaning_fee_goes_to := COALESCE(v_dest, 'platform');
  END IF;

  RETURN NEW;
END;
$function$
;
-- ============================================================================
-- VeriHome — triggers, row-level security, policies, grants
-- ============================================================================

-- ─── 8. Triggers (7) ────────────────────────────────────────────────────────
-- on_auth_user_created is the only one on auth.users. set_admin_flag fires on
-- public.users, not auth.users — auth.users has no is_admin column. (The
-- system reference describes "two auth.users triggers"; production has one.)

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user();
CREATE TRIGGER bookings_updated_at BEFORE UPDATE ON public.bookings FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_snapshot_booking_commission BEFORE INSERT ON public.bookings FOR EACH ROW EXECUTE FUNCTION snapshot_booking_commission();
CREATE TRIGGER ledger_entries_no_delete BEFORE DELETE ON public.ledger_entries FOR EACH ROW EXECUTE FUNCTION ledger_entries_immutable();
CREATE TRIGGER ledger_entries_no_update BEFORE UPDATE ON public.ledger_entries FOR EACH ROW EXECUTE FUNCTION ledger_entries_immutable();
CREATE TRIGGER short_stay_rates_updated_at BEFORE UPDATE ON public.short_stay_rates FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_set_admin_flag BEFORE INSERT ON public.users FOR EACH ROW EXECUTE FUNCTION set_admin_flag();

-- ─── 9. Row-level security ──────────────────────────────────────────────────
-- Enabled on all 26 tables. Note that most tables have NO policy at all, which
-- is deliberate: RLS on with no policy denies everything to anon/authenticated,
-- leaving the service role as the only writer.

ALTER TABLE public.area_overviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.availability_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consultations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cron_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.owner_change_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.owner_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.owner_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.owners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pending_survey_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.placements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_surveys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.publish_checklist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rla_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.short_stay_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.survey_import_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.viewings ENABLE ROW LEVEL SECURITY;

-- ─── 10. Policies (17) ──────────────────────────────────────────────────────

CREATE POLICY public_read_live_area ON public.area_overviews AS PERMISSIVE FOR SELECT TO anon, authenticated USING ((EXISTS ( SELECT 1
   FROM properties p
  WHERE ((p.id = area_overviews.property_id) AND (p.status = 'live'::text)))));

CREATE POLICY admin_write_blocks ON public.availability_blocks AS PERMISSIVE FOR ALL TO public USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.is_admin = true)))));

CREATE POLICY admin_all_bookings ON public.bookings AS PERMISSIVE FOR ALL TO public USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.is_admin = true)))));

CREATE POLICY user_insert_booking ON public.bookings AS PERMISSIVE FOR INSERT TO public WITH CHECK ((user_id = auth.uid()));

CREATE POLICY user_own_bookings ON public.bookings AS PERMISSIVE FOR SELECT TO public USING (((user_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.is_admin = true))))));

CREATE POLICY "Public can view live listings" ON public.properties AS PERMISSIVE FOR SELECT TO public USING ((status = 'live'::text));

CREATE POLICY public_read_live_details ON public.property_details AS PERMISSIVE FOR SELECT TO anon, authenticated USING ((EXISTS ( SELECT 1
   FROM properties p
  WHERE ((p.id = property_details.property_id) AND (p.status = 'live'::text)))));

CREATE POLICY public_read_live_media ON public.property_media AS PERMISSIVE FOR SELECT TO anon, authenticated USING ((EXISTS ( SELECT 1
   FROM properties p
  WHERE ((p.id = property_media.property_id) AND (p.status = 'live'::text)))));

CREATE POLICY public_read_live_rla ON public.rla_assessments AS PERMISSIVE FOR SELECT TO anon, authenticated USING ((EXISTS ( SELECT 1
   FROM properties p
  WHERE ((p.id = rla_assessments.property_id) AND (p.status = 'live'::text)))));

CREATE POLICY "Users manage own saved listings" ON public.saved_listings AS PERMISSIVE FOR ALL TO public USING ((auth.uid() = user_id));

CREATE POLICY admin_write_rates ON public.short_stay_rates AS PERMISSIVE FOR ALL TO public USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.is_admin = true)))));

CREATE POLICY public_read_live_rates ON public.short_stay_rates AS PERMISSIVE FOR SELECT TO anon, authenticated USING ((EXISTS ( SELECT 1
   FROM properties p
  WHERE ((p.id = short_stay_rates.property_id) AND (p.status = 'live'::text)))));

CREATE POLICY admin_write_credits ON public.user_credits AS PERMISSIVE FOR ALL TO public USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.is_admin = true)))));

CREATE POLICY service_role_all_credits ON public.user_credits AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY user_own_credits ON public.user_credits AS PERMISSIVE FOR SELECT TO public USING (((user_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.is_admin = true))))));

CREATE POLICY users_read_own_credits ON public.user_credits AS PERMISSIVE FOR SELECT TO authenticated USING ((user_id = auth.uid()));

CREATE POLICY "Users can view own data" ON public.users AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = id));

-- ─── 11. Grants ─────────────────────────────────────────────────────────────
-- Production holds the Supabase default — SELECT, INSERT, UPDATE, DELETE,
-- TRUNCATE, REFERENCES and TRIGGER for anon, authenticated and service_role on
-- every table in public — with exactly two exceptions, both deliberate. The
-- three statements below reproduce that end state; the privilege set was read
-- back from information_schema.table_privileges and matches GRANT ALL.
--
-- Writes are not actually open: RLS is on and most tables carry no write
-- policy, so the grant alone permits nothing.

GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;

-- Exception 1: availability_blocks. Occupancy says when a home is empty, so
-- the public roles cannot read it at all.
REVOKE SELECT ON public.availability_blocks FROM anon, authenticated;

-- Exception 2: properties. The anon key ships in the browser bundle and RLS
-- grants public read on every live property, so a table-level SELECT would
-- hand out the street address to anyone with devtools. PostgreSQL cannot
-- revoke a single column while table-level SELECT is held, so the table grant
-- is dropped and re-issued column by column, omitting address and
-- google_maps_url. Both now return 42501 to anon and authenticated —
-- including through select=*, which expands to the revoked columns and fails
-- whole.
--
-- A column added to properties later is NOT on this list and is therefore
-- unreadable. If a public page selects it, grant it in the same migration.
REVOKE SELECT ON public.properties FROM anon, authenticated;

GRANT SELECT (
  approved_at, area, available_from, bathrooms, bedrooms, cleaning_fee_goes_to,
  created_at, id, is_furnished, is_instant_bookable, min_stay_months, name,
  owner_id, photo_urls, platform_commission_pct, price_monthly, property_type,
  published_at, rejection_reason, rental_mode, size_sqm, slug, status,
  submission_type, updated_at
) ON public.properties TO anon, authenticated;

-- Deliberately NOT granted on properties: address, google_maps_url.

-- ─── 12. Seed row required by the application ───────────────────────────────
-- platform_settings is a single-row table (CHECK id = 1) holding the default
-- commission rate. snapshot_booking_commission() reads it on every booking
-- insert, so an empty table silently means "no rate configured" and sends the
-- whole rent to the owner. This is configuration, not data.

INSERT INTO public.platform_settings (id, default_commission_pct)
VALUES (1, 15)
ON CONFLICT (id) DO NOTHING;
