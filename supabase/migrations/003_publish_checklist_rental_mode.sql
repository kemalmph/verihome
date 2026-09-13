-- Migration 003: add rental_mode_configured to publish_checklist
-- A short-stay or "both" property must have an active rate before going live.

ALTER TABLE publish_checklist
  ADD COLUMN IF NOT EXISTS rental_mode_configured BOOLEAN NOT NULL DEFAULT false;
