-- 038: what the owner portal needs — owner-created blocks, payout details,
-- documents, and the change requests an owner may propose but not apply.

-- ── Owner-created availability blocks ───────────────────────────────────────
-- Recording WHO created a block is what lets the portal offer removal safely:
-- an owner may remove their own block and nothing else. Without this column
-- "remove block" would be a button that can delete a booking's date hold.
ALTER TABLE availability_blocks
  ADD COLUMN IF NOT EXISTS created_by_owner uuid REFERENCES owners(id),
  ADD COLUMN IF NOT EXISTS note text;

CREATE INDEX IF NOT EXISTS idx_blocks_created_by_owner
  ON availability_blocks (created_by_owner) WHERE created_by_owner IS NOT NULL;

ALTER TABLE availability_blocks DROP CONSTRAINT IF EXISTS availability_blocks_reason_check;
ALTER TABLE availability_blocks ADD CONSTRAINT availability_blocks_reason_check
  CHECK (reason IN ('booked','maintenance','owner_use','other'));

-- ── Payout account ──────────────────────────────────────────────────────────
ALTER TABLE owners
  ADD COLUMN IF NOT EXISTS payout_bank text,
  ADD COLUMN IF NOT EXISTS payout_account_number text,
  ADD COLUMN IF NOT EXISTS payout_account_holder text,
  ADD COLUMN IF NOT EXISTS payout_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS payout_verified_by uuid REFERENCES users(id);

COMMENT ON COLUMN owners.payout_verified_at IS
  'When an admin confirmed this account by phone. A payout account with no verification is not used.';

-- ── Documents ───────────────────────────────────────────────────────────────
-- Only the object key is stored. The files live in the PRIVATE R2 bucket under
-- owner-documents/ and are served by presigned URL, like payment proofs.
CREATE TABLE IF NOT EXISTS owner_documents (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id      uuid NOT NULL REFERENCES owners(id) ON DELETE CASCADE,
  kind          text NOT NULL CHECK (kind IN ('right_to_let','cooperation_agreement')),
  object_key    text NOT NULL,
  original_name text,
  uploaded_at   timestamptz NOT NULL DEFAULT now(),
  uploaded_by   uuid REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_owner_documents_owner ON owner_documents (owner_id);
ALTER TABLE owner_documents ENABLE ROW LEVEL SECURITY;

-- ── Change requests ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS owner_change_requests (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    uuid NOT NULL REFERENCES owners(id),
  property_id uuid REFERENCES properties(id),
  kind        text NOT NULL CHECK (kind IN ('rate_change','payout_account')),
  proposed    jsonb NOT NULL,
  previous    jsonb,
  status      text NOT NULL DEFAULT 'pending' CHECK (status IN (
                'pending','approved','rejected','cancelled')),
  reviewed_by uuid REFERENCES users(id),
  reviewed_at timestamptz,
  review_note text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ocr_pending ON owner_change_requests (created_at)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_ocr_owner ON owner_change_requests (owner_id);

-- One pending payout change per owner. Two in flight would make "which account
-- did the admin actually verify?" unanswerable.
CREATE UNIQUE INDEX IF NOT EXISTS idx_ocr_one_pending_payout
  ON owner_change_requests (owner_id)
  WHERE kind = 'payout_account' AND status = 'pending';

ALTER TABLE owner_change_requests ENABLE ROW LEVEL SECURITY;
-- No policies: service role only, reached through actions that authorize.

COMMENT ON TABLE owner_change_requests IS
  'Things an owner may propose but not apply. Rates change only for future bookings; a payout account is not used until an admin verifies it by phone.';

-- ── Blocking dates ──────────────────────────────────────────────────────────
-- Takes the SAME per-property advisory lock as booking creation, so a block and
-- a booking can never be written for one set of dates at once. Without it the
-- two paths would race exactly as two bookings used to (§8): each checks, each
-- sees nothing, both write.
CREATE OR REPLACE FUNCTION owner_block_dates(
  p_property_id uuid,
  p_owner_id    uuid,
  p_start       date,
  p_end         date,
  p_note        text DEFAULT NULL
)
RETURNS availability_blocks
LANGUAGE plpgsql
AS $$
DECLARE
  v_hex   text;
  v_block availability_blocks;
BEGIN
  IF p_end <= p_start THEN
    RAISE EXCEPTION 'invalid_range' USING ERRCODE = 'P0001';
  END IF;

  -- Ownership is re-checked here, not trusted from the caller.
  IF NOT EXISTS (SELECT 1 FROM properties WHERE id = p_property_id AND owner_id = p_owner_id) THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0001';
  END IF;

  v_hex := replace(p_property_id::text, '-', '');
  PERFORM pg_advisory_xact_lock(
    ('x' || left(v_hex,  8))::bit(32)::int,
    ('x' || right(v_hex, 8))::bit(32)::int
  );

  -- Under the lock: a live booking overlapping these dates wins. An owner
  -- cannot block dates a guest has already paid for.
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
$$;

-- An owner removes only blocks they created. Filtering by both ids in the
-- DELETE means a block belonging to someone else is not found rather than
-- refused, and a booking's own date hold can never be reached at all.
CREATE OR REPLACE FUNCTION owner_remove_block(
  p_block_id uuid,
  p_owner_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE v_rows int;
BEGIN
  DELETE FROM availability_blocks
   WHERE id = p_block_id
     AND created_by_owner = p_owner_id
     AND booking_id IS NULL;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows > 0;
END;
$$;
