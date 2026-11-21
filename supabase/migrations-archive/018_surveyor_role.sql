-- Migration 018: surveyor role.
--
-- A surveyor records site visits and nothing else. They are not admins: no
-- listings, bookings, viewings, users or rates.
--
-- This gets its own column rather than reusing users.user_type, which is
-- constrained to ('intern','local','expat') -- those describe what kind of
-- tenant someone is, not what they are allowed to do. Overloading it would
-- conflate identity with authorization and break the existing CHECK.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_surveyor boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN users.is_surveyor IS
  'Grants access to the survey form only (/survey). Independent of is_admin.';
