-- UPRN -> the property's own point, without the polygon join.
--
-- `resolve_property_boundary` answers both halves of the question at once: it
-- finds the OS Open UPRN pin AND the INSPIRE parcel covering it. Monorepo #187
-- retires the parcel half -- the per-council `geo.inspire_polygons` table is
-- duplicated by a national FlatGeobuf on R2 that the `inspire-title` Worker
-- serves for the whole of England and Wales, at a fraction of the cost and
-- without a council-by-council ingest.
--
-- The pin half is NOT duplicated. Nothing else in either repo turns a UPRN into
-- a point, and the Worker takes a point -- so this is the thing that feeds it,
-- and it also supplies the `uprn-centroid` rung of the fallback chain, which
-- outlives the polygons either way.
--
-- Latitude and longitude are returned alongside the grid reference so the
-- browser never has to reproject. PostGIS already holds the authoritative
-- transform; shipping a projection library to every visitor to repeat it would
-- be absurd, and two implementations of OSGB36 is exactly how a boundary ends
-- up quietly two metres out.
--
-- `resolve_property_boundary` is deliberately left in place. It is what
-- production runs until the client switches over, and dropping it in the same
-- migration that adds its replacement would mean an outage between deploy and
-- release. It goes when `geo.inspire_polygons` goes.

create or replace function public.resolve_uprn_point(p_uprn text)
returns table (
  easting double precision,
  northing double precision,
  lat double precision,
  lng double precision
)
language sql
stable
security definer
set search_path to ''
as $$
  -- Non-numeric input yields NULL and therefore no row, rather than an error:
  -- an unknown UPRN and a malformed one degrade the same way for the caller.
  with target as (
    select case when p_uprn ~ '^[0-9]{1,12}$' then p_uprn::bigint end as uprn
  )
  select u.easting,
         u.northing,
         extensions.st_y(extensions.st_transform(u.geom, 4326)),
         extensions.st_x(extensions.st_transform(u.geom, 4326))
  from target t
  join geo.os_open_uprn u on u.uprn = t.uprn
  limit 1;
$$;

-- Same posture as resolve_property_boundary: nothing is granted on the `geo`
-- schema itself, so this definer function is the only way in.
revoke all on function public.resolve_uprn_point(text) from public;
grant execute on function public.resolve_uprn_point(text) to anon, authenticated;

comment on function public.resolve_uprn_point(text) is
  'UPRN -> OS Open UPRN pin as BNG easting/northing and WGS84 lat/lng. Feeds the inspire-title Worker, which resolves the parcel.';
