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
- **Mobile keys:** copy `frontend/.env.example` to `frontend/.env` (git-ignored) and fill in the Supabase URL, the Supabase key (legacy `anon` or publishable) and the backend address — see "Frontend" below. Public values only.
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

Applied to Supabase from `supabase/migrations/` in file order: the four schema migrations on 2026-11-13, the three `place_prices` migrations (table + data, PLAN 11.3) on 2026-11-14.

| Table | Purpose |
|---|---|
| `profiles` | One row per user (`id` = `auth.users.id`): `username`, `reliability_score` (starts at 100, never below 0). |
| `events` | `source` = `USER` (needs `organizer_id`) or `EXTERNAL` (needs `external_id`, e.g. `livetickets:<id>`, unique). Optional `capacity` (null = unlimited), coordinates both set or both null. |
| `event_participants` | Who joined which event (one row per pair), `status` (`JOINED`, `ATTENDED`, `NO_SHOW`, `CANCELLED`, `BANNED`), auto-generated `qr_token`. `checked_in_at` is set only for `ATTENDED`. |
| `reliability_log` | Every score change: `points_change` (e.g. +5, −10) and `reason`. Kept when its event is deleted. |
| `places` | Places imported from OpenStreetMap; `osm_id` (e.g. `node/2845091337`) is unique so re-imports update rows. |
| `place_prices` | Researched menu prices for the AI (PLAN 11.3): `place_name` (matches `places.name` or the OSM `brand` tag, case-insensitive), `item`, `item_type` (`COFFEE`, `PIZZA`, `FOOD`, `BEER`, `DRINK`), `price_lei`, `size`, `source_type`, `source_url`, `source_date`, `note`. See Features → AI assistant. |

- **Every `id` is a UUID.**
- **Sign-up creates the profile automatically** (trigger `on_auth_user_created`). The username comes from sign-up metadata `{ "username": "..." }`. If it is missing, invalid or already taken, a generated `user_xxxxxxxx` is used so sign-up never fails; the app should check availability first and the user can rename later.
- **Usernames:** 3–20 letters, digits or underscores; unique ignoring case.
- **Row Level Security** is on for every table with no policies, so the public Supabase keys cannot read or write app data. The Spring API connects with the database password, which bypasses RLS.
- **Search:** trigram indexes on `profiles.username` and `events.title` (extension `pg_trgm` in schema `extensions`).
- **No seed data.**

**Tests:** `supabase/tests/schema_checks.sql` (21 checks: sign-up trigger, username rules, event source rules, double join, check-in rule, cascades, RLS). Run it with the Supabase MCP `execute_sql`; it always rolls back and ends with the error `SCHEMA CHECKS PASSED (21 checks)` or `SCHEMA CHECK FAILED: …`. Last run 2026-11-13: passed.

**Advisors (2026-11-13):** security — only "RLS enabled, no policy" (INFO, intended); performance — only "unused index" (INFO, expected on empty tables).

## Current state

- `backend/`: Spring Boot 4.1.2 (Java 21, Gradle) with the task-3 foundation (token security, error handling, current user, paging), users/profile endpoints (task 4), events and participation (task 5), QR check-in, no-show job and reliability history (task 6), LiveTickets events import (task 7, 38 events), places (task 8, 1003 Timișoara places imported into Supabase), live transit (task 9, `/transit/**`) and routing (task 10, `/routes/plan`) and the AI assistant (task 11, `POST /ai/chat`, Gemini + our own tools + 232 stored menu prices). The combined backend has 352 passing tests (2026-11-14, after task 18); the frontend 275 (plus 7 live-backend tests skipped by default).
- `supabase/`: migrations and schema tests for task 2, applied.
- `docs/API.md`: API contract (task 1.6).
- `infra/otp/`: OpenTripPlanner 2.7 setup (docker-compose, data download script). Its large data files are git-ignored. `GET /routes/plan` is implemented (task 10).
- `frontend/`: Expo app (SDK 54, TypeScript, Expo Router) — foundation (task 12) and Home page (task 13) done on mock data; the Map tab has places, events, clustering, the transit layer and directions (task 14) and the AI tab has the chat on mock data (task 15). See Features → Frontend and `frontend/AGENTS.md`. Each teammate works on their own `<name>_dev` branch.
- Supabase project: created, MCP connected, email sign-in on with "Confirm email" off, database schema applied. The places import stored 1003 places; there are no seeded users or events.

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
- OSM has no prices, menus or reviews — prices come from our researched `place_prices` table (Features → AI assistant); reviews are not available.

### Gemini API (AI assistant)

