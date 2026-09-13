-- Migration 005: Enable RLS on internal admin-only tables
-- All access to these tables is via the service role client, which bypasses RLS
-- automatically. Enabling RLS with no permissive policies means anon and
-- authenticated roles get zero access, which is the correct posture for tables
-- holding raw Tally payloads, phone numbers, and site access notes.

ALTER TABLE "public"."property_surveys"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."survey_import_log"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."pending_survey_imports" ENABLE ROW LEVEL SECURITY;
