# DOCS

Project documentation. One section per feature — edit only the section you own (see `PLAN.md`).

## Overview

Mobile app for Timișoara: events (imported and user-created) with QR check-in and reliability points, a filterable map of places, live public transport, directions, and an AI guide.

- **Plan and task list:** `PLAN.md`
- **Rules for contributors and agents:** `AGENTS.md`
- **API contract:** `docs/API.md` — every endpoint with request/response examples, error codes and conventions. Change it before the code.

## Architecture

```
Expo Go app ──(Supabase Auth: sign-in only)──> Supabase
     │
     └──(REST + Supabase JWT)──> Spring Boot API ──> Supabase Postgres
                                      ├──> live.stpt.ro      (live transit, cached)
                                      ├──> LiveTickets       (events import job)
                                      ├──> Nominatim         (venue name -> coordinates)
                                      ├──> OpenTripPlanner 2 (routing)
                                      └──> Gemini API        (chat with tools + web lookup)
```

The mobile app never calls third-party data sources directly; the backend proxies and caches them.

## Configuration and running

- **Backend keys:** copy `backend/src/main/resources/application-local.properties.example` to `application-local.properties` (git-ignored) and fill in:
  - `spring.datasource.url` — Supabase dashboard → Connect → "Session pooler" (port 5432), written as `jdbc:postgresql://<host>:5432/postgres`.
  - `spring.datasource.password` — the database password set when the project was created.
  - `supabase.jwt-secret` — Supabase dashboard → Project Settings → JWT Keys → "Legacy JWT Secret".
  - `gemini.api-key` — from Google AI Studio.
  - Already filled: Supabase URL, database user, Gemini model names, OpenTripPlanner URL.
- **Mobile keys:** set up with the Expo app (PLAN step 12.1).
- **Token validation:** the backend checks access tokens with the **legacy JWT secret (HS256)**, by team decision. On 2026-11-13 the project's signing key was rotated: **HS256 (Shared Secret) is the current key**, ECC (P-256) is the previous key (kept, not revoked). Do not rotate back to ECC — the backend would reject every login token with 401. Automated tests check HS256 tokens signed with a test secret; a real Supabase login token has not been tried yet (first chance: when the app's sign-in works, task 12.2).
- **API keys:** the mobile app uses the legacy `anon` key (public). The legacy `service_role` key is not needed: the backend talks to the database directly.
- **Never in mobile:** database password, JWT secret, Gemini key, `service_role` key.
- **No deployment:** the backend runs on a laptop and the app runs in Expo Go on phones on the same Wi-Fi.
- **No seed data:** accounts are created in the app; events come from the LiveTickets import and the create-event form.
- **Merging:** branches go into `main` only when Stefan says so.

### Running the backend (PLAN task 3.6)

1. Fill in `backend/src/main/resources/application-local.properties` (above). The app refuses to start without the database values, and `supabase.jwt-secret` must be at least 32 characters.
2. **IntelliJ:** Run → Edit Configurations → `BackendApplication`:
   - Ultimate ("Spring Boot" type): **Active profiles** = `local`.
   - Community ("Application" type): Modify options → Environment variables → `SPRING_PROFILES_ACTIVE=local`.
   The console should print `The following 1 profile is active: "local"`.
3. **Terminal** (from `backend/`): `./gradlew bootRun --args='--spring.profiles.active=local'`
4. The API listens on **port 8080 on all network interfaces**. From a phone on the same Wi-Fi use `http://<laptop Wi-Fi IPv4>:8080` (find it with `ipconfig`, Wi-Fi adapter). If the phone cannot connect, allow Java through the Windows Firewall for private networks.
5. **Quick check:** `GET http://<ip>:8080/test` without a token must answer `401` with `{"code":"UNAUTHORIZED",...}` — that proves the server is reachable and security is on. (There is no health endpoint: nothing is deployed.)
6. **Timetable file (in git, nothing to do):** the "last tram/bus" answers read `infra/otp/stpt-gtfs.zip` (1.8 MB, SMTT feed version 4.31 downloaded 2026-11-13). It is committed (an exception to the `infra/otp/*.zip` ignore rule), so every checkout has it. The log shows `GTFS timetable loaded …` on the first `/transit/last-departures` request. If the file is ever missing the backend still starts: it logs `GTFS timetable not found …` and falls back to live estimates (`source: LIVE_ESTIMATE`).
   **Refresh it** when SMTT publishes a new timetable, and at the latest after it expires on 2026-12-31: from the repo root in Git Bash run `curl -fL -o infra/otp/stpt-gtfs.zip https://smtt.ro/transit/gtfs/maps/smtt-timisoara-ro.zip` (mirror: `https://files.mobilitydatabase.org/mdb-2868/latest.zip`), or `infra/otp/get-data.sh`, then commit the new file. The street map and routing graph stay out of git (see `infra/otp/README.md`).