Checked by calling the API with our key on 2026-11-13 (this replaces the earlier plan based on Google's docs).

- **Chat:** free-tier Gemini with function calling; it calls our own tools (places, events, transit, routes) — PLAN task 11.2. Models tried in order (`gemini.chat-models`): `gemini-3.5-flash-lite` (answers in about 1 s per round), then `gemini-3.5-flash` (works but took 20–40 s). `gemini-3.7-flash` / `3.8-flash` / `flash-latest` answered 503 "high demand" when tested.
- **`gemini-2.5-flash` and `2.5-flash-lite` are gone for our key** (404 "no longer available to new users").
- **No web search on the free tier:** Google Search grounding answers 429 on every model the key can use. So the web lookup of PLAN 11.3 was replaced by a **stored price list** (team decision 2026-11-13, see Features → AI assistant). It would work on a paid key; not built.
- **Free-tier per-minute quota:** a burst of questions can get 429 with a `retryDelay`; the backend waits it out once (max 12 s) before trying the next model.
- **Gemini 3 function calling** returns a `thoughtSignature` with each call and an `id`; both are sent back unchanged (the backend echoes the model's whole turn).
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

### QR check-in and reliability (PLAN 6)

Package `reliability`, built on the events feature (task 5): it reuses `EventRepository` (event lookup and row lock) and `ParticipationRepository.changeReliability(...)`, the single place that applies a score change, floors it at 0 and writes `reliability_log`. It does not change any events-feature file.

| Endpoint | Who | What |
|---|---|---|
| `GET /events/{id}/my-ticket` | the participant | Their `qrToken` (the QR code contains only this string) and status. |
| `POST /events/{id}/check-in` `{ "token" }` | the event's organiser | Scanned ticket → `ATTENDED`, `checked_in_at` set, **+5**. |
| `GET /users/{id}/reliability` | any signed-in user | Score and the 20 newest changes, with event titles. |

- **Check-in rules** (`CheckInServiceImpl`): user events only; organiser only; until the event's end (start + 3 h when it has none); the token must belong to this event; banned or departed participants are refused. The event row is locked and the status change is conditional on `JOINED`, so a ticket scanned twice gets points once.
- **No-show job** (`NoShowJob` → `NoShowServiceImpl`): runs every 5 minutes while the backend is running (first run 1 minute after start). Participants still `JOINED` after the event is over become `NO_SHOW` with **−10**; each in its own short transaction, conditional on `JOINED`, so repeating the job or a late scan never double-penalises. Imported events are ignored. Settings: `reliability.no-show-job.enabled` (default `true`, `false` in tests), `.interval` (default `PT5M`), `.initial-delay` (default `PT1M`).
- **SQL** (`CheckInRepositoryImpl`, JdbcTemplate like the events feature): checked on 2026-11-13 against the real Supabase database (read queries run, updates via `EXPLAIN` only, no data changed).
- **End-to-end on the real database (2026-11-13):** with 3 temporary test users and their events (deleted afterwards), through the real API with real-format tokens: create event, join, ticket, organiser scan +5, double scan refused, garbage QR refused, scan after the end refused, no-show job −10 once (job run repeatedly and after a restart), history with titles, profiles and user search — all passed. This found and fixed a PostgreSQL-only bug in `users/.../AttendedEventRepositoryImpl` (task 4): `spots_left` was a bigint read as Integer, so `GET /users/me` and `GET /users/{id}` answered 500 once a user had attended an event with limited spots; H2 in the tests hides this.
- **Tests:** 15 — `ReliabilityIntegrationTest` (real endpoints and tokens on the H2 test database: ticket, check-in happy path, double scan, wrong event, unknown/garbage token, not organiser, imported/finished event, banned/left participant, no end time; no-show job, repeat run, 3-hour rule, score floor; history order and deleted events) and `NoShowJobTest`.


### Users and profiles (PLAN 4)

Package `com.unihack8.backend.users` (`controller`, `service` + `impl`, `repository` + `impl`, `mapper` + `impl`, `domain/entity`, `domain/dto`). Request and answer shapes are in `docs/API.md` → Users.

- `GET /users/username-available?username=` — **public**. `{ "username", "available" }`; `400 INVALID_USERNAME` for a bad format. Case-insensitive.
- `GET /users/me`, `GET /users/{id}` — profile: id, username, reliability score, creation time and `attendedEvents`. Only `ATTENDED` rows count; newest first, at most 20, each in the `EventSummary` shape (missing category shows as `OTHER`; `spotsLeft` counts `JOINED` + `ATTENDED` and is `null` without a capacity). `404 NOT_FOUND` for an unknown id.
- `PATCH /users/me` — `{ "username" }`, 3–20 letters, digits or `_`. `400 INVALID_USERNAME` for a bad or missing name; `409 USERNAME_TAKEN` when someone else has it, ignoring case — also when two requests race (the database unique index answers).
- `GET /users/search?q=` — username prefix, case-insensitive, `_` and `%` taken literally, **sorted by username**, at most 20. A blank or missing `q` is `400 VALIDATION_FAILED`.
- All of these except `username-available` need a token. Errors use the shared shape (`ApiException` + `ErrorCode`); the users package has no exception classes of its own.
- Profiles are read through JPA (`Profile` → `profiles`). Attended events come from one plain SQL query over `events` and `event_participants` (`AttendedEventRepositoryImpl`), so this package needs no entities for tables the events feature owns. `GET /users/me/events` is implemented by the events package (PLAN 5.8); `GET /users/{id}/reliability` (PLAN 6.4) is served by the reliability package (task 6).
- **Tests** (`src/test/.../users`): `UserServiceImplTest` (Mockito rules), `UserControllerTest` (MockMvc with real HS256 test tokens), `ProfileRepositoryTest` and `AttendedEventRepositoryImplTest` (H2). No test touches Supabase.

Sections are added here as each PLAN task is implemented: Reliability, Transit, Routing, AI, Frontend.

### Events and participation (PLAN task 5)

Package `com.unihack8.backend.events`: `controller`, `domain/entity`, `domain/dto`, `repository` + `impl`, `mapper` + `impl`, and `service` + `impl`. Request and response shapes are in `docs/API.md` → Events.

- Public `GET /events` filters by title, one or more categories, start-time range, viewport and source. It defaults to upcoming events, pages by start time, excludes events without coordinates from viewport results, and counts occupied spots for a page in one query. `GET /events/{id}` adds spots left, participant count, organizer summary, and caller status when signed in; cancelled rows appear as no current participation, while a banned caller sees `BANNED`. Imported events show no app capacity or organizer.
- Authenticated users create events with `POST /events`; the mobile form requires the venue name to match this rule. Only the organizer can `PATCH` or `DELETE`; imported events are read-only. A patch can clear optional description, address, end time or capacity with `null`, but cannot reduce capacity below occupied spots. Deleting an event cascades its participation without a reliability penalty.
- `POST /events/{id}/join` locks the event row before counting `JOINED` and `ATTENDED` spots. This serializes simultaneous last-spot joins. Duplicate joins and organizer self-joins fail; cancelled users can rejoin using the same QR token, while banned users cannot.
- `DELETE /events/{id}/join` cancels a `JOINED` entry. Leaving within two hours of the start applies `-2` to reliability and writes `LATE_CANCEL`; the score floors at zero. Earlier cancellations cost nothing. Imported events cannot be joined.
- Signed-in users can see non-cancelled participants and their reliability scores. The organizer can ban a `JOINED` participant, which frees a spot and has no reliability penalty. Checked-in participants cannot be banned.
- `GET /users/me/events` lists the caller's non-cancelled joined events with status and their organized events, both sorted by start time.
- **Tests:** service rule tests, MockMvc HTTP/security tests with signed HS256 tokens, and H2 database integration tests including two concurrent joins for one spot, patching capacity to unlimited, and the reliability score floor. No test contacts Supabase.

### Events import (PLAN task 7)

Upcoming Timișoara events from LiveTickets, stored in the `events` table as `source = EXTERNAL` with title, plain-text description, category, venue, start/end time (UTC), prices, image and ticket-page link, and coordinates when the venue can be located. They are read through the events endpoints of task 5.

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

### AI assistant (PLAN task 11, Track B)

`POST /ai/chat` (needs a token; shape in `docs/API.md` → AI assistant). Answers questions like "where can I drink cheap coffee near me and how much will it cost", "where can I go out this weekend", "last tram near me" from **our own data only**: the model calls tools, and every venue, price, time and line it names comes from a tool result.

**How a request runs** (`ai/service/impl/AiChatServiceImpl`):
1. Rate limit: 10 requests per user per minute (`InMemoryChatRateLimiter`, in memory) → `429 RATE_LIMITED`.
2. The app's conversation (last 20 messages; leading assistant messages dropped; last must be the user's) + a system prompt (`SystemPrompt`: Romanian local time, user location or "city centre", rules) go to Gemini with the tool declarations.
3. While the model asks for tools, they run **in parallel** (virtual threads, 15 s each) and the results go back; tool errors go back as `{"error": ...}` so the model can recover. After `ai.max-tool-rounds` (5) rounds, tools are switched off (`mode: NONE`) so it must answer.
4. `ChatResultMapperImpl` builds the answer: the prompt asks for **bold** names; bold names are matched to what the tools returned → `places[]` / `events[]` cards in reply order (whole-word matching if the model used no bold). Bold markers are removed from `reply`. `sources[]` = the price pages of the mentioned places.
5. Gemini errors: busy/quota (429/5xx/timeout) → next model (a 429 with a short `retryDelay` is waited out once first); anything else or all models down → `503 AI_UNAVAILABLE`.

**Tools** (`ai/tool/impl`, every `AiTool` bean is offered to the model):

| Tool | Uses | Gives the model |
|---|---|---|
| `search_places` | `PlaceService.explore` (task 8 + prices) | Places in a radius (default 1500 m) by category and keyword (name, cuisine, brand), with distance + walking minutes, opening hours, **`open_now` / `closes_at`** (closed places left out by default), cuisine, and stored prices of one `price_item_type`; `sort = price` puts the cheapest first. Chain branches are merged (nearest kept). |
| `search_events` | `EventService.search` (task 5) | Upcoming events in a local-time window, optional radius, with price range, free spots, distance. |
| `transit_info` | `TransitService` (task 9) | Nearest stops (or by name, accent-insensitive), each line labelled TRAM / TROLLEYBUS / BUS, next arrivals, today's last departures, alerts. `vehicle_type = TRAM` answers "last tram". |
| `plan_route` | `RoutingService` (task 10) | Walking or transit route: minutes, distance, leave/arrive time, steps. TRANSIT falls back to walking when OTP is down. Every route it plans is remembered for the answer's `routes[]` (task 18). |

**Opening hours** (`places/domain/OpeningHours`): reads the usual OSM forms (`Mo-Fr 08:00-22:00; Sa,Su 10:00-22:00`, `24:00`, after-midnight ranges, `off`, `24/7`); anything else (holidays, months, sunset) is "unknown", never a wrong yes/no. Added after a live test at 23:44 recommended two cafés that had closed hours earlier.

**Stored prices** (table `place_prices`, migrations `20261114000001`–`03`): 232 prices for 79 places (cafés, pizza, fast food, restaurants, a few bars), researched on 2026-11-13 by reading each source page (mostly Glovo/Bolt Food Timișoara store pages, a few official menus; never estimated). Matching is by place name or OSM `brand`, so a chain price covers every branch. Rules kept in the data:
- `source_type = delivery_app` prices are often a bit higher than in the shop; the AI says prices are approximate.
- Regular prices are stored; promo prices are only in `note`.
- A `note` starting with `OTHER CITY:` (Ted's Coffee, three Tucano cafés) is a chain price read on another city's listing; `search_places` adds a `caution` and the AI repeats it.
- Left out on purpose: Glovo stores whose name might be a different venue (Antalya, Sultan Shawarma, Nuova Mama Mia). Plain-dough "pizza" breads are `FOOD`, not `PIZZA`, so they never win "cheapest pizza".
- **Coverage is partial**: most of the 560 food/drink places have no menu online that could be read; places without a price are shown as "price unknown". To add prices, insert rows (with a `source_url`) — no code change.

**Settings** (`application-local.properties`; all optional except the key): `gemini.api-key`, `gemini.chat-models` (default `gemini-3.5-flash-lite,gemini-3.5-flash`), `gemini.read-timeout` (40 s), `ai.max-tool-rounds` (5), `ai.requests-per-minute` (10), `ai.max-messages` (20), `ai.tool-timeout-seconds` (15), `ai.max-retry-wait` (12 s). The old `gemini.chat-model` / `gemini.lookup-model` keys are no longer read.

**Code:** package `ai`: `controller/AiController`, `service/AiChatService` + `impl/AiChatServiceImpl`, `service/ChatRateLimiter` + `impl/InMemoryChatRateLimiter`, `service/impl/SystemPrompt`, `mapper/ChatResultMapper` + `impl/ChatResultMapperImpl`, `client/GeminiClient` + `impl/GeminiRestClient`, `tool/AiTool` + `impl/*Tool`, `tool/ToolArgs` (lenient argument reading, local times), `domain/ToolContext`, `domain/gemini/*` (wire types), `config/GeminiProperties`, `AiProperties`, `GeminiClientConfig`. In `places`: `PlaceService.explore`, `PlacePrice` + `PlacePriceRepository`, `PriceItemType`, `OpeningHours`. Shared: `common/text/TextMatch` (accent-insensitive matching).

**Tests (PLAN 11.6, 48 new):** `AiChatServiceImplTest` (fake Gemini: tool loop with id + thought signature echoed, empty results, tool errors, forced last round, empty answer, model fallback, 429 wait, provider error, conversation rules), `GeminiRestClientTest` (local fake server: headers/body, parsing, 429 `retryDelay`, 503/404, missing key), `AiControllerTest` (401, JSON shape, optional location, 400s, 429/503), tool tests (`SearchPlacesToolTest`, `TransitInfoToolTest`, `PlanRouteAndEventsToolTest`), `ChatResultMapperImplTest`, `InMemoryChatRateLimiterTest`, `PlaceExploreTest` (H2), `OpeningHoursTest`, `TextMatchTest`. No test calls Gemini.

**Checked live on 2026-11-13/14** (real Gemini, real Supabase data, around midnight on a Friday), 20+ questions in English and Romanian: cheap coffee / pizza / beer / burger with prices and sources, "how much is a Margherita at Cora", "tomorrow at 9" (noticed 5 to go opens at 10:00 on Saturday), weekend events and "concerts tonight" (none, offered parties), last tram near me / from Gara de Nord (real lines 1, 8, 9 and 2, 4, 7), Starbucks + route from Gara de Nord, follow-up "how do I get there on foot?", no location, off-topic request (politely refused). Typical answer time 2–4 s; 7–10 s for transit questions (live STPT calls).

**Known limits:** `gemini-3.5-flash-lite` sometimes lists a near café before a cheaper far one; Romanian grammar is occasionally a bit off; the free-tier per-minute quota can make a burst of questions slow or answer 503 "busy".

### AI navigation — "Go" button (PLAN task 18, Tracks B + C)

When the AI gives directions that start **where the user is**, its answer has a route card with a **Go** button that starts a journey on the Map tab (like Google Maps / Waze). A route from somewhere else ("from the university to a coffee shop") gets the card without **Go** — only **Show route on map**.

**Backend** (`ai` package):
- `plan_route` records each route it plans in `ToolContext` (`rememberRoute`, record `PlannedRoute`: ends, the mode the route really uses, minutes, metres, `startsFromUser`).
- **`startsFromUser`** (`ToolContext.startsFromUser`): `true` only when the request carried the real `location` and the model gave no start point or one within **50 m** (`USER_START_RADIUS_METERS`) of the user. `false` for any other start, and always `false` without `location` (the city-centre default is not the user).
- `ChatResultMapperImpl.routes` turns them into `routes[]` (`ChatRouteDto`, `RoutePointDto`): the user end is named "Your location", other ends take the name of the closest place/event the tools returned within 75 m (else `null`); the same ends + mode planned twice count once (last plan wins). Shape in `docs/API.md` → AI assistant.
- System prompt rule 4: leave `from_lat/from_lon` out when the route starts at the user; set them only for a route from somewhere else.

**Mobile:**
- **Route card (18.4)** — `features/ai/RouteCards.tsx`, under the place/event cards: destination, Walking / Walk + public transport, minutes and distance ("from X" when it starts elsewhere). **Go** only when `startsFromUser`; **Show route on map** always. Go first checks location permission (`ensureLocationPermission`) and shows "Allow location access to start the journey." when it is refused — no journey without it (18.7).
- **Opening the map** — `features/journey/navigation.ts`: `routeParams()` puts the route in the Map tab's params (`route=go|preview`, `fromLat/fromLon/fromName`, `toLat/toLon/toName`, `mode`, `at`), `parseRouteParams()` reads them back. A **preview** opens the normal directions panel; for a route that starts elsewhere the destination has an `origin` (new optional field of `Destination` in `MapContext`, the context's fields are unchanged), so the panel says "From X", plans from there and the map shows a teal start pin.
- **Journey mode (18.5)** — `features/journey/useJourney.ts`, `JourneyPanel.tsx` (`JourneyLayer` + `JourneyPanel`), wired in `app/(tabs)/map.tsx`. Asks for permission, takes a first GPS fix, then follows the phone with `expo-location` `watchPositionAsync` (foreground only, works in Expo Go). The route is **always planned fresh from the live position** with `GET /routes/plan` in the AI's mode, so a user who moved since the answer simply gets a route from where they are (more than 200 m away, the panel says so — 18.7). The map draws the route (done legs grey), the camera follows the user, and the panel shows the current step ("Walk to stop X", "Take tram 1 towards Y, get off at Z", "Walk to <destination>"), the next one, the minutes and metres left and **End**. While it runs it replaces the normal bottom panel. Network errors show the usual error + **Try again**.
- **During the journey (18.6)** — `features/journey/progress.ts` (pure functions): the current step is the nearest leg from the current one on (never back), and the next step starts within 25 m of a step's end. More than **50 m** from the route → re-plan from the current position (at most once per 10 s; the old line stays until the new one arrives). Within **30 m** of the destination → "You have arrived" and **Done**. Legs without a polyline use a straight line between their ends.

**Tests:** backend `ToolContextTest` (user start / start 30 m away / other start / no location), `PlanRouteAndEventsToolTest` (routes remembered from the user, from another place, without location), `ChatResultMapperImplTest` (names, "Your location", duplicates, empty list), `AiChatServiceImplTest` (`routes[]` in the chat answer, empty when no route), `AiControllerTest` (JSON shape). Mobile `ai.routes.test.tsx` (Go shown / hidden, Go opens journey mode, preview, permission refused, params round-trip) and `map.journey.test.tsx` (progress maths, first step from the live GPS, step advance at the stop, off-route re-plan, arrival, End, moved since the answer, permission, error + retry, preview from another place), with mocked positions through `globalThis.__moveTo()` in `jest.setup.ts`.

**Not verified yet:** not tried on a phone (GPS accuracy, camera following, battery) and not against real Gemini — whether the model leaves out the start point for "how do I get there" is only asked for by the prompt.

### Integration: real data only (PLAN task 17)

**17.1 No mock data in the app (2026-11-14).**
- `src/api/client.ts` always calls the Spring API. The `EXPO_PUBLIC_USE_MOCKS` switch, `src/config.ts` → `MOCK_AREAS` / `USE_MOCKS` and `lib/mockAreas.ts` are gone. Without `EXPO_PUBLIC_API_URL`, every call fails with `NOT_CONFIGURED` ("The app has no backend address…") and never falls back to fake data.
- The mock backend moved from `frontend/src/mocks/` to `frontend/testing/mocks/` (alias `@test/*`). It is only for Jest: `jest.setup.ts` routes `api()` to it. Tests of the real client opt out with `jest.unmock('@/api/client')` (`api.client.test.ts`, `api.users.real.test.ts`, `api.config.test.ts`).
- **Checked in the Android bundle** (`npx expo export --platform android`): none of the mock strings (`mockRequest`, `demo_user`, `placesSeed`, `mock-ticket`, `USE_MOCKS`) appear, while the app's own strings do.

**Contract check:** every one of the app's 30 API calls was compared with the backend records, and 20 were also called live. No field names, paths or paging shapes differed. The real backend behaved differently from the mocks in a few places, fixed as follows:

| Issue | Fix |
|---|---|
| `/ai/chat` rejects messages over 2000 characters, so one long reply in the history broke the rest of the chat | The input has `maxLength` 2000, and history messages are cut to 2000 before sending (`MAX_CHAT_MESSAGE_CHARS`). |
| `/routes/plan` legs can have `null` `polyline`, `from`/`to` or times when OpenTripPlanner leaves them out | The types say so; `decodePolyline(null)` returns `[]` and the directions panel shows fallback text instead of crashing. |
| `/transit/summary` answers in Romanian when the phone sends `Accept-Language: ro` (iOS does) | The client sends `Accept-Language: en`. |
| Filtering events by `OTHER` missed imported events with no category (shown as OTHER) | Backend: `OTHER` also matches `category IS NULL` (`EventRepositoryImpl`, new test in `EventDatabaseIntegrationTest`). |
| Postgres times can have microseconds (`…:00.123456Z`) | `lib/time.ts` → `parseIso()` cuts the fraction to milliseconds; used wherever API times are parsed. |

Known differences that need no change: the mocks let you join an event in progress (the backend says `EVENT_ENDED` from the start time) and ban anyone (the backend refuses checked-in participants). Mock ticket codes are not UUIDs. The backend's own validation errors for event creation have no per-field `fields` (the app validates first).

**Live test:** `frontend/__tests__/live.backend.test.ts` runs the app's own endpoint functions and real client against a running backend. It is skipped normally. Run it with `LIVE_API_URL=http://localhost:8080 LIVE_TOKEN=<access token> npx jest live.backend`; without `LIVE_TOKEN` only the public endpoints run. It checks places, events (incl. the OTHER filter), transit (English summary), username check, walk + transit routes (polylines decode, times format), user search and a real AI answer. **Run on 2026-11-14 against the real backend + Supabase: 7/7 passed.**

**17.4 Offline and slow network:** `lib/network.ts` connects NetInfo (`@react-native-community/netinfo` 11.4.1, included in Expo Go) to TanStack Query's `onlineManager`. While offline, queries pause and keep their cached data, and they refetch by themselves when the connection is back. `ui/OfflineBanner.tsx` shows "You're offline — showing saved data…" above every screen. Slow answers time out after 15 s with "The server took too long to answer. Try again." Every data screen already had loading, error with **Try again**, and empty states (checked screen by screen).

**Still to do by people (17.2, 17.3, 17.6):** run the demo on two real phones, create the accounts in the app, record the backup video. The steps and the 3-minute script are in `docs/DEMO.md`.

### Frontend (PLAN tasks 12 and 13)

Expo SDK 54 app in `frontend/`, TypeScript (strict), Expo Router, runs in **Expo Go** (no custom native code). Look and feel follow the dark-neon design reference (`dark-neon-mobile-app-design-prompt.md`, design only — no features come from it).

**Run it**
1. `cd frontend && npm install` (the `.npmrc` sets `legacy-peer-deps`).
2. Copy `.env.example` to `.env` and fill it in:

| Variable | Meaning |
|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | `https://<project-ref>.supabase.co` (sign-in only) |
| `EXPO_PUBLIC_SUPABASE_KEY` | Legacy `anon` or publishable key. Never the `service_role` key. Without it the sign-in screens show a setup warning. |
| `EXPO_PUBLIC_API_URL` | `http://<laptop Wi-Fi IPv4>:8080` — the Spring API. **Required**: the app has no mock mode (PLAN 17.1); without it every call fails with "The app has no backend address". |

3. `npx expo start`, scan the QR code with Expo Go (phone and laptop on the same Wi-Fi). Restart Expo after changing `.env`.
4. Checks: `npm test` (Jest), `npm run typecheck`, `npm run lint`.

**Layout** (`frontend/src/`)

| Folder | Content |
|---|---|
| `app/` | Routes only. `(auth)/sign-in`, `(auth)/sign-up`; `(tabs)/` Home, Map, AI, Profile; `events/` (list, `new`, `[id]`, `[id]/ticket`, `[id]/scan`); `users/` (`search`, `[id]`). |
| `api/` | `client.ts` (the single request function), `endpoints.ts` (typed calls), `types.ts` (shapes from `docs/API.md`), `errors.ts` (`ApiError`, friendly messages). |
| `hooks/` | `queries.ts` — one TanStack Query hook per endpoint, plus cache keys. |
| `../testing/mocks/` | **Test-only** in-memory fake backend (same shapes and error codes as `docs/API.md`). Moved out of `src/` in PLAN 17.1, so it is never bundled into the app; Jest routes `api()` to it in `jest.setup.ts`. |
| `features/` | `auth`, `location`, `events`, `transit`, `users` — feature components and logic. |
| `ui/` | Design tokens (`theme.ts`), text, buttons, chips, cards, inputs, loading/empty/error states, default avatar, glow background. |
| `lib/` | Supabase client, query client, time (Romanian time), geo, validation. |

**How it works**
- **Auth (12.2):** `features/auth/AuthProvider` wraps the Supabase client. The session is stored on the device (AsyncStorage) and refreshed while the app is in the foreground. The root layout uses `Stack.Protected`, so signed-out users can only reach the `(auth)` screens; on sign-out the query cache is cleared. Sign-up first calls `GET /users/username-available` (the database trigger would silently replace a taken username) and then sends the username as sign-up metadata. If the username cannot be checked (backend down) sign-up stops with a message instead of guessing.
- **API layer (12.3):** `api(method, path, {query, body})` adds `Authorization: Bearer <Supabase token>`, a 15 s timeout, and turns every failure into an `ApiError` (`NETWORK` and `TIMEOUT` are added for transport problems). Since PLAN 17.1 it **always** calls the Spring API (the `EXPO_PUBLIC_USE_MOCKS` switch and `lib/mockAreas.ts` were removed). It also sends `Accept-Language: en` so server-made sentences match the English UI.
- **Mock backend (tests only since PLAN 17.1):** stateful until the test resets it — join, leave, create, ban and check-in really change the data. The mock user is `demo_user` (independent of the Supabase account). Tickets you can scan as organiser of "Sunset run by the Bega": `demo-ticket-stella`, `demo-ticket-andrei`, `demo-ticket-maria` (type one in the manual field of the scanner, or turn it into a QR code). "Art walk through the old town" is already joined by the mock user, so "My ticket" works there.
- **Times:** shown in Europe/Bucharest using our own EET/EEST rules (`lib/time.ts`), not `Intl`, so every phone shows the same hour. The create form's date/time picker is built from day chips and hour/minute steppers for the same reason (no native date-picker module).
- **Location (12.5):** `LocationProvider` asks for foreground permission after sign-in; `useCurrentPosition()` returns the phone position, or Piața Victoriei (45.7537, 21.2257) with `isFallback: true` when permission is denied or the GPS fails.
- **Reliability gauge:** semicircle fills to 150 points (scores above are capped visually); the "How it works" text repeats the rules from "Reliability rules".

**Screens (PLAN 13)**

| Step | Screen | Notes |
|---|---|---|
| 13.1 | Home, city info strip | Calls `GET /transit/summary` (refreshed every minute) and `GET /transit/alerts`; the alert pill expands the list. |
| 13.2 | Home, upcoming events | Horizontal cards: date, place, spots left (user events) or price (imported). Category chips filter the row. |
| 13.3 | `/events` | Debounced search, multi-select category chips, date chips (today, tomorrow, weekend, next 7 days), endless scroll (pages of 10). |
| 13.4 | `/events/[id]` | Description, "Show on map" (opens the Map tab on the event), organiser, participants with scores (tap opens the profile), join / leave (late-leave warning). Imported events show "Get tickets" instead. |
| 13.5 | `/events/new` | Title, description, category, date/time, spots, venue, location picked by tapping a map. Validation mirrors the API rules. |
| 13.6 | `/events/[id]/ticket` | QR code that contains only the `qrToken`. |
| 13.7 | `/events/[id]/scan` | Camera QR scan → success / already scanned / wrong event / not a ticket. A manual code field is the fallback. Ban button in the participant list (organiser only, asks first). |
| 13.8 | `/users/search`, `/users/[id]` | Username prefix search → public profile (score gauge, attended events). |

Also built: Profile tab (username, gauge, find people, sign out) and the public profile (PLAN 16.4, 16.5). The Map and AI tabs are described in their own sections below.

**Tests:** 138 Jest tests (before the map and AI work, see below) in `frontend/__tests__/` (jest-expo + React Native Testing Library 13): every screen, the auth provider, location, API client (real HTTP path with a faked `fetch`), the mock backend, and the pure helpers. Native modules (maps, camera, location, Supabase, router) are mocked in `jest.setup.ts`. Last run 2026-11-13: all passing, `tsc` and `expo lint` clean, Android bundle builds with `expo export`.

**Not verified yet:** nothing was run on a phone in Expo Go (camera scan, map tap, real Supabase sign-in against the HS256 secret — see "Token validation" above). Do this first when the keys are in `.env`.

#### Map and AI (Person 1)

**Map tab (PLAN 14.1, 14.2, 14.3, 14.6)** — `src/app/(tabs)/map.tsx`, `src/features/map/`.
- **Shell and joints (14.1):** `MapProvider` / `useMapContext()` (`features/map/MapContext.tsx`) is the contract with the transit and directions work: `bbox` (visible area, debounced 300 ms and rounded to ~100 m so it works as a query key), `userPosition`, `selection` (one of `place`, `event`, `stop`, `destination`), `select()`, `destination` and `setDestination()`. `MapPanel` is the single bottom panel; it mounts `PlacePanel` and `EventPanel`, and also mounts `StopPanel` (14.4) and `DirectionsPanel` (14.5). `map.tsx` renders `<TransitLayer />` and `<DirectionsLayer />` inside the `MapView` and the transit controls below the filter row (see "Transit and directions" below).
- **Places (14.2):** chip row `MapFilterBar` (multi-select categories; none selected = all). `usePlacesInArea(bbox, categories)` calls `GET /places?bbox=&category=` for the visible area only (max 300) and keeps the old pins while panning. Places load only when the view is under ~6 km tall; further out the map says "Zoom in to see places". Tapping a pin opens `PlacePanel` (`GET /places/{id}`: address, raw OSM opening hours or "not listed", cuisine/phone/website/etc.) with a **Directions** button that calls `setDestination`.
- **Events (14.3):** "Events" chip toggles orange pins (`GET /events?bbox=`, events without coordinates are left out by the API). Tapping opens `EventPanel` (the standard event card, **Open event**, **Directions**).
- **Clustering and reloads (14.6):** `lib/cluster.ts` groups pins on a 6×6 grid of the visible area (own implementation, no package) while the view is more than ~1.3 km tall; clusters show their count and zoom in when tapped. Name pills appear under pins below ~1.6 km. Region changes only reload after the map has been still for 300 ms.
- **Opened from elsewhere:** `/map?lat=&lon=&title=` drops a plain violet pin; adding `placeId` or `eventId` opens that panel instead (event details and chat cards send these; `at` is a timestamp so the same request twice still flies there again). AI route cards send `route=go|preview` with the route's ends and mode instead (journey mode or route preview, PLAN 18 — see AI navigation).
- **Theme:** dark Google style on Android (`ui/mapStyle.ts`), `userInterfaceStyle="dark"` on iOS.

**AI tab (PLAN 15.1–15.4)** — `src/app/(tabs)/ai.tsx`, `src/features/ai/`, `src/hooks/useAi.ts`.
- *(Superseded by PLAN 17.1: the app now always calls the real `POST /ai/chat`; what follows describes the test-only mock.)* `/ai/*` in the tests is answered by `testing/mocks/routes/ai.ts` (keywords: *pizza/eat* → 3 restaurants sorted by distance with a source link, *coffee* → cafés, *weekend/event* → 3 upcoming events, *how do I get / directions* → a café with a route card (from the user, or from the university when the message says so), anything else → a generic reply; the words `ratelimit` and `unavailable` trigger the documented 429 / 503 errors). Run only this area on mocks with `EXPO_PUBLIC_USE_MOCKS=ai` once the backend answers the rest.
- **Conversation (15.1, 15.2):** `useAiChat(location)` keeps the messages in memory only, sends the whole conversation (newest 20) with `{lat, lon}` (or `null` when location permission was denied), shows a "Thinking…" bubble, and on failure an error bubble with **Try again** that repeats the same conversation. **New chat** clears everything; an answer that arrives after it is ignored.
- **Suggestions (15.3):** three chips above the input on an empty chat; tapping one sends it.
- **Result cards (15.4):** under an assistant bubble, one card per place (name, category, distance, address) and per event (standard event card), each with **Show on map** (opens the Map tab with the panel open); tapping an event card opens the event. Sources the assistant used are listed as links in the bubble.
- Layout follows design page 2: warm glow, breathing zone with an abstract cyan/orange motif (no logo), teal user bubbles on the right, charcoal assistant bubbles on the left, dark rounded input bar. On iOS the keyboard may push the input slightly higher than needed because of the tab bar (not checked on a device).

**Mock backend split (shared prep):** `src/mocks/core.ts` holds the state and helpers, each area has its routes in `src/mocks/routes/<area>.ts`, and new types / endpoints / hooks live in `api/types.<area>.ts`, `api/endpoints.<area>.ts` and `hooks/use<Area>.ts`. `EXPO_PUBLIC_USE_MOCKS` can be a list of areas (see the table above); `lib/mockAreas.ts` parses it. The `react-native-maps` Jest mock now also covers `Polyline`, `Circle` and `Callout`.

**Tests:** `map.shell`, `map.layers`, `lib.cluster`, `lib.mockAreas`, `lib.format` and `ai.chat` in `frontend/__tests__/`. The whole frontend suite: 190 tests, all passing, `tsc` and `expo lint` clean, Android bundle builds (2026-11-13). Not tried on a phone yet. After merging `frontend/tibi` and `alex_dev` into `stefan_dev`: 225 tests in 19 suites, all passing, `tsc` and `expo lint` clean.

#### Transit and directions on the map (PLAN 14.4, 14.5)

Built on `stefan_dev` after merging `frontend/tibi`, in the spots Tibi's map shell left for them. Uses the real backend since PLAN 17.1 (the mock data below is for the Jest tests only); the field names match the backend records (`TransitStopDto`, `VehiclesResponse`, `ArrivalsResponse`, `LastDeparturesResponse`, `RoutePlanResponse`).

| Step | What | Where |
|---|---|---|
| 14.4 | A **Transit** chip under the filter row turns the layer on. It shows teal stop dots for the visible area (`GET /transit/stops?bbox=`) when the view is under ~3 km tall; further out it says "Zoom in to see stops, or pick a line". A **Line N** chip per line (`GET /transit/routes`) shows that line's live vehicles (`GET /transit/vehicles?route=`, refreshed every 10 s, badge in the line's colour) and only the stops it serves; tap it again to clear. A line with no vehicles says "No vehicles on line N right now"; `stale: true` says "Live positions are delayed". Tapping a stop opens `StopPanel`: next arrivals soonest first (`GET /transit/stops/{id}/arrivals`, refreshed every 30 s, ● = live position) and **Last departures today** per line (`GET /transit/last-departures`, lines that already left are greyed out; a note when `source` is `LIVE_ESTIMATE`). | `features/transit/TransitControls.tsx`, `TransitLayer.tsx`, `StopPanel.tsx`, `hooks/useTransit.ts` |
| 14.5 | A destination comes from **long-press** on the map ("Dropped pin") or from the **Directions** button in a place or event panel. `DirectionsPanel` loads both `GET /routes/plan` modes at once and shows two tabs with their times: **Walk** and **Walk + transit** (default). Under the chosen tab: arrival time, distance, a note when the transit answer is really walking (`mode: WALK`) or a straight-line `fallback`, and the steps ("Walk to X · 4 min", "Tram 1 → Gara de Nord · from X at 18:08 · get off at Y · 12 min"). A `503` shows the error with **Try again** while the walking tab still works. `DirectionsLayer` draws the destination pin and the chosen route (walking legs teal and dashed, rides orange), reusing the panel's cached request. The chosen mode is kept in `features/directions/DirectionsContext.tsx` so the `MapContext` fields (the agreed contract) did not change; `MapProvider` wraps it, so every map child has it. | `features/directions/`, `hooks/useRouting.ts`, `lib/polyline.ts` |

