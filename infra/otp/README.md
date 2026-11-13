# OpenTripPlanner 2

Routing server for walking and public transport directions (PLAN task 10).

It runs as its own server, separate from the Spring backend, on port **8081**.
Only the Spring backend calls it (`otp.base-url` in `application-local.properties`); the mobile app never does.

## Files

| File | In git | What it is |
|---|---|---|
| `docker-compose.yml` | yes | `otp-build` builds the graph once, `otp` serves it. Image `opentripplanner/opentripplanner:2.7.0`. |
| `get-data.sh` | yes | Downloads the two data files below. |
| `stpt-gtfs.zip` | no | STPT/SMTT timetable (GTFS, ~2 MB) from `https://smtt.ro/transit/gtfs/maps/smtt-timisoara-ro.zip` (listed in the Mobility Database as `mdb-2868`; the script falls back to its mirror). |
| `timisoara.osm.pbf` | no | Street map (~6 MB), cut from Geofabrik's Romania extract to the GTFS area `20.85,45.46,21.43,45.98`. |
| `graph.obj` | no | The routing graph OTP builds from the two files (~15 MB). |

## Run it (needs Docker Desktop running)

From this folder, in Git Bash:

```bash
./get-data.sh                                      # 1. download data (~300 MB download, 8 MB kept)
docker compose --profile build run --rm otp-build  # 2. build graph.obj (about 20 s)
docker compose up -d otp                           # 3. serve on http://localhost:8081
```

- Check: `http://localhost:8081/` opens OTP's debug map.
- Stop: `docker compose down`.
- **The GTFS timetable has an end date** (the 2026-11-13 download covers 2026-11-05 to 2026-12-31). After that, transit routes stop appearing: re-run steps 1 and 2.
- If `get-data.sh` finds no local `osmium`, it runs osmium in the official `debian:bookworm-slim` image.

## What the backend sends

`POST /otp/gtfs/v1` with a GraphQL `planConnection` query (`OtpGraphQlClient` in the `routing` package).
The body must be sent with a `Content-Length`: OTP answers `400` to chunked request bodies.