**Tests:** `./gradlew test` from `backend/`. They use an in-memory H2 database and a fake Supabase secret (`src/test/resources/application.properties`), so they never need the real database or your local keys.

## Backend foundation (PLAN task 3)

Shared code every feature uses. Feature packages (`users`, `events`, …) are created by each member with the layout from PLAN 3.2.

| Package | Class | Use it for |
|---|---|---|
| `config` | `SecurityConfig` | Public vs. protected routes and token checks. Public: `GET /events`, `GET /events/{id}`, `GET /places`, `GET /places/{id}`, `GET /transit/**`, `GET /users/username-available`. Everything else needs `Authorization: Bearer <token>`. **Add a new public route here.** |
| `config` | `SupabaseProperties` | `supabase.url` and `supabase.jwt-secret` from `application-local.properties`. |
| `config` | `TimeConfig` | A shared `Clock` bean — inject it instead of calling `Instant.now()` so tests can fix the time. |
| `common.security` | `CurrentUser` | `currentUser.id()` = caller's UUID (= `profiles.id`), 401 if not signed in. `optionalId()` on public endpoints. |
| `common.exception` | `ApiException`, `ErrorCode` | `throw new ApiException(ErrorCode.EVENT_FULL)` (or with a custom message) → standard error JSON with the right status. `ApiException.notFound("Event")` for 404. |
| `common.exception` | `GlobalExceptionHandler` | Turns validation errors, bad JSON, wrong parameter types, unknown paths and unexpected errors into the standard error JSON. Unexpected errors are logged and answer `500 INTERNAL_ERROR` without details. |
| `common.dto` | `PageParams`, `PageResponse` | `PageParams.of(page, size)` (max 100) or `PageParams.forMap(...)` (max 500) → `.toPageable(sort)`; return `PageResponse.of(page, mapper)`. |

- **Token checks:** HS256 signature with the legacy secret, not expired, issuer `https://<project>.supabase.co/auth/v1`, audience `authenticated`. The user id is the token's `sub`.
- **Sessions:** none (stateless); CSRF off (no cookies); CORS open for development.
- **Database:** Hibernate only validates the schema (`ddl-auto=validate`); change tables with a Supabase migration, never from Java. Pool limited to 5 connections (Supabase free plan).
- **Tests:** `support/JwtTestTokens` signs Supabase-style test tokens; `support/TestProbeController` (test-only) exercises security and errors. 30 tests, all passing on 2026-11-13.

## Supabase MCP (PLAN task 1.2)

- The Supabase MCP server is configured in `.mcp.json` at the repo root (committed, no secrets inside). It is scoped to our project only (`project_ref=mjurmmhilnolicncywsw`).
- **Each teammate authenticates once:** in a regular terminal, from the repo root, run `claude /mcp`, choose "Use this MCP server", select `supabase`, then "Authenticate" and log in to Supabase in the browser that opens.
- **Use it from Claude Code in a terminal** (`claude` in the repo root). The Claude desktop app did not load this project's `.mcp.json` server in our test on 2026-11-13; the terminal CLI did, and listed the (still empty) tables.
- Every migration applied through MCP is also saved as a `.sql` file in `supabase/migrations/`.

## Database (PLAN task 2)

Applied to Supabase on 2026-11-13 from `supabase/migrations/` (four migrations, in file order).

| Table | Purpose |
|---|---|
| `profiles` | One row per user (`id` = `auth.users.id`): `username`, `reliability_score` (starts at 100, never below 0). |
| `events` | `source` = `USER` (needs `organizer_id`) or `EXTERNAL` (needs `external_id`, e.g. `livetickets:<id>`, unique). Optional `capacity` (null = unlimited), coordinates both set or both null. |
| `event_participants` | Who joined which event (one row per pair), `status` (`JOINED`, `ATTENDED`, `NO_SHOW`, `CANCELLED`, `BANNED`), auto-generated `qr_token`. `checked_in_at` is set only for `ATTENDED`. |
| `reliability_log` | Every score change: `points_change` (e.g. +5, −10) and `reason`. Kept when its event is deleted. |
| `places` | Places imported from OpenStreetMap; `osm_id` (e.g. `node/2845091337`) is unique so re-imports update rows. |