- **Polylines:** `lib/polyline.ts` decodes (and, for the mocks, encodes) Google encoded polylines; checked against the format's published example.
- **Mock backend:** `src/mocks/transitSeed.ts` has 5 lines (trams 1, 2, 8, trolleybus 14, express E4) and 12 stops around the centre (approximate positions). Vehicles slide between a line's stops as time passes; **E4 is never running** (to show that state). Arrivals and last departures are generated per stop and line. `src/mocks/routes/routing.ts` plans in straight lines (walking 80 m/min on 1.3× the distance; transit = walk to the nearest stop, ride at 300 m/min after a 3 min wait, walk from the stop nearest the destination). Trips under 900 m, or where riding is not faster, answer the walking route with `mode: WALK`; a destination more than 50 km away makes `TRANSIT` answer `503 SOURCE_UNAVAILABLE`.
- **Tests:** `lib.polyline`, `map.transit` (mock endpoints, Transit chip, zoom hint, line vehicles and stop filter, "not running", stop panel) and `map.directions` (mock planner incl. errors, long-press directions with 3 legs and 3 drawn lines, switching to walking, walking-is-best note, 503 with retry, Directions from a place panel). Whole frontend suite after this (and after merging the real-HTTP profile test): 252 tests in 23 suites, all passing; `tsc` and `expo lint` clean; backend `./gradlew test` passing (2026-11-13).
- **Not verified yet:** not run on a phone (custom markers, dashed lines, long-press) and not against the real backend with mocks off. The map does not zoom to fit the route yet.

