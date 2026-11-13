# OpenTripPlanner 2

Routing server for walking and public transport directions (PLAN task 10).

It runs as its own server, separate from the Spring backend, on port **8081**.
Only the Spring backend calls it; the mobile app never does.

Files that will live here (task 10):

- `docker-compose.yml` — builds the routing graph once, then serves it.
- `timisoara.osm.pbf` — street map extract of Timișoara (OpenStreetMap).
- `stpt-gtfs.zip` — STPT timetable (GTFS), if a download is found (PLAN open question 2).

The `.osm.pbf`, `.zip` and generated graph files are large and git-ignored: do not commit them.