- **Every `id` is a UUID.**
- **Sign-up creates the profile automatically** (trigger `on_auth_user_created`). The username comes from sign-up metadata `{ "username": "..." }`. If it is missing, invalid or already taken, a generated `user_xxxxxxxx` is used so sign-up never fails; the app should check availability first and the user can rename later.
- **Usernames:** 3–20 letters, digits or underscores; unique ignoring case.
- **Row Level Security** is on for every table with no policies, so the public Supabase keys cannot read or write app data. The Spring API connects with the database password, which bypasses RLS.
- **Search:** trigram indexes on `profiles.username` and `events.title` (extension `pg_trgm` in schema `extensions`).
- **No seed data.**

**Tests:** `supabase/tests/schema_checks.sql` (21 checks: sign-up trigger, username rules, event source rules, double join, check-in rule, cascades, RLS). Run it with the Supabase MCP `execute_sql`; it always rolls back and ends with the error `SCHEMA CHECKS PASSED (21 checks)` or `SCHEMA CHECK FAILED: …`. Last run 2026-11-13: passed.

**Advisors (2026-11-13):** security — only "RLS enabled, no policy" (INFO, intended); performance — only "unused index" (INFO, expected on empty tables).

## Current state

- `backend/`: Spring Boot 4.1.2 (Java 21, Gradle) with the task-3 foundation (token security, error handling, current user, paging), users/profile endpoints (task 4), places (task 8, 1003 Timișoara places imported into Supabase), live transit (task 9, `/transit/**`) and routing (task 10, `/routes/plan`), and the LiveTickets events import (task 7, 38 events). 242 backend tests passing.
- `supabase/`: migrations and schema tests for task 2, applied.
- `docs/API.md`: API contract (task 1.6).
- `infra/otp/`: OpenTripPlanner 2.7 setup (docker-compose, data download script). Its large data files are git-ignored. `GET /routes/plan` is implemented (task 10).
- `frontend/`: Expo app (SDK 54) set up by the frontend teammates — see `frontend/AGENTS.md`. Each teammate works on their own `<name>_dev` branch.
- Supabase project: created, MCP connected, email sign-in on with "Confirm email" off, database schema applied (no data).

## External data sources

Checked on 2026-11-13 by calling each endpoint. None of these is a documented public API — they are what the sites' own pages call. Always go through the backend, cache, and keep request volume low.

### STPT live transit — `https://live.stpt.ro`

| Endpoint | Returns |
|---|---|
| `/gtfs-vehicles.php?route=<line>` | Live vehicles of a line: `id`, `lat`, `lng`, `bearing`, `speed`, `route`, `directionId`, `headsign`, next `stop`, `timestamp`, `tripId` |
| `/gtfs-data/stops-index.json` | All stops: `stop_code`, `stop_name`, `lat`, `lon`, `routes[]` |
| `/gtfs-data/route-manifest.json` | Route list plus GTFS feed info (source file `smtt-timisoara-ro.zip`, feed version, service date range) |
| `/routes/capeti-linie.json` | End stations of each line (`tur` / `retur`) |
| `/proxy-smtt-cache.php?stopid=<id>` | Arrivals at a stop: array of `route`, `type`, `destination`, `vehicleId` (null = timetable), `times` (`"HH:mm|minutes"`, local time) |
| `/proxy-alerts.php` | Service alerts: `id`, `headerText`, `descriptionText` |
| `/api/journey.php?…` | The site's own journey planner (seen in the script; parameters not explored) |

The GTFS zip itself is not on `live.stpt.ro`, but SMTT publishes it at `https://smtt.ro/transit/gtfs/maps/smtt-timisoara-ro.zip` (Mobility Database `mdb-2868`), see Features → Routing.

### LiveTickets events — `https://api.livetickets.ro`