#### Frontend — profile, transit and directions (Track C, Person 2)

**My profile (PLAN 16.1–16.3)** — the Profile tab (`app/(tabs)/profile.tsx`) shows, top to bottom: username with a pencil button, the reliability gauge, **My events**, **Reliability history**, then Find people and Sign out. Each block loads on its own, so a failing block shows its own error with "Try again" and the rest of the page still works.

| Step | What | Where |
|---|---|---|
| 16.1 | "How it works" under the gauge lists the three rules (`+5` checked in, `−10` missed, `−2` left less than 2 h before) from `features/users/reliability.ts`. The history lists the latest changes (reason, event, date, points); tapping an entry opens the event. | `ReliabilityGauge.tsx`, `ReliabilityLog.tsx` |
| 16.2 | Pencil → inline form. The format (3–20 letters, digits, `_`) is checked while typing; the server's `USERNAME_TAKEN` / `INVALID_USERNAME` answers are shown under the field and cleared on the next keystroke. An unchanged name closes the form without a request. After a save the profile, participant lists, event details and search results are refreshed. | `UsernameEditor.tsx`, `PATCH /users/me` |
| 16.3 | Sections **Upcoming** (joined, not over), **Organising** (mine, not over) and **Attended** (newest first), each hidden when empty; missed events show only in the history. Refetched every time the tab opens. | `MyEvents.tsx`, `GET /users/me/events` |

