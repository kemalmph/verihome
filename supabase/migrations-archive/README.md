# Archived migrations (001–042)

These 42 files were the migration history until 2026-11-21. They are kept for
reading, not for running. The Supabase CLI does not look in this directory.

They were replaced by a single baseline,
`supabase/migrations/00000000000000_baseline.sql`, which was read out of the
production database's system catalogs and **verified by replaying it into an
empty Postgres 17**. See §20.4 of the system reference.

## Why they had to go

The history could not build the database from nothing. Fifteen of the 26 tables
— `users`, `owners`, `properties`, `viewings`, `consultations`, `reviews`,
`saved_listings`, `publish_checklist`, `property_details`, `property_media`,
`area_overviews`, `rla_assessments`, `property_surveys`,
`pending_survey_imports`, `survey_import_log` — were made through the Supabase
dashboard and never written down. `001_booking_system.sql` opens with
`ALTER TABLE properties`, a table nothing in the history creates, and its own
header says "Run in Supabase SQL Editor".

Prepending a baseline instead of replacing these would not work: the baseline
is the schema *as it is now*, so 001–042 would then re-apply their changes on
top of a finished schema. Some are idempotent (`IF NOT EXISTS`), some are not.

## What these files do not tell you

Three mismatches between this directory and what production actually ran, found
by reading `supabase_migrations.schema_migrations` on 2026-11-21. Recorded here
because they are the evidence for everything above, and nothing else holds them.

**Production recorded 48 migrations; this directory has 42, and they are not
the same set.** Production's are timestamp-named, these are `001`–`042`.

1. **Nine production entries have no file here at all** —
   `seed_placeholder_properties`, `add_google_maps_url_to_properties`,
   `rla_assessments_0_10_scale`, `property_media_categorized_photos`,
   `area_overviews_expand_and_expat_score`, `property_surveys_and_survey_fks`,
   `survey_import_tables`, `properties_status_pipeline`,
   `auto_sync_auth_users_to_users_table`. This is the dashboard era, and it is
   where the fifteen missing tables came from.
2. **`001`–`004` are not recorded in production.** They were pasted into the
   SQL Editor before migration tracking existed.
3. **`006b_rpc_buffer_days_directional` ran in production and has no file
   here.** Its effect is in the baseline, because the baseline captures the
   current state, but its body was never committed anywhere. §19.7 in another
   costume.

## ⚠ Do not run `supabase db push`

Production's `schema_migrations` still lists those 48 entries. It does not know
about the baseline. A `db push` would therefore read the baseline as unapplied
and try to run `CREATE TABLE` against the live, populated database.

Reconciling that needs `supabase link` plus `supabase migration repair`, which
needs the database password, so it is the owner's step and has **not** been
done. Until it has, `db push` is the one command to stay away from.

`supabase db reset` against the local stack is unaffected and is the command
you want while developing.