| Endpoint | Returns |
|---|---|
| `/public/event-search?spc.pageNumber=1&spc.numberOfRecords=1000` | **Used by the import.** `{"events": {"items": [...], "totalItems", "hasMorePages"}}`; every upcoming event in Romania (333 on 2026-11-13, 38 in Timișoara). Item fields: `event_id`, `url`, `name`, `description` (HTML), `location` (venue name), `city`, `start_date` / `end_date` (Romanian local time, no zone), `price_min`, `price_max`, `image`, `image_token`, `organizer_name`. |
| `/public/events-home-v2?a=1` | Only the ~20 featured events of the home page (all cities). |
| `/public/events/getbyid?id=<id>` | One event (seen in the site's script). |

- **No coordinates and no category** in the data — venues are geocoded (Features → Events import) and the category is guessed from words in the title.
- **Links:** ticket page `https://www.livetickets.ro/bilete/<url>`, image `https://livetickets-cdn.azureedge.net/itemimages/<image>?<image_token>` (both checked 2026-11-13).

### OpenStreetMap

- **Places:** Overpass API, imported into the `places` table (PLAN task 8, see Features → Places). Counted for the Timișoara area on 2026-11-13: 239 restaurants, 121 cafés, 89 bars/pubs, 134 fast-food places, 123 pharmacies. Only 82 of the 239 restaurants have opening hours. Freshness of the 583 food and drink places: 125 last edited in 2026, 296 since January 2025, 401 since January 2023; 182 untouched since before 2023, so some of those may have closed or changed.
- **Geocoding:** Nominatim, max 1 request/second, only for newly imported events; the coordinates are saved on the event row.
- **Streets for routing:** `.osm.pbf` extract of Timișoara for OpenTripPlanner 2 (PLAN task 10).
- OSM has no prices, menus or reviews — the AI looks those up on the web (Gemini, below).

### Gemini API (AI assistant)

Checked against Google's documentation on 2026-11-13.

- **Chat:** a free-tier Gemini model with function calling; it calls our own tools (places, events, transit, routes) — PLAN task 11.2.
- **Web lookup:** a separate Gemini request with Google Search switched on, used for prices, menus and reviews — PLAN task 11.3. Kept separate because only the Gemini 3 and 4 models can mix Google Search with our own tools in one request.
- **Free-tier limit on web search:** free only on `gemini-2.5-flash` / `gemini-2.5-flash-lite` (500 requests per day); both are redirected to newer models on 1 December 2026. On the newer free models it is listed as not available; on a paid account 5,000 searches per month are free. The hackathon ends on 15 November 2026, before that date, so the web lookup uses `gemini-2.5-flash` for free. The price page was long and only partly read — test one web lookup early to confirm.
- **Why not Google Maps data directly:** Google's terms forbid scraping or bulk-downloading its places and saving their names, addresses and reviews, and its Places API has no menu or dish-price data.

## Reliability rules (PLAN task 1.7, agreed 2026-11-13)

| Event | Points | Log `reason` |
|---|---|---|
| Starting score | 100 | — |
| Checked in by the organiser (QR scan) | +5 | `ATTENDED` |
| Still `JOINED` when the event ends (no-show) | −10 | `NO_SHOW` |
| Leaves less than 2 hours before the start | −2 | `LATE_CANCEL` |
| Leaves earlier | 0 | — (no log entry) |

- The score never goes below 0: a change that would go lower stops at 0 (the log still records the full rule value).
- Being banned by an organiser costs no points by itself.
- Only `USER` events count; imported events cannot be joined.
- An event with no end time is treated as ending 3 hours after it starts (for no-shows and check-in).

## Features

### Users and profiles (PLAN 4)

Package `com.unihack8.backend.users` (`controller`, `service` + `impl`, `repository` + `impl`, `mapper` + `impl`, `domain/entity`, `domain/dto`). Request and answer shapes are in `docs/API.md` → Users.

- `GET /users/username-available?username=` — **public**. `{ "username", "available" }`; `400 INVALID_USERNAME` for a bad format. Case-insensitive.
- `GET /users/me`, `GET /users/{id}` — profile: id, username, reliability score, creation time and `attendedEvents`. Only `ATTENDED` rows count; newest first, at most 20, each in the `EventSummary` shape (missing category shows as `OTHER`; `spotsLeft` counts `JOINED` + `ATTENDED` and is `null` without a capacity). `404 NOT_FOUND` for an unknown id.
- `PATCH /users/me` — `{ "username" }`, 3–20 letters, digits or `_`. `400 INVALID_USERNAME` for a bad or missing name; `409 USERNAME_TAKEN` when someone else has it, ignoring case — also when two requests race (the database unique index answers).
- `GET /users/search?q=` — username prefix, case-insensitive, `_` and `%` taken literally, **sorted by username**, at most 20. A blank or missing `q` is `400 VALIDATION_FAILED`.
- All of these except `username-available` need a token. Errors use the shared shape (`ApiException` + `ErrorCode`); the users package has no exception classes of its own.
- Profiles are read through JPA (`Profile` → `profiles`). Attended events come from one plain SQL query over `events` and `event_participants` (`AttendedEventRepositoryImpl`), so this package needs no entities for tables the events feature will own. `GET /users/me/events` (PLAN 5.8) and `GET /users/{id}/reliability` (PLAN 6.4) are not built yet.
- **Tests** (`src/test/.../users`): `UserServiceImplTest` (Mockito rules), `UserControllerTest` (MockMvc with real HS256 test tokens), `ProfileRepositoryTest` and `AttendedEventRepositoryImplTest` (H2). No test touches Supabase.

Sections are added here as each PLAN task is implemented: Events, Reliability, Transit, Routing, AI, Frontend.

### Events import (PLAN task 7)

Upcoming Timișoara events from LiveTickets, stored in the `events` table as `source = EXTERNAL` with title, plain-text description, category, venue, start/end time (UTC), prices, image and ticket-page link, and coordinates when the venue can be located. They are read through the events endpoints of task 5 (built separately).

- **Run it** (from `backend/`, with `application-local.properties` filled in): `./gradlew bootRun --args='--spring.profiles.active=local --events.import.enabled=true'`, or in IntelliJ add `--events.import.enabled=true` to the program arguments for one run. Takes about 30 seconds; the API then keeps running normally. Run it once to fill the database and **once more on demo morning**. Both imports at once: `--places.import.enabled=true --events.import.enabled=true`.
- **Not scheduled** (team decision): the hackathon ends before a weekly job would first run, and a GitHub workflow would need the database password as a secret.
- **Own package `eventimport`**, writing rows with plain SQL (`ExternalEventRepository`), so it never touches the events feature's code (task 5, built in parallel).
- **Re-runnable:** rows are matched by `external_id = "livetickets:<event_id>"`, so a re-run updates instead of duplicating. Upcoming imported events LiveTickets no longer lists are deleted (past ones and user events are never touched). If LiveTickets fails or returns nothing for the city, nothing is deleted.
- **Mapping** (`LiveTicketsEventMapperImpl`): only `city` = Timișoara (ignoring case and diacritics); times converted from Romanian local time to UTC; HTML description to plain text (max 4000 characters); an end time not after the start is dropped; category guessed from the **title first**, then the description: THEATRE, CONCERT, SPORT, GAMES, PARTY, FOOD, ART, MEETUP keyword lists in that order, else OTHER.
- **Locating venues** (`VenueGeocoderImpl`), in this order: exact name match in our `places` table (ignoring case, diacritics, punctuation and a leading/trailing "Timișoara"); the curated **`backend/src/main/resources/eventimport/venues.txt`** (venue → street address or exact `lat,lon`); OpenStreetMap Nominatim by name; Nominatim by the text in brackets. Nominatim is asked at most once per second and results must lie in `events.import.bbox` (default `45.65,21.10,45.85,21.40`, Timișoara incl. the airport). Venues that are just "Timișoara" are not located. Events without coordinates appear in lists but not on the map.
- **Add a venue the map misses:** add a line to `venues.txt` (`Venue name | address` or `Venue name | lat, lon`) and re-run the import — only events still without coordinates are geocoded again.
- **First import (2026-11-13):** 38 Timișoara events, **32 with coordinates**. Not located: Hibana (2 events, address not found), "#altfel Timisoara" (a promoter, not a place), 3 events whose venue is just "Timișoara".
- **Tests:** 52 (`LiveTicketsClientImplTest`, `LiveTicketsEventMapperImplTest`, `EventImportServiceImplTest` on its own H2 database, `VenueGeocoderImplTest` with a fake Nominatim, `EventImportRunnerTest`), using a real LiveTickets response saved in `src/test/resources/livetickets/event-search-sample.json`. Tests never call LiveTickets or Nominatim.

### Places (PLAN task 8)

Restaurants, cafés, bars, parks… from OpenStreetMap, stored in the `places` table and served by `GET /places` and `GET /places/{id}` (public; shapes in `docs/API.md` → Places).

**Categories** (`places/domain/PlaceCategory`) and the OpenStreetMap tags that select them:

| API name | OpenStreetMap tags |
|---|---|
| `restaurant` | `amenity=restaurant` |
| `cafe` | `amenity=cafe` |
| `bar` | `amenity=bar`, `pub`, `biergarten` |
| `fast_food` | `amenity=fast_food` |
| `club` | `amenity=nightclub` |
| `pharmacy` | `amenity=pharmacy` |
| `atm` | `amenity=atm` |
| `supermarket` | `shop=supermarket` |
| `park` | `leisure=park` |
| `attraction` | `tourism=museum`, `attraction`, `gallery`, `zoo`, `viewpoint` |

Checked in that order (amenity first), so a church tagged `amenity=place_of_worship` + `tourism=attraction` is an attraction.

**Import** (`places/service/PlaceImportService`, `places/client/OverpassClient`):
- **Run it** (from `backend/`, with your `application-local.properties` filled in): `./gradlew bootRun --args='--spring.profiles.active=local --places.import.enabled=true'`. It runs once at startup, then the API keeps running normally. Takes 1–4 minutes. In IntelliJ: add `--places.import.enabled=true` to the run configuration's program arguments for that one run.
- **One query** to the Overpass API (OpenStreetMap's public search service) for the Timișoara area (`places.import.bbox`, default `45.69,21.14,45.81,21.31`). Servers in `places.import.overpass-url` are tried in order; default: `overpass-api.de`, then the `overpass.kumi.systems` mirror (the main server often answers "at capacity").
- **Rules:** places without a name are skipped, except ATMs ("UniCredit ATM", or "ATM"); ways and areas use their centre point; address = street + number; all OSM tags are stored in `tags` (jsonb).
- **Re-runnable:** rows are matched by `osm_id`, so a second run updates instead of duplicating, and places deleted from OpenStreetMap are removed. If Overpass fails or returns nothing, the table is left untouched.
- **First import (2026-11-13):** 1158 fetched, **1003 stored**, 155 skipped (mostly unnamed parks).

**Search** (`places/service/PlaceService`): category, viewport (`bbox`) and name (`q`, case-insensitive) filters run in the database; `near` + `radius` narrows to a box in the database, then measures exact distances in Java and sorts closest first. Shared helpers for every map feature: `common/geo/GeoPoint` (parse `near`, haversine distance) and `common/geo/BoundingBox` (parse `bbox`).

**Detail tags:** only a whitelist of useful tags is sent to the app (`places/mapper/impl/PlaceMapperImpl.PUBLIC_TAGS`); the rest stays in the database for the AI.

**Tests:** 43 tests across `PlaceControllerTest`, `GeoTest`, `PlaceCategoryTest`, `OverpassClientImplTest` (local fake HTTP server, incl. busy-server fallback), `OsmElementMapperImplTest` and `PlaceImportServiceImplTest`, `PlaceImportRunnerTest` (real Overpass response saved in `src/test/resources/overpass/timisoara-sample.json`). Tests never call the real Overpass API.

### Transit — live STPT data (PLAN task 9, Track B)

Public endpoints (no token) under `/transit`, contract in `docs/API.md` → Transit. The backend calls `live.stpt.ro`; the app never does.

| Endpoint | Source on live.stpt.ro | Cached for |
|---|---|---|
| `GET /transit/routes` | `/gtfs-data/route-manifest.json` | 24 h |
| `GET /transit/stops?bbox=` | `/gtfs-data/stops-index.json` | 24 h |
| `GET /transit/vehicles?route=` | `/gtfs-vehicles.php?route=` | 10 s |
| `GET /transit/stops/{id}/arrivals` | `/proxy-smtt-cache.php?stopid=` | 20 s |
| `GET /transit/alerts` | `/proxy-alerts.php` | 5 min |
| `GET /transit/last-departures?stopId=` | computed from arrivals | — |
| `GET /transit/summary?near=lat,lon` | nearest stop + its last departures + alert count | — |

**Package `com.unihack8.backend.transit`:** `client/StptClient` (+ `impl/`) makes the raw calls and reads STPT's JSON leniently; `mapper/TransitMapper` (+ `impl/`) converts to the API shapes; `service/TransitService` (+ `impl/`) caches and computes; `controller/TransitController`; `repository/TimetableRepository` (+ `impl/GtfsTimetableRepository`) reads the GTFS timetable; `config/StptProperties` and `StptClientConfig` (HTTP client). No database table: live data plus the timetable file.

**Shared helpers in `common`:**
- `common.cache.StaleCache` (added by transit; reuse it for routing/OTP) — per-key cache: fresh for its lifetime; if the source then fails, the last value is served with `stale: true`; if nothing was ever cached, `503 SOURCE_UNAVAILABLE`. One request per key reaches the source at a time.
- Transit uses the places feature's `common.geo.GeoPoint` (`near`, `distanceMetersTo`) and `common.geo.BoundingBox` (`bbox`).

**Settings** (all optional, defaults in `StptProperties`): `stpt.base-url`, `stpt.connect-timeout` (3 s), `stpt.read-timeout` (5 s), `stpt.user-agent`, `stpt.ttl.vehicles|arrivals|alerts|static-data`, `stpt.gtfs-path` (default `../infra/otp/stpt-gtfs.zip`, i.e. the file task 10's `infra/otp/get-data.sh` downloads; if missing, `infra/otp/stpt-gtfs.zip` from the repo root is tried).

**How STPT data is read (checked 2026-11-13):**
- Arrival times come as `"HH:mm|minutes"` in Romanian local time; we turn them into UTC, picking the date nearest to now (so `00:05` seen at 23:50 is tomorrow). Repeated times are dropped.
- An arrival item has one `vehicleId` for all its times; we mark only its **first** time `live: true` (the vehicle being tracked), the rest are timetable times.
- Line type comes from STPT's category (tram, trolleybus, express, metropolitan, vaporetto), otherwise from the GTFS `route_type`; school (`S…`) and urban lines are `BUS`.
- `from` / `to` come from the GTFS long name (`"Gara de Nord - Piața Gh. Domășneanu (AEM)"`). The older `/routes/capeti-linie.json` is not used: it still lists pre-diversion end stations.
- **Last departures (9.6):** read from the **GTFS timetable** (`source: TIMETABLE`): for each line and direction, the latest scheduled departure from the stop on today's service day. Weekday/Saturday/Sunday services and holiday exceptions (`calendar.txt`, `calendar_dates.txt`) are applied; a trip's final stop is skipped (arriving at the terminus is not a departure); times after midnight (e.g. `24:30`) stay on the same service day, and **before 03:00** the previous day's timetable still applies. The file is loaded once, on first use (about 0.6 s, 890 stops, 13,335 trips). If the file is missing or does not cover today (the 2026-11-13 download ends 2026-12-31), the answer falls back to `LIVE_ESTIMATE` (latest of the next few live arrivals). Checked 2026-11-13 against the real file: last tram 2 from Dâmbovița leaves 23:46 on weekdays.
- **Summary sentence:** names the line that stops first **among those still running** ("Last trolleybus 16 from Piața Huniade leaves at 23:18"); once all have gone: "No more departures from … tonight." (Romanian: "Nu mai sunt plecări din … în seara asta.").

**Tests (62 for transit):** `GtfsTimetableRepositoryTest` (small GTFS zip built in the test: services, holiday exceptions, terminus skipped, after-midnight times, missing file, quoted CSV); `StptClientImplTest` parses real STPT answers saved in `src/test/resources/stpt/` (no network); `TransitMapperImplTest` (types, time zones, midnight, duplicates); `TransitServiceImplTest` (sorting, bbox, caching, stale fallback when STPT is down, 503 with no cache, 404 stop, last departures from timetable and live fallback, service day before 03:00, summary in English and Romanian); `TransitControllerTest` (JSON shapes, no token needed, 400/404/503); `StaleCacheTest`. A one-off run against the real STPT on 2026-11-13 returned 74 lines, 926 stops, live vehicles, arrivals and 5 alerts.

### Routing (PLAN task 10, Track B)

`GET /routes/plan?from=lat,lon&to=lat,lon&mode=WALK|TRANSIT[&departAt=ISO time]`, which needs a token. The shape is in `docs/API.md`. The backend asks our own OpenTripPlanner 2.7 server and returns one route.

- **Data (10.1):** the STPT/SMTT GTFS feed is public: `https://smtt.ro/transit/gtfs/maps/smtt-timisoara-ro.zip`, listed in the Mobility Database as `mdb-2868` (this answers PLAN open question 2). The streets come from Geofabrik's Romania extract, cut to the GTFS area. `infra/otp/get-data.sh` downloads both.
- **OTP server (10.2):** see `infra/otp/README.md`. It takes three commands (get data, build graph, serve) and serves on port **8081**. The Spring setting is `otp.base-url` (default `http://localhost:8081`); timeouts are `otp.connect-timeout` (2 s) and `otp.read-timeout` (10 s). Built 2026-11-13: 890 stops, 181 route patterns, graph built in 15 s.
- **Picking the route:** OTP returns up to 3 itineraries, and the backend keeps the one that **arrives first** (the shorter trip on a tie). OTP's own order can put a slower direct walk first: in a real test, a 20-min walk was listed before trolleybus 18, which takes 11 min.
- **`mode` in the answer** says what the route really uses: `TRANSIT` if any leg rides a vehicle, otherwise `WALK`.
- **Fallbacks (10.4):**

  | Request | Situation | Answer |
  |---|---|---|
  | `WALK` | OTP down, or no route (e.g. a point outside the map) | Straight-line distance × 1.25 at 4.8 km/h, one leg, `fallback: true` |
  | `TRANSIT` | OTP down | `503 SOURCE_UNAVAILABLE`; the app should offer walking |
  | `TRANSIT` | no trip found (night, or timetable expired) | OTP's walking route (`mode: "WALK"`), or the straight-line estimate if that fails too |

- **Leg modes:** `WALK`, `TRAM`, `TROLLEYBUS`, `BUS`. Any other vehicle is shown as `BUS`. Times are converted from OTP's local offset to UTC. Durations are rounded to minutes, at least 1 for a non-empty trip.
- **Gotcha:** OTP answers `400` to chunked request bodies, so the client serializes the GraphQL body to bytes itself, which gives the request a `Content-Length`.
- **Timetable expiry:** the 2026-11-13 GTFS covers 2026-11-05 to 2026-12-31. Re-run `get-data.sh` and rebuild the graph after that date.
- **Code:** package `routing`: `controller/RoutingController`, `service/impl/RoutingServiceImpl` (fallback rules), `client/impl/OtpGraphQlClient` (GraphQL `planConnection`), `mapper/impl/RoutePlanMapperImpl`, `config/OtpProperties` + `OtpClientConfig`, `util/PolylineEncoder`. Coordinates use the shared `common.geo.GeoPoint` (from the places feature).
- **Tests (10.5):** 28 tests across `PolylineEncoderTest`, `OtpGraphQlClientTest` (mock server), `RoutePlanMapperImplTest`, `RoutingServiceImplTest` and `RoutingControllerTest`. The fixture `src/test/resources/otp/plan-transit.json` is a **real OTP answer** recorded from our server: Piața Victoriei → Gara de Nord, 2026-11-16 at 10:00. With places and transit (incl. the GTFS timetable) merged in, the backend has 162 tests, all passing on 2026-11-13. On the same day the real client was also checked by hand against the running OTP: bus 33, walk, night and outside-the-map cases.

## Knowledge graph

One graph for the whole repo, made with the **Understand-Anything** plugin (rule from AGENTS.md: keep it updated with every change).

- **Files:** `.ua/knowledge-graph.json` (the graph), `.ua/meta.json` and `.ua/fingerprints.json` (let the next run update only changed files), `.ua/.understandignore` (what is left out: secrets such as `application-local.properties` and `.env`, build output, `.claude/`). Scratch folders under `.ua/` are git-ignored.
- **Current version (2026-11-13, after merging main: users task 4, places task 8, transit task 9, routing task 10):** 176 files, 456 nodes, 1080 edges, 14 layers (Project Documentation, API Contract, Backend App, Security & Config, Backend Shared Web Layer, Places Feature, Backend Transit Feature, Backend Routing Feature, Users Feature, Backend Tests, Backend Build & Config, Database Schema, Infrastructure & Tooling, Frontend App, Frontend Config), 24-step guided tour.
- **Left out on purpose** (`.ua/.understandignore`): secrets, build output, `.claude/`, and frontend noise (`package-lock.json`, `assets/`, `LICENSE`, `.npmrc`).
- **Update it** after each change: run `/understand` (Claude Code) or the same command in Codex; it only reanalyzes changed files. `/understand-dashboard` opens the interactive view.
- **Codex:** the plugin's README lists Codex as supported (install it with the plugin's install script for `codex`); not tested by us yet.