- **Endpoints used:** `PATCH /users/me`, `GET /users/me/events` (backend 5.8, done), `GET /users/{id}/reliability` (backend 6.4, done). Checked after merging `alex_dev` into `stefan_dev`: the backend records (`MyEventsResponse`, `ReliabilityResponse`) have the same field names as `api/types.users.ts`, pinned by `ReliabilityIntegrationTest` / `EventControllerTest` on the backend and `mocks.users.test.ts` on the app. **Real data check (2026-11-13):** no screen imports `src/mocks`; everything goes through `api()`, so `EXPO_PUBLIC_USE_MOCKS=false` switches the profile to the Spring API. `__tests__/api.users.real.test.ts` pins the real HTTP calls (URL, method, bearer token, body) and parses backend-shaped JSON for all three endpoints plus `409 USERNAME_TAKEN`. The live Supabase project has the tables these read (`profiles`, `events`, `event_participants`, `reliability_log`). It currently has 2 profiles and 38 imported events but no participations, so My events and the history stay empty until someone joins or checks in. Not yet tried on a phone.
- **`frontend/.env.example`** was deleted by mistake in commit `25bc900` and restored in the merge; the setup steps and the "Supabase is not configured" message point to it.
- **New files** (per-feature, so they do not collide with other people's): `api/types.users.ts`, `api/endpoints.users.ts`, `hooks/useUsers.ts`.
- **Mock backend additions:** the three routes above, in `src/mocks/routes/users.ts` (moved there from the old single `mocks/index.ts` when `frontend/tibi` was merged; `logReliability` is in `mocks/core.ts`). Seed: `demo_user` attended "Autumn photo walk" and "Retro gaming evening" (+5 each) and missed "Open mic night" (−10), so the score stays 100. A check-in adds an `ATTENDED` line to the history and leaving less than 2 h before the start adds `LATE_CANCEL` (−2).
- **Tests:** `__tests__/screens.profile.test.tsx` (explanation, history incl. empty and error, username change: success, taken, invalid, unchanged, cancel; my events: groups, empty, error, refresh after join), `__tests__/mocks.users.test.ts` and `__tests__/api.users.real.test.ts` (real HTTP path).

## Knowledge graph

One graph for the whole repo, made with the **Understand-Anything** plugin (rule from AGENTS.md: keep it updated with every change).

- **Files:** `.ua/knowledge-graph.json` (the graph), `.ua/meta.json` and `.ua/fingerprints.json` (let the next run update only changed files), `.ua/.understandignore` (what is left out: secrets such as `application-local.properties` and `.env`, build output, `.claude/`). Scratch folders under `.ua/` are git-ignored.
- **Current version (2026-11-14, after task 18: AI navigation "Go" button and journey mode):** 454 files, 1353 nodes, 3360 edges, 20 layers, 33-step guided tour (new step 31 "AI Navigation and Journey Mode"). The moved mock files (`frontend/src/mocks` → `frontend/testing/mocks`, unchanged content) kept their nodes under the new paths, tagged `test-only`.
- **Left out on purpose** (`.ua/.understandignore`): secrets, build output, `.claude/`, and frontend noise (`package-lock.json`, `assets/`, `LICENSE`, `.npmrc`).
- **Update it** after each change: run `/understand` (Claude Code) or the same command in Codex; it only reanalyzes changed files. `/understand-dashboard` opens the interactive view.
- **Codex:** the plugin's README lists Codex as supported (install it with the plugin's install script for `codex`); not tested by us yet.
