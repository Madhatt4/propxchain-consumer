-- Property-specific search boundaries from HM Land Registry INSPIRE Index Polygons.
--
-- WHY. Groundsure's environmental / flood / planning / geo-risk reports are
-- area-based: we send a WKT POLYGON in EPSG:27700 and they assess what is inside
-- it. Until now that polygon was a 70m square around the POSTCODE CENTROID
-- (src/services/propertyBoundary.service.ts), which on a long street can sit over
-- neighbouring land — the buyer gets a clean environmental report on land that is
-- not their house. Marek Lukowski (Groundsure, 2026-09-01) confirmed no reseller
-- sends a centroid box; they send a property-specific site outline.
--
-- INSPIRE Index Polygons are the free (OGL) sibling of the paid National Polygon
-- dataset: registered FREEHOLD parcels for England and Wales, published per local
-- authority as GML in EPSG:27700. Resolution is by spatial containment —
-- UPRN -> BNG point (OS Open UPRN) -> the parcel that contains it — NOT via the
-- HMLR UPRN/INSPIRE-ID lookups on Price Paid Data. Those attach only to PPD
-- published from 2026-08-28 onward and are never retrospective, so a seller whose
-- house last sold in 2019 has no row and would silently fall back to the box.
--
-- SCHEMA CHOICE. The two reference tables live in `geo`, which is NOT exposed to
-- the Data API, so PostgREST can never read them directly and the 143k-parcel
-- copy cannot be bulk-enumerated. The only way in is public.resolve_property_boundary(),
-- a narrow SECURITY DEFINER function that takes one UPRN and returns one parcel.
-- RLS is enabled on both tables as defence in depth even though nothing is granted.
--
-- The data is Crown copyright / OGL and contains no personal data: a UPRN
-- identifies a property, not a person, and no name, address or principal is
-- stored here.

create extension if not exists postgis with schema extensions;

create schema if not exists geo;
revoke all on schema geo from public, anon, authenticated;

-- INSPIRE parcels. Source GML declares Polygon; we store MultiPolygon so the
-- column also accepts the multi-part parcels that appear in other councils.
create table if not exists geo.inspire_polygons (
  inspire_id      bigint primary key,
  local_authority text not null,
  geom            extensions.geometry(MultiPolygon, 27700) not null,
  area_sq_metres  double precision
                    generated always as (extensions.st_area(geom)) stored,
  ingested_at     timestamptz not null default now()
);

-- The containment test is the hot path; without this it is a 143k-row seq scan.
create index if not exists inspire_polygons_geom_idx
  on geo.inspire_polygons using gist (geom);

-- OS Open UPRN, filtered at ingest to the bounding box of the councils we hold
-- polygons for. Easting/northing are stored as published; the point is derived so
-- the two can never drift apart.
create table if not exists geo.os_open_uprn (
  uprn        bigint primary key,
  easting     double precision not null,
  northing    double precision not null,
  geom        extensions.geometry(Point, 27700)
                generated always as (
                  extensions.st_setsrid(extensions.st_makepoint(easting, northing), 27700)
                ) stored,
  ingested_at timestamptz not null default now()
);

alter table geo.inspire_polygons enable row level security;
alter table geo.os_open_uprn     enable row level security;

-- Resolve one UPRN to its containing freehold parcel.
--
-- Returns exactly one row when the UPRN is known, with a NULL inspire_id /
-- boundary_wkt when no parcel contains the point (unregistered land, or a council
-- we have not ingested). It returns NO rows when the UPRN itself is unknown. The
-- caller distinguishes those cases; this function never raises, so a malformed
-- UPRN degrades to "not found" rather than a 500.
--
-- ORDER BY area ASC is load-bearing. INSPIRE parcels overlap — a house plot can
-- sit inside a larger estate or shared-access parcel — and the smallest parcel
-- containing the point is the one that is actually this property. Measured: 1% of
-- UPRNs fall inside up to 3 parcels. Single-part parcels sort first so a
-- multi-part one (which cannot be emitted, see below) never shadows a usable one.
--
-- The 1 ha ceiling and the small-sliver floor are deliberately NOT applied here.
-- They are the caller's decision so they stay unit-testable in the client; this
-- function returns the raw facts (area, WKT, and the UPRN point for fallback).
create or replace function public.resolve_property_boundary(p_uprn text)
returns table (
  inspire_id      bigint,
  local_authority text,
  boundary_wkt    text,
  area_sq_metres  double precision,
  easting         double precision,
  northing        double precision
)
language sql
stable
security definer
set search_path = ''
as $$
  with target as (
    -- Guard the cast: a non-numeric UPRN yields NULL and matches nothing,
    -- instead of raising invalid_text_representation to the client.
    select case when p_uprn ~ '^[0-9]{1,12}$' then p_uprn::bigint end as uprn
  )
  select p.inspire_id,
         p.local_authority,
         -- POLYGON only, never MULTIPOLYGON. The Groundsure and PISCES pipelines
         -- have only ever been sent POLYGON (bngPolygonToWkt) and their handling
         -- of MULTIPOLYGON is untested, so a genuinely multi-part parcel returns
         -- NULL here and the caller degrades to a box on the UPRN pin rather than
         -- shipping a shape we have never seen accepted. Central Bedfordshire has
         -- no multi-part parcels at all (0 of 143,060, max 1 part), so this costs
         -- nothing today and removes the untested path for whatever is ingested
         -- next. If multi-part ever matters, test it upstream first and then emit.
         case when extensions.st_numgeometries(p.geom) = 1
              then extensions.st_astext(extensions.st_geometryn(p.geom, 1))
              else null end,
         p.area_sq_metres,
         u.easting,
         u.northing
  from target t
  join geo.os_open_uprn u on u.uprn = t.uprn
  left join geo.inspire_polygons p
         -- ST_Covers, NOT ST_Contains. ST_Contains is FALSE for a point lying
         -- exactly on the polygon boundary, and UPRN pins do land on shared edges
         -- - terraced party walls and boundary fences. Measured on this ingest:
         -- 26 of 5,079 parcel hits in a 19,448-UPRN sample (0.5%) are covered but
         -- not contained, so ST_Contains silently boxed ~840 real properties that
         -- have a perfectly good parcel.
         on extensions.st_covers(p.geom, u.geom)
  -- Prefer a parcel we can actually emit (single-part), then the smallest.
  order by (extensions.st_numgeometries(p.geom) = 1) desc nulls last,
           p.area_sq_metres asc nulls last
  limit 1;
$$;

revoke all on function public.resolve_property_boundary(text) from public;
grant execute on function public.resolve_property_boundary(text) to anon, authenticated;
