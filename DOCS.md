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

- `backend/`: Spring Boot 4.1.2 (Java 21, Gradle) with the task-3 foundation (token security, error handling, current user, paging) and the live transit endpoints of task 9 (`/transit/**`).
- `supabase/`: migrations and schema tests for task 2, applied.
- `docs/API.md`: API contract (task 1.6).
- `infra/otp/`: folder for OpenTripPlanner (README only; the server is set up in task 10). Its large data files are git-ignored.
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

The GTFS zip itself was not found at an obvious URL on the site — see PLAN open question 2.

### LiveTickets events — `https://api.livetickets.ro`

| Endpoint | Returns |
|---|---|
| `/public/events-home-v2?a=1` | Array of events: `event_id`, `url`, `name`, `description` (HTML), `location` (venue name), `city`, `start_date`, `end_date`, `price_min`, `price_max`, `image` |
| `/public/events` | Event search (seen in the site's script; query parameters not explored) |
| `/public/events/getbyid?id=<id>` | One event (seen in the site's script) |

Events carry a venue name and city but **no coordinates** — they are geocoded with Nominatim (PLAN task 7.3).

### OpenStreetMap

- **Places:** Overpass API, imported once into the `places` table (PLAN task 8). Counted for the Timișoara area on 2026-11-13: 239 restaurants, 121 cafés, 89 bars/pubs, 134 fast-food places, 123 pharmacies. Only 82 of the 239 restaurants have opening hours. Freshness of the 583 food and drink places: 125 last edited in 2026, 296 since January 2025, 401 since January 2023; 182 untouched since before 2023, so some of those may have closed or changed.
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

Sections are added here as each PLAN task is implemented: Users, Events, Reliability, Places, Transit, Routing, AI, Frontend.

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

**Package `com.unihack8.backend.transit`:** `client/StptClient` (+ `impl/`) makes the raw calls and reads STPT's JSON leniently; `mapper/TransitMapper` (+ `impl/`) converts to the API shapes; `service/TransitService` (+ `impl/`) caches and computes; `controller/TransitController`; `config/StptProperties` and `StptClientConfig` (HTTP client). No database table — everything is live.

**Shared helpers added to `common` (reuse them in places/routing):**
- `common.cache.StaleCache` — per-key cache: fresh for its lifetime; if the source then fails, the last value is served with `stale: true`; if nothing was ever cached, `503 SOURCE_UNAVAILABLE`. One request per key reaches the source at a time.
- `common.geo.GeoPoint` (`near=lat,lon` parsing, haversine distance) and `common.geo.BoundingBox` (`bbox=` parsing) — bad values answer `400 VALIDATION_FAILED`.

**Settings** (all optional, defaults in `StptProperties`): `stpt.base-url`, `stpt.connect-timeout` (3 s), `stpt.read-timeout` (5 s), `stpt.user-agent`, `stpt.ttl.vehicles|arrivals|alerts|static-data`.

**How STPT data is read (checked 2026-11-13):**
- Arrival times come as `"HH:mm|minutes"` in Romanian local time; we turn them into UTC, picking the date nearest to now (so `00:05` seen at 23:50 is tomorrow). Repeated times are dropped.
- An arrival item has one `vehicleId` for all its times; we mark only its **first** time `live: true` (the vehicle being tracked), the rest are timetable times.
- Line type comes from STPT's category (tram, trolleybus, express, metropolitan, vaporetto), otherwise from the GTFS `route_type`; school (`S…`) and urban lines are `BUS`.
- `from` / `to` come from the GTFS long name (`"Gara de Nord - Piața Gh. Domășneanu (AEM)"`). The older `/routes/capeti-linie.json` is not used: it still lists pre-diversion end stations.
- **Last departures:** no GTFS timetable yet (PLAN open question 2), so `source` is always `LIVE_ESTIMATE` = the latest of the next few arrivals STPT reports (about the next 30–60 minutes). The summary sentence ("Last tram 2 from … leaves at 21:41") is therefore an estimate until the GTFS file is used. STPT's vehicles answer also has a per-line `service_window.last_arrival` (e.g. `24:30`) that could improve this later; not used yet.

**Tests (52 new, 81 total, all passing on 2026-11-13):** `StptClientImplTest` parses real STPT answers saved in `src/test/resources/stpt/` (no network); `TransitMapperImplTest` (types, time zones, midnight, duplicates); `TransitServiceImplTest` (sorting, bbox, caching, stale fallback when STPT is down, 503 with no cache, 404 stop, last departures, summary in English and Romanian); `TransitControllerTest` (JSON shapes, no token needed, 400/404/503); `StaleCacheTest`; `GeoParsingTest`. A one-off run against the real STPT on 2026-11-13 returned 74 lines, 926 stops, live vehicles, arrivals and 5 alerts.

## Knowledge graph

One graph for the whole repo, made with the **Understand-Anything** plugin (rule from AGENTS.md: keep it updated with every change).

- **Files:** `.ua/knowledge-graph.json` (the graph), `.ua/meta.json` and `.ua/fingerprints.json` (let the next run update only changed files), `.ua/.understandignore` (what is left out: secrets such as `application-local.properties` and `.env`, build output, `.claude/`). Scratch folders under `.ua/` are git-ignored.
- **Current version (2026-11-13, commit `10d68bf`, after task 9 live transit):** 94 files, 205 nodes, 451 edges, 10 layers (Project Documentation — now also holds `docs/API.md`, Backend App Security & Config, Backend Shared Web Layer — now with `common/cache` and `common/geo`, **Backend Transit Feature** (new), Backend Tests, Backend Build & Config, Database Schema, Infrastructure & Tooling, Frontend App, Frontend Config), 18-step guided tour (steps 12–16 walk through transit).
- **Left out on purpose** (`.ua/.understandignore`): secrets, build output, `.claude/`, and frontend noise (`package-lock.json`, `assets/`, `LICENSE`, `.npmrc`).
- **Update it** after each change: run `/understand` (Claude Code) or the same command in Codex; it only reanalyzes changed files. `/understand-dashboard` opens the interactive view.
- **Codex:** the plugin's README lists Codex as supported (install it with the plugin's install script for `codex`); not tested by us yet.
