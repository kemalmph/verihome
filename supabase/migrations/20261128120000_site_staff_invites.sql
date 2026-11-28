-- Phase 3: invites for per-site staff (site_staff), modelled on owner_invites.
--
-- A site owner (or a superstaff, or a superadmin) invites someone by email to
-- one role on one site. The link carries a random token; only its SHA-256
-- hash is stored, so a leaked backup holds no usable invite. Redeeming is
-- single use, needs an unexpired, unrevoked invite, and needs the signed-in
-- account's email to equal the invited one AND be confirmed — a forwarded
-- link does not make its reader staff, and neither does registering an
-- unconfirmed account under the invitee's address.
--
-- Who may invite which role is decided in the app (site-permissions.ts,
-- manageableSiteRoles): owner → every role, superstaff → front_office,
-- back_office, finance. The database stores what was decided and enforces the
-- single-use and matching rules, so a second caller added later cannot skip
-- them.
--
-- Service-role only, like site_staff and owner_invites: RLS on, no policies,
-- every grant revoked from PUBLIC, anon and authenticated (REVOKE FROM PUBLIC
-- alone is not enough on Supabase, which grants to anon/authenticated
-- directly).

CREATE TABLE public.site_staff_invites (
  id          uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  site_id     uuid        NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  role        text        NOT NULL
              CHECK (role IN ('superstaff','front_office','back_office','finance')),
  -- Stored lower-cased and trimmed, so the redeem comparison is one equality.
  email       text        NOT NULL CHECK (email <> '' AND email = lower(btrim(email))),
  token_hash  text        NOT NULL UNIQUE,
  invited_by  uuid        REFERENCES public.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL,
  redeemed_at timestamptz,
  redeemed_by uuid        REFERENCES public.users(id) ON DELETE SET NULL,
  revoked_at  timestamptz,
  CONSTRAINT site_staff_invites_redeemed_pair
    CHECK (redeemed_at IS NOT NULL OR redeemed_by IS NULL)
);

COMMENT ON TABLE public.site_staff_invites IS
  'Single-use invites to a site_staff role. Token stored as SHA-256 only. Service-role only.';

CREATE INDEX site_staff_invites_site_idx ON public.site_staff_invites (site_id);

ALTER TABLE public.site_staff_invites ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.site_staff_invites FROM PUBLIC, anon, authenticated;

-- ─── Redeem ──────────────────────────────────────────────────────────────────
-- Every refusal lives here. The app only maps the error code onto a sentence.
-- FOR UPDATE on the invite row makes two simultaneous redeems of one token
-- serialise: the second sees redeemed_at set and fails.
--
-- SECURITY DEFINER because the email check reads auth.users, which
-- service_role cannot select. search_path is pinned, and EXECUTE is revoked
-- from PUBLIC, anon and authenticated below: only the server (service_role)
-- calls it.
CREATE OR REPLACE FUNCTION public.redeem_site_staff_invite(p_token_hash text, p_user_id uuid)
 RETURNS TABLE(site_id uuid, site_slug text, role text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
#variable_conflict use_column
DECLARE
  v_inv   site_staff_invites%ROWTYPE;
  v_email text;
  v_confirmed timestamptz;
  v_slug  text;
BEGIN
  SELECT * INTO v_inv FROM site_staff_invites WHERE token_hash = p_token_hash FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'invite_invalid' USING ERRCODE = 'P0001';
  END IF;
  IF v_inv.redeemed_at IS NOT NULL THEN
    RAISE EXCEPTION 'invite_already_used' USING ERRCODE = 'P0001';
  END IF;
  IF v_inv.revoked_at IS NOT NULL THEN
    RAISE EXCEPTION 'invite_revoked' USING ERRCODE = 'P0001';
  END IF;
  IF v_inv.expires_at < now() THEN
    RAISE EXCEPTION 'invite_expired' USING ERRCODE = 'P0001';
  END IF;

  SELECT lower(btrim(u.email)), u.email_confirmed_at INTO v_email, v_confirmed
    FROM auth.users u WHERE u.id = p_user_id;
  IF v_email IS NULL OR v_email <> v_inv.email THEN
    RAISE EXCEPTION 'invite_email_mismatch' USING ERRCODE = 'P0001';
  END IF;
  -- Matching an address nobody has proved they own proves nothing: an
  -- account can be registered under someone else's email and sit
  -- unconfirmed. Only a confirmed address counts as the invitee.
  IF v_confirmed IS NULL THEN
    RAISE EXCEPTION 'invite_email_unconfirmed' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO site_staff (site_id, user_id, role, granted_by)
  VALUES (v_inv.site_id, p_user_id, v_inv.role, v_inv.invited_by)
  ON CONFLICT DO NOTHING;

  UPDATE site_staff_invites
     SET redeemed_at = now(), redeemed_by = p_user_id
   WHERE id = v_inv.id;

  SELECT s.slug INTO v_slug FROM sites s WHERE s.id = v_inv.site_id;
  RETURN QUERY SELECT v_inv.site_id, v_slug, v_inv.role;
END;
$function$;

REVOKE ALL ON FUNCTION public.redeem_site_staff_invite(text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_site_staff_invite(text, uuid) TO service_role;
