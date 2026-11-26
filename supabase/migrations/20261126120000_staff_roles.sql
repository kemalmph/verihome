-- Staff access moves from two boolean flags on public.users (is_admin,
-- is_surveyor) to permission-based roles.
--
-- Fase 1 of the roles plan. users.is_admin / users.is_surveyor are NOT dropped
-- here: they stay as frozen legacy columns (backfilled below, no longer read
-- by the app or by any policy). Dropping them is a later, separate migration.
--
-- The role -> permission map lives in two places on purpose: here (for RLS) and
-- in src/lib/auth/permissions.ts (for the app). scripts/test-staff-permissions.js
-- asserts the two agree, so a drift fails a test instead of failing silently.

-- ─── 1. staff_roles ──────────────────────────────────────────────────────────
CREATE TABLE public.staff_roles (
  user_id    uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role       text        NOT NULL
             CHECK (role IN ('superadmin','admin_general','admin_listings','admin_finance','surveyor')),
  granted_by uuid        REFERENCES public.users(id) ON DELETE SET NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, role)
);

COMMENT ON TABLE public.staff_roles IS
  'Cosystem-wide staff roles (superadmin, admin_general, admin_listings, admin_finance, surveyor). A user may hold several. Replaces users.is_admin / users.is_surveyor. granted_by is NULL for the backfill and the bootstrap hook. Service-role only: the app reads it through the admin client, and only superadmin (staff.manage) may write it.';

-- ─── 2. site_staff (used from Phase 3) ───────────────────────────────────────
CREATE TABLE public.site_staff (
  site_id    uuid        NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  user_id    uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role       text        NOT NULL
             CHECK (role IN ('superstaff','front_office','back_office','finance')),
  granted_by uuid        REFERENCES public.users(id) ON DELETE SET NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (site_id, user_id, role)
);

COMMENT ON TABLE public.site_staff IS
  'Per-site staff roles (superstaff, front_office, back_office, finance) for coworking sites. Created in Phase 1, nothing reads or writes it until Phase 3. Service-role only.';

CREATE INDEX site_staff_user_idx ON public.site_staff (user_id);

-- ─── 3. RLS: on, no policies, no grants (service_role only) ──────────────────
ALTER TABLE public.staff_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_staff  ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.staff_roles FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.site_staff  FROM PUBLIC, anon, authenticated;

-- ─── 4. Backfill ─────────────────────────────────────────────────────────────
INSERT INTO public.staff_roles (user_id, role)
SELECT id, 'superadmin' FROM public.users WHERE is_admin = true
ON CONFLICT DO NOTHING;

INSERT INTO public.staff_roles (user_id, role)
SELECT id, 'surveyor' FROM public.users WHERE is_surveyor = true
ON CONFLICT DO NOTHING;

-- ─── 5. Permission functions ─────────────────────────────────────────────────
-- Role -> permissions. Mirror of src/lib/auth/permissions.ts.
CREATE OR REPLACE FUNCTION public.staff_role_permissions(p_role text)
 RETURNS text[]
 LANGUAGE sql
 IMMUTABLE
 SET search_path = public, pg_temp
AS $function$
  SELECT CASE p_role
    WHEN 'superadmin' THEN ARRAY[
      'staff.manage','users.manage','listings.manage','bookings.operate',
      'payments.settle','owners.payout_verify','finance.view','finance.operate',
      'surveys.input','surveys.review','sites.operate_all','sites.finance_all',
      'platform.settings']
    WHEN 'admin_general' THEN ARRAY[
      'users.manage','listings.manage','bookings.operate',
      'surveys.input','surveys.review','sites.operate_all']
    WHEN 'admin_listings' THEN ARRAY[
      'listings.manage','bookings.operate','surveys.input','surveys.review']
    WHEN 'admin_finance' THEN ARRAY[
      'payments.settle','owners.payout_verify','finance.view','finance.operate',
      'sites.finance_all']
    WHEN 'surveyor' THEN ARRAY['surveys.input']
    ELSE ARRAY[]::text[]
  END
