-- Owner invites bind to a confirmed email address (follow-up to Phase 3).
--
-- Until now an owner invite was a bearer token: whoever held the link and was
-- signed in — with any account, confirmed or not — became that owner, with
-- their properties, earnings and payout account. Site staff invites
-- (20261128120000) already require the signed-in account's email to equal
-- the invited address and to be confirmed; this brings owner invites level.
--
--   1. owner_invites.email: the address the invite is for, lower-cased and
--      trimmed, copied from owners.email when the invite is issued. A copy,
--      not a join: editing the owner's email later must not silently change
--      who can redeem a link that is already out.
--      Nullable only for history. Invites issued before this migration have
--      no address; redeeming one is refused (invite_email_missing) and the
--      admin issues a new one. Production had no open invite when this was
--      written (1 invite in total, expired).
--   2. redeem_owner_invite checks, after the token checks: the invite has an
--      address, the account's email equals it, and the account's email is
--      confirmed. It reads auth.users, which service_role cannot select, so
--      it becomes SECURITY DEFINER with a pinned search_path (§19.21).
--   3. Grants. EXECUTE on redeem_owner_invite was held by PUBLIC, anon and
--      authenticated, and owner_invites carried full table grants to anon and
--      authenticated. Both were held back only by RLS (on, no policy). Now
--      service_role only, like site_staff_invites — both halves revoked,
--      PUBLIC and the named roles (§19.15). Only the server touches either,
--      through the service key (owner-invite-actions.ts).
--
-- Signature and return type are unchanged, so CREATE OR REPLACE replaces the
-- one function rather than adding an overload (§19.2).

ALTER TABLE public.owner_invites
  ADD COLUMN email text
  CONSTRAINT owner_invites_email_normalised
    CHECK (email IS NULL OR (email <> '' AND email = lower(btrim(email))));

COMMENT ON COLUMN public.owner_invites.email IS
  'Address the invite is for (lower-cased), copied from owners.email at issue. Redeeming needs the signed-in account''s confirmed email to equal it. NULL only on invites issued before 2026-11-28, which can no longer be redeemed.';

REVOKE ALL ON TABLE public.owner_invites FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.redeem_owner_invite(p_token_hash text, p_user_id uuid)
 RETURNS TABLE(owner_id uuid, owner_name text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE
  v_inv owner_invites%ROWTYPE;
  v_own owners%ROWTYPE;
  v_email text;
  v_confirmed timestamptz;
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

  -- The invite is for one address, and only an account that has proved it
  -- owns that address may redeem it. A forwarded link is not enough, and
  -- neither is an account registered under the owner's address and left
  -- unconfirmed.
  IF v_inv.email IS NULL THEN
    RAISE EXCEPTION 'invite_email_missing' USING ERRCODE = 'P0001';
  END IF;
  SELECT lower(btrim(u.email)), u.email_confirmed_at INTO v_email, v_confirmed
    FROM auth.users u WHERE u.id = p_user_id;
  IF v_email IS NULL OR v_email <> v_inv.email THEN
    RAISE EXCEPTION 'invite_email_mismatch' USING ERRCODE = 'P0001';
  END IF;
  IF v_confirmed IS NULL THEN
    RAISE EXCEPTION 'invite_email_unconfirmed' USING ERRCODE = 'P0001';
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
$function$;

REVOKE ALL ON FUNCTION public.redeem_owner_invite(text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_owner_invite(text, uuid) TO service_role;
