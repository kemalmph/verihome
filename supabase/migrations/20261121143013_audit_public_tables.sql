-- ============================================================================
-- audit_public_tables() — so the exposure audit cannot audit a stale list.
--
-- scripts/audit-anon-exposure.js carried its table list in the script. The list
-- went stale: sites, lettable_units and unit_reservations were named in its
-- CLOSED_TO_ALL set, which reads as "these are checked", while never being
-- probed. A deliberate GRANT SELECT to anon on unit_reservations, with a
-- permissive policy, was staged on 2026-11-21 and the audit reported
-- "0 flagged" — the exact failure mode §19.12 exists to catch.
--
-- The audit talks to the database through PostgREST, which cannot read
-- information_schema, so it needs a function. This is it.
--
-- SECURITY DEFINER, because the caller must not need catalog privileges — but
-- EXECUTE is granted to service_role only. The list of tables in a schema is
-- a map of what exists; handing it to anon would be a small gift to anyone
-- probing the API, and the audit already runs with the service key.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.audit_public_tables()
 RETURNS TABLE (table_name text)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path = pg_catalog, public
AS $function$
  SELECT c.relname::text
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public'
     AND c.relkind = 'r'                      -- ordinary tables only: no views,
                                              -- no partitions, no sequences
     AND c.relname <> 'schema_migrations'
   ORDER BY c.relname;
$function$;

-- Default EXECUTE on a new function goes to PUBLIC, so it has to be taken away
-- before it is given to the one role that should have it. Revoking from PUBLIC
-- alone is not enough — anon and authenticated may hold it directly.
REVOKE ALL ON FUNCTION public.audit_public_tables() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.audit_public_tables() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.audit_public_tables() TO service_role;

COMMENT ON FUNCTION public.audit_public_tables() IS
  'Public table names, for scripts/audit-anon-exposure.js. service_role only: a schema map is not for anon.';