$function$;

-- Does the signed-in caller (auth.uid()) hold this role?
CREATE OR REPLACE FUNCTION public.has_staff_role(p_role text)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.staff_roles
    WHERE user_id = auth.uid() AND role = p_role
  )
$function$;

-- Does the signed-in caller hold any role that grants this permission?
CREATE OR REPLACE FUNCTION public.has_staff_permission(p_permission text)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.staff_roles sr
    WHERE sr.user_id = auth.uid()
      AND p_permission = ANY (public.staff_role_permissions(sr.role))
  )
$function$;

-- ...or any of several (a policy that admits finance for reads and ops for writes).
CREATE OR REPLACE FUNCTION public.has_any_staff_permission(p_permissions text[])
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.staff_roles sr
    WHERE sr.user_id = auth.uid()
      AND public.staff_role_permissions(sr.role) && p_permissions
  )
$function$;

-- Revoking from PUBLIC alone is not enough on Supabase (§19.15): anon and
-- authenticated hold EXECUTE through default privileges. Revoke all three, then
-- give back only what is needed. authenticated keeps EXECUTE because RLS
-- policies call these as the invoking role; anon gets nothing, so the policies
-- below are rewritten TO authenticated instead of TO public.
REVOKE ALL ON FUNCTION public.staff_role_permissions(text)      FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.has_staff_role(text)              FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.has_staff_permission(text)        FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.has_any_staff_permission(text[])  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.staff_role_permissions(text)     TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_staff_role(text)             TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_staff_permission(text)       TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_any_staff_permission(text[]) TO authenticated, service_role;

-- ─── 6. Policies that read users.is_admin ────────────────────────────────────
-- The app reaches these tables through service_role, so these only govern a
-- signed-in staff member talking to PostgREST directly. Each moves from
-- "is_admin" to the permission that matches the area. TO public -> TO
-- authenticated (see above); anon never matched any of them anyway, since
-- auth.uid() is NULL.
ALTER POLICY admin_write_blocks ON public.availability_blocks
  TO authenticated
  USING (public.has_staff_permission('listings.manage'));

ALTER POLICY admin_write_rates ON public.short_stay_rates
  TO authenticated
  USING (public.has_staff_permission('listings.manage'));

ALTER POLICY admin_all_bookings ON public.bookings
  TO authenticated
  USING (public.has_staff_permission('bookings.operate'));

ALTER POLICY user_own_bookings ON public.bookings
  TO authenticated
  USING (user_id = auth.uid()
         OR public.has_any_staff_permission(ARRAY['bookings.operate','payments.settle','finance.view']));

ALTER POLICY admin_write_credits ON public.user_credits
  TO authenticated
  USING (public.has_staff_permission('finance.operate'));

ALTER POLICY user_own_credits ON public.user_credits
  TO authenticated
  USING (user_id = auth.uid()
         OR public.has_any_staff_permission(ARRAY['finance.view','finance.operate','payments.settle']));

-- ─── 7. set_admin_flag(): the bootstrap hook ────────────────────────────────
-- It used to be a BEFORE INSERT trigger that set is_admin = true for one
-- hard-coded email. Same behaviour, new target: it now grants superadmin in
-- staff_roles. It has to be AFTER INSERT, because staff_roles has a foreign key
-- to the row being inserted. The name is kept so nothing that refers to it
-- breaks; it no longer touches is_admin.
CREATE OR REPLACE FUNCTION public.set_admin_flag()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
BEGIN
  IF NEW.email = 'admin@verihome.id' THEN
    INSERT INTO public.staff_roles (user_id, role, granted_by)
    VALUES (NEW.id, 'superadmin', NULL)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.set_admin_flag() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_set_admin_flag ON public.users;
CREATE TRIGGER trg_set_admin_flag
  AFTER INSERT ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.set_admin_flag();
