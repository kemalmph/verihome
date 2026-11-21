-- 037: owner accounts, and the invite that links one to an owner record.
--
-- Owners have existed only as rows someone else maintains. This is the first
-- way in from outside, which makes isolation the whole point of the design.
--
-- WHY NOT users.role = 'owner'
--
-- The same person can be a guest who books stays and an owner who lets a
-- property. A role column forces a choice between those and would strip one
-- when the other is granted. Ownership is a RELATIONSHIP between a user and an
-- owner record, so it lives on owners.user_id.
--
-- WHY LINKING IS ADMIN-INITIATED
--
-- Matching on a typed email would let anyone claim another person's properties
-- by entering their address. The link is only ever created by redeeming a token
-- an admin generated for one specific owner record.

ALTER TABLE owners
  ADD COLUMN IF NOT EXISTS user_id uuid UNIQUE REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS portal_access text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS invited_at timestamptz,
  ADD COLUMN IF NOT EXISTS activated_at timestamptz;

ALTER TABLE owners DROP CONSTRAINT IF EXISTS owners_portal_access_check;
ALTER TABLE owners ADD CONSTRAINT owners_portal_access_check
  CHECK (portal_access IN ('none','invited','active','revoked'));

COMMENT ON COLUMN owners.user_id IS
  'The account that controls this owner record. Set only by redeeming an admin-generated invite token, never by matching an email.';
COMMENT ON COLUMN owners.portal_access IS
  'none = never invited. invited = token issued, not yet redeemed. active = can use the portal. revoked = refused on every request, not only at login.';

-- ── Invites ─────────────────────────────────────────────────────────────────
-- A table rather than columns on owners, so re-inviting leaves an audit trail
-- instead of overwriting the previous attempt.
CREATE TABLE IF NOT EXISTS owner_invites (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    uuid NOT NULL REFERENCES owners(id) ON DELETE CASCADE,
  -- The raw token is shown once, to the admin, and never stored. A leaked
  -- database backup must not hand someone a working invite.
  token_hash  text NOT NULL UNIQUE,
  expires_at  timestamptz NOT NULL,
  used_at     timestamptz,
  used_by     uuid REFERENCES users(id),
  created_by  uuid REFERENCES users(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  revoked_at  timestamptz
);

CREATE INDEX IF NOT EXISTS idx_owner_invites_owner ON owner_invites (owner_id);

ALTER TABLE owner_invites ENABLE ROW LEVEL SECURITY;
-- No policies: service role only. Reached through server actions that
-- authorize themselves.

COMMENT ON TABLE owner_invites IS
  'Single-use portal invites. Only the hash is stored; the raw token exists once, in the link the admin sends.';

-- ── Redeeming ───────────────────────────────────────────────────────────────
-- All the refusal conditions live here, in the function that does the linking.
-- A caller cannot skip them by calling something else.
CREATE OR REPLACE FUNCTION redeem_owner_invite(
  p_token_hash text,
  p_user_id    uuid
)
RETURNS TABLE (owner_id uuid, owner_name text)
LANGUAGE plpgsql
AS $$
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

  -- Already linked to somebody else: refuse rather than silently re-point the
  -- record at a new account.
  IF v_own.user_id IS NOT NULL AND v_own.user_id <> p_user_id THEN
    RAISE EXCEPTION 'owner_already_linked' USING ERRCODE = 'P0001';
  END IF;

  -- One account cannot hold two owner records: owners.user_id is UNIQUE, and
  -- this gives the case a readable error instead of a constraint violation.
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
$$;

COMMENT ON FUNCTION redeem_owner_invite(text, uuid) IS
  'Links a user account to an owner record by single-use token. Every refusal condition is checked here so no caller can bypass them.';
