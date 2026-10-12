-- Signed-out callers no longer reach the two UPRN lookups.
--
-- 20260901_inspire_polygons and 20260904_resolve_uprn_point granted EXECUTE to
-- anon as well as authenticated. Their one caller, inspireBoundary.service,
-- runs only behind the signed-in transaction page (SearchesPanel and the
-- Groundsure order), so anon reach served nobody. It did let anyone holding
-- the publishable key, which ships in the bundle, run spatial queries against
-- the database for free. The data is open (OS Open UPRN, INSPIRE), so this is
-- about cost and surface, not a leak.
--
-- The monorepo's weekly anon-definer tripwire
-- (supabase-pg-version-check.yml) has failed on both since they landed.
--
-- Both roles are named: 'from public' alone leaves the direct anon grant in
-- place (audit finding F4).
revoke all on function public.resolve_property_boundary(text) from public, anon;
revoke all on function public.resolve_uprn_point(text) from public, anon;
grant execute on function public.resolve_property_boundary(text) to authenticated;
grant execute on function public.resolve_uprn_point(text) to authenticated;
