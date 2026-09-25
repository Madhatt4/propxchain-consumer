#!/usr/bin/env bash
#
# Ingest HM Land Registry INSPIRE Index Polygons + OS Open UPRN for ONE local
# authority into the `geo` schema (see supabase/migrations/20260901_inspire_polygons.sql).
#
# This is a one-off/refresh script, never a runtime path. Groundsure and PISCES
# orders read the result through public.resolve_property_boundary().
#
# ── RUN FROM WSL ────────────────────────────────────────────────────────────
# Needs gdal-bin (ogr2ogr + ogrinfo). Windows has neither, and psql is not
# required — ogrinfo -sql runs the upserts over the same PG driver.
#
#   sudo apt install gdal-bin          # once
#   # Session pooler (IPv4). The direct db.<ref>.supabase.co host is IPv6-only
#   # and is unreachable from most WSL setups. Username is postgres.<ref>.
#   export PROPX_PG_URL='postgresql://postgres.<ref>:<password>@aws-1-<region>.pooler.supabase.com:5432/postgres'
#   ./scripts/ingest-inspire.sh "Central Bedfordshire Council"
#
# The connection string is read from the environment and is never echoed, logged,
# or written to disk by this script. Get it from the Supabase dashboard under
# Settings -> Database -> Connection string (URI). It is a production credential:
# do not paste it into a file in this repo.
#
# Re-running is safe. Parcels and UPRNs upsert on their primary keys and
# ingested_at is refreshed, so a monthly re-run is the refresh mechanism.
#
set -euo pipefail

COUNCIL="${1:-}"
if [ -z "$COUNCIL" ]; then
  echo "usage: $0 \"<Local Authority Name>\"" >&2
  echo "  e.g. $0 \"Central Bedfordshire Council\"" >&2
  echo "  Names must match HMLR's list exactly; see" >&2
  echo "  https://use-land-property-data.service.gov.uk/datasets/inspire/download" >&2
  exit 2
fi

if [ -z "${PROPX_PG_URL:-}" ]; then
  echo "error: PROPX_PG_URL is not set. See the header of this script." >&2
  exit 2
fi

# Catch an unedited template before GDAL does. Left alone, ogr2ogr reports
# "PostgreSQL driver doesn't currently support database creation", which reads
# like a permissions problem rather than "you did not replace <host>".
case "$PROPX_PG_URL" in
  *'<'*|*'>'*)
    cat >&2 <<'PLACEHOLDER'
