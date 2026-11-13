#!/usr/bin/env bash
# Downloads the routing data into this folder (PLAN 10.1). Run from infra/otp/ in Git Bash or any Unix shell:
#   ./get-data.sh
# Results (git-ignored): stpt-gtfs.zip (~2 MB) and timisoara.osm.pbf (~10 MB).
set -euo pipefail
cd "$(dirname "$0")"

# STPT/SMTT timetable (GTFS), official feed listed in the Mobility Database as mdb-2868.
GTFS_URL="https://smtt.ro/transit/gtfs/maps/smtt-timisoara-ro.zip"
# Mirror kept by the Mobility Database, used if the official URL fails.
GTFS_MIRROR="https://files.mobilitydatabase.org/mdb-2868/latest.zip"
# Whole-country street map; we cut Timișoara out of it and delete it.
ROMANIA_URL="https://download.geofabrik.de/europe/romania-latest.osm.pbf"
# Area of the GTFS feed (city + metropolitan lines): minLon,minLat,maxLon,maxLat.
BBOX="20.85,45.46,21.43,45.98"

# 1. Timetable.
echo "Downloading STPT GTFS..."
curl -fL --retry 2 -o stpt-gtfs.zip "$GTFS_URL" || curl -fL --retry 2 -o stpt-gtfs.zip "$GTFS_MIRROR"

# 2. Street map: download Romania, crop to the bounding box with osmium.
echo "Downloading Romania OSM extract (about 300 MB, deleted afterwards)..."
curl -fL --retry 2 -o romania-latest.osm.pbf "$ROMANIA_URL"

echo "Cutting the Timișoara area..."
if command -v osmium >/dev/null 2>&1; then
  osmium extract --bbox "$BBOX" --overwrite -o timisoara.osm.pbf romania-latest.osm.pbf
else
  # No local osmium: run it inside the official Debian image (osmium-tool is a Debian package).
  MSYS_NO_PATHCONV=1 docker run --rm -v "$(pwd -W 2>/dev/null || pwd)":/data -w /data debian:bookworm-slim \
    sh -c "apt-get update -qq && apt-get install -y -qq osmium-tool >/dev/null && \
           osmium extract --bbox $BBOX --overwrite -o timisoara.osm.pbf romania-latest.osm.pbf"
fi
rm -f romania-latest.osm.pbf

ls -lh stpt-gtfs.zip timisoara.osm.pbf
echo "Done. Next: docker compose --profile build run --rm otp-build"
