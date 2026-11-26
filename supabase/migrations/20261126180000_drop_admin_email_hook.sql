-- Drop the admin@verihome.id bootstrap hook.
--
-- trg_set_admin_flag / set_admin_flag() granted superadmin to whoever inserted
-- a public.users row with the email 'admin@verihome.id'. It was the bootstrap
-- path before staff roles existed. Superadmin is now granted through the UI
-- (grantStaffRole / createAdminUser, both gated by staff.manage), so the hook
-- has no legitimate job left, and it has one dangerous one: if that account is
-- ever deleted and the address registered again, whoever registers it becomes
-- superadmin with no existing superadmin involved. Removing it closes that
-- takeover path.
--
-- Existing staff_roles rows are NOT touched: current superadmins stay superadmin.
-- Local/test environments that relied on the hook to seed an admin must insert
-- the staff_roles row explicitly (see scripts/seed-test-admin.js).
--
-- Not reversible by this file by design; to restore, re-create from
-- 20261126120000_staff_roles.sql section 7 (don't).

DROP TRIGGER IF EXISTS trg_set_admin_flag ON public.users;
DROP FUNCTION IF EXISTS public.set_admin_flag();