error: PROPX_PG_URL still contains a < > placeholder — paste the real values.

  Supabase -> Settings -> Database -> Connection string -> URI, e.g.
    postgresql://postgres:YOURPASSWORD@db.<ref>.supabase.co:5432/postgres

  If the password contains @ : / ? # or %, percent-encode it
  (@ -> %40, / -> %2F, # -> %23, ? -> %3F, % -> %25) or the URI parses wrongly.
  If direct connect fails to resolve, use the Session pooler URI instead
  (still port 5432).
PLACEHOLDER
    exit 2
    ;;
esac

for tool in ogr2ogr ogrinfo curl awk python3; do
  command -v "$tool" >/dev/null 2>&1 || { echo "error: $tool not found (sudo apt install gdal-bin)" >&2; exit 2; }
done

# Prove we can reach the database AND that the migration has been applied, before
# spending several minutes parsing 143k parcels only to fail at the load.
PREFLIGHT="$(ogrinfo "PG:${PROPX_PG_URL}" -q -sql \
  "select count(*) as n from geo.inspire_polygons" 2>&1 || true)"
if grep -qiE "PQconnectdb failed|could not translate|authentication failed|Connection refused|Network is unreachable|timeout expired|not found" <<<"$PREFLIGHT"; then
  echo "error: cannot connect to the database. The server said:" >&2
  grep -oiE "FATAL:.*|could not translate host name[^,]*|Network is unreachable" <<<"$PREFLIGHT" \
    | sort -u | sed 's/^/       /' >&2
  cat >&2 <<'CONNHELP'

       Reading that message:

       "Network is unreachable" / "could not translate host name"
           You are on db.<ref>.supabase.co. That host is IPv6-ONLY and most
           WSL setups have no IPv6 route, so no password will help. Switch to
           the Session pooler, which is IPv4:

             postgresql://postgres.<ref>:PASSWORD@aws-1-<region>.pooler.supabase.com:5432/postgres

           Note the username becomes postgres.<ref>, not postgres.

       "tenant/user ... not found"
           Right pooler, wrong regional shard. Try aws-0- instead of aws-1-
           (or vice versa); the dashboard's Session pooler URI has the correct one.

       "password authentication failed"
           Host and username are right, the password is wrong. Percent-encode
           @ : / ? # % if it contains them, or reset it in the dashboard.

       Use port 5432 (session mode), NOT 6543 (transaction mode) — the bulk
       load needs session-level features that transaction pooling does not keep.
CONNHELP
  exit 1
fi
if grep -qiE "does not exist|relation .* geo" <<<"$PREFLIGHT"; then
  echo "error: connected, but geo.inspire_polygons is missing." >&2
  echo "       Apply supabase/migrations/20260901_inspire_polygons.sql first." >&2
  exit 1
fi

WORK="${PROPX_INGEST_CACHE:-/tmp/propx-inspire}"
mkdir -p "$WORK"

# HMLR uses underscores for spaces in the download path.
SLUG="${COUNCIL// /_}"
ZIP="$WORK/${SLUG}.zip"
GML_MEMBER="Land_Registry_Cadastral_Parcels.gml"
UPRN_ZIP="$WORK/osopenuprn.zip"
UPRN_CSV="$WORK/osopenuprn.csv"

say() { printf '\n\033[1m==> %s\033[0m\n' "$*"; }

# ── 1. INSPIRE polygons ─────────────────────────────────────────────────────
#
# GOTCHA: the service issues a cookie and 302s back to the same URL. Without a
# cookie jar curl follows that redirect forever and dies at --max-redirs. -c/-b
# is not optional here.
say "INSPIRE polygons for ${COUNCIL}"
if [ -s "$ZIP" ]; then
  echo "using cached $ZIP"
else
  echo "downloading..."
  curl -fSL --cookie-jar "$WORK/cookies.txt" --cookie "$WORK/cookies.txt" \
    "https://use-land-property-data.service.gov.uk/datasets/inspire/download/${SLUG}.zip" \
    -o "$ZIP"
fi

GML="/vsizip/${ZIP}/${GML_MEMBER}"

# INSPIRE is published in EPSG:27700 (OSGB36 / British National Grid) already.
# Verify rather than assume — a silent reprojection would put every parcel in the
# wrong place while still looking like valid WKT.
say "Checking projection and extent"
SUMMARY="$(ogrinfo -so -al "$GML" 2>/dev/null)"
if ! grep -q "British National Grid" <<<"$SUMMARY"; then
  echo "error: layer is not in British National Grid; refusing to load." >&2
  echo "       Inspect with: ogrinfo -so -al '$GML'" >&2
  exit 1
fi
FEATURES="$(grep -m1 '^Feature Count:' <<<"$SUMMARY" | awk '{print $3}')"
EXTENT_LINE="$(grep -m1 '^Extent:' <<<"$SUMMARY")"
echo "  ${FEATURES} parcels, ${EXTENT_LINE}"

# Extent: (488411.661000, 212401.420000) - (529295.010000, 257799.290000)
read -r MINX MINY MAXX MAXY <<<"$(sed -E 's/[(),-]/ /g; s/Extent://' <<<"$EXTENT_LINE" | awk '{print $1, $2, $3, $4}')"
# Pad by 200m so a UPRN just outside the parcel envelope is still available for
# the 'uprn-centroid' fallback.
PAD=200
MINX=$(awk -v v="$MINX" -v p="$PAD" 'BEGIN{print v-p}')
MINY=$(awk -v v="$MINY" -v p="$PAD" 'BEGIN{print v-p}')
MAXX=$(awk -v v="$MAXX" -v p="$PAD" 'BEGIN{print v+p}')
MAXY=$(awk -v v="$MAXY" -v p="$PAD" 'BEGIN{print v+p}')
echo "  UPRN bbox (padded ${PAD}m): $MINX $MINY $MAXX $MAXY"

say "Loading parcels into geo.inspire_stage"
# Staged, not loaded straight into geo.inspire_polygons, because area_sq_metres is
# a generated column and cannot be written by ogr2ogr, and because the upsert
# below is what makes a re-run idempotent.
ogr2ogr -f PostgreSQL "PG:${PROPX_PG_URL}" "$GML" \
  -nln geo.inspire_stage -overwrite \
  -nlt MULTIPOLYGON \
  -lco GEOMETRY_NAME=geom -lco SPATIAL_INDEX=NONE -lco FID=stage_id \
  -sql "select INSPIREID as inspire_id from PREDEFINED" \
  --config PG_USE_COPY YES

say "Upserting into geo.inspire_polygons"
ogrinfo "PG:${PROPX_PG_URL}" -sql "
  insert into geo.inspire_polygons (inspire_id, local_authority, geom, ingested_at)
  select s.inspire_id, '${COUNCIL//\'/\'\'}', st_multi(s.geom), now()
    from geo.inspire_stage s
   where s.inspire_id is not null
  on conflict (inspire_id) do update
     set geom            = excluded.geom,
         local_authority = excluded.local_authority,
         ingested_at     = excluded.ingested_at;
  drop table if exists geo.inspire_stage;
" >/dev/null

# ── 2. OS Open UPRN ─────────────────────────────────────────────────────────
#
# One national CSV (~618 MB zipped, ~2.3 GB / 41.6M rows open). We only keep the
# rows inside this council's envelope, which is a few hundred thousand.
say "OS Open UPRN"
if [ -s "$UPRN_ZIP" ]; then
  echo "using cached $UPRN_ZIP"
else
  echo "downloading ~618 MB (cached in $WORK for later councils)..."
  curl -fSL "https://api.os.uk/downloads/v1/products/OpenUPRN/downloads?area=GB&format=CSV&redirect" \
    -o "$UPRN_ZIP"
fi

say "Filtering UPRNs to the council envelope"
# Read the CSV straight out of the zip so 2.3 GB is never written to disk. The
# header carries a UTF-8 BOM, hence skipping NR==1 rather than matching on name.
# Columns: UPRN,X_COORDINATE,Y_COORDINATE,LATITUDE,LONGITUDE
python3 - "$UPRN_ZIP" "$UPRN_CSV" "$MINX" "$MINY" "$MAXX" "$MAXY" <<'PY'
import csv, io, sys, zipfile
zip_path, out_path, minx, miny, maxx, maxy = sys.argv[1], sys.argv[2], *map(float, sys.argv[3:7])
zf = zipfile.ZipFile(zip_path)
member = next(n for n in zf.namelist() if n.lower().endswith(".csv"))
kept = total = 0
with zf.open(member) as fh, open(out_path, "w", newline="") as out:
    reader = csv.reader(io.TextIOWrapper(fh, "utf-8-sig"))
    writer = csv.writer(out)
    next(reader, None)
    writer.writerow(["uprn", "easting", "northing"])
    for row in reader:
        total += 1
        try:
            x, y = float(row[1]), float(row[2])
        except (ValueError, IndexError):
            continue
        if minx <= x <= maxx and miny <= y <= maxy:
            writer.writerow([row[0], row[1], row[2]])
            kept += 1
print(f"  scanned {total:,} UPRNs -> kept {kept:,}")
PY

say "Loading UPRNs into geo.uprn_stage"
ogr2ogr -f PostgreSQL "PG:${PROPX_PG_URL}" "$UPRN_CSV" \
  -nln geo.uprn_stage -overwrite \
  -lco FID=stage_id \
  --config PG_USE_COPY YES

say "Upserting into geo.os_open_uprn"
# geom is generated from easting/northing, so only the three source columns move.
ogrinfo "PG:${PROPX_PG_URL}" -sql "
  insert into geo.os_open_uprn (uprn, easting, northing, ingested_at)
  select s.uprn::bigint, s.easting::double precision, s.northing::double precision, now()
    from geo.uprn_stage s
   where s.uprn ~ '^[0-9]+\$'
  on conflict (uprn) do update
     set easting     = excluded.easting,
         northing    = excluded.northing,
         ingested_at = excluded.ingested_at;
  drop table if exists geo.uprn_stage;
" >/dev/null

# ── 3. Report ───────────────────────────────────────────────────────────────
say "Done — current contents of the polygon store"
ogrinfo "PG:${PROPX_PG_URL}" -q -sql "
  select local_authority,
         count(*)                                              as parcels,
         round(avg(area_sq_metres)::numeric, 1)                as avg_m2,
         count(*) filter (where area_sq_metres > 10000)        as over_1ha,
         count(*) filter (where area_sq_metres < 20)           as slivers_under_20m2,
         max(ingested_at)                                      as ingested_at
    from geo.inspire_polygons
   group by local_authority
   order by local_authority;
"
ogrinfo "PG:${PROPX_PG_URL}" -q -sql "select count(*) as uprn_rows from geo.os_open_uprn;"

cat <<'NEXT'

Next: sanity-check one property end to end, e.g.

  select * from public.resolve_property_boundary('<a UPRN in this council>');

It should return a POLYGON with area_sq_metres between 20 and 10000. Anything
over 1 ha or under 20 m2 is expected to fall back to a box in the client — see
src/services/inspireBoundary.service.ts.
NEXT
