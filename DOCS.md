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

- `backend/`: Spring Boot 4.1.2 (Java 21, Gradle) with the task-3 foundation: token security, error handling, current user, paging, tests; places feature (task 8) with 1003 Timișoara places imported into Supabase. 73 tests passing.
- `supabase/`: migrations and schema tests for task 2, applied.
- `docs/API.md`: API contract (task 1.6).
- `infra/otp/`: folder for OpenTripPlanner (README only; the server is set up in task 10). Its large data files are git-ignored.
- `frontend/`: Expo app (SDK 54, TypeScript, Expo Router) — foundation (task 12) and Home page (task 13) done on mock data; Map and AI tabs are placeholders until tasks 14–15. See Features → Frontend and `frontend/AGENTS.md`. Each teammate works on their own `<name>_dev` branch.
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
| `/proxy-smtt-cache.php?stopid=<id>` | Arrivals at a stop (seen in the site's script; response not sampled yet) |
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

Sections are added here as each PLAN task is implemented: Users, Events, Reliability, Places, Transit, Routing, AI, Frontend (below Places).

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

### Frontend (PLAN tasks 12 and 13)

Expo SDK 54 app in `frontend/`, TypeScript (strict), Expo Router, runs in **Expo Go** (no custom native code). Look and feel follow the dark-neon design reference (`dark-neon-mobile-app-design-prompt.md`, design only — no features come from it).

**Run it**
1. `cd frontend && npm install` (the `.npmrc` sets `legacy-peer-deps`).
2. Copy `.env.example` to `.env` and fill it in:

| Variable | Meaning |
|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | `https://<project-ref>.supabase.co` (sign-in only) |
| `EXPO_PUBLIC_SUPABASE_KEY` | Legacy `anon` or publishable key. Never the `service_role` key. Without it the sign-in screens show a setup warning. |
| `EXPO_PUBLIC_API_URL` | `http://<laptop Wi-Fi IPv4>:8080` — only used when mocks are off |
| `EXPO_PUBLIC_USE_MOCKS` | `true` = serve `src/mocks/`; `false` = call the Spring API |

3. `npx expo start`, scan the QR code with Expo Go (phone and laptop on the same Wi-Fi). Restart Expo after changing `.env`.
4. Checks: `npm test` (Jest), `npm run typecheck`, `npm run lint`.

**Layout** (`frontend/src/`)

| Folder | Content |
|---|---|
| `app/` | Routes only. `(auth)/sign-in`, `(auth)/sign-up`; `(tabs)/` Home, Map, AI, Profile; `events/` (list, `new`, `[id]`, `[id]/ticket`, `[id]/scan`); `users/` (`search`, `[id]`). |
| `api/` | `client.ts` (the single request function), `endpoints.ts` (typed calls), `types.ts` (shapes from `docs/API.md`), `errors.ts` (`ApiError`, friendly messages). |
| `hooks/` | `queries.ts` — one TanStack Query hook per endpoint, plus cache keys. |
| `mocks/` | In-memory fake backend with the same shapes and error codes as `docs/API.md`. |
| `features/` | `auth`, `location`, `events`, `transit`, `users` — feature components and logic. |
| `ui/` | Design tokens (`theme.ts`), text, buttons, chips, cards, inputs, loading/empty/error states, default avatar, glow background. |
| `lib/` | Supabase client, query client, time (Romanian time), geo, validation. |

**How it works**
- **Auth (12.2):** `features/auth/AuthProvider` wraps the Supabase client. The session is stored on the device (AsyncStorage) and refreshed while the app is in the foreground. The root layout uses `Stack.Protected`, so signed-out users can only reach the `(auth)` screens; on sign-out the query cache is cleared. Sign-up first calls `GET /users/username-available` (the database trigger would silently replace a taken username) and then sends the username as sign-up metadata. If the username cannot be checked (backend down) sign-up stops with a message instead of guessing.
- **API layer (12.3):** `api(method, path, {query, body})` adds `Authorization: Bearer <Supabase token>`, a 15 s timeout, and turns every failure into an `ApiError` (`NETWORK` and `TIMEOUT` are added for transport problems). With `EXPO_PUBLIC_USE_MOCKS=true` the same call is answered by `src/mocks/` and never touches the network. Switching one feature to the real backend later means making `USE_MOCKS` false (it is one global switch today).
- **Mock backend:** stateful until the app reloads — join, leave, create, ban and check-in really change the data. The mock user is `demo_user` (independent of the Supabase account). Tickets you can scan as organiser of "Sunset run by the Bega": `demo-ticket-stella`, `demo-ticket-andrei`, `demo-ticket-maria` (type one in the manual field of the scanner, or turn it into a QR code). "Art walk through the old town" is already joined by the mock user, so "My ticket" works there.
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

Also built: Profile tab (username, gauge, find people, sign out) and the public profile (PLAN 16.4, 16.5). Map and AI tabs only show their page frame; the real work is PLAN tasks 14 and 15.

**Tests:** 138 Jest tests in `frontend/__tests__/` (jest-expo + React Native Testing Library 13): every screen, the auth provider, location, API client (real HTTP path with a faked `fetch`), the mock backend, and the pure helpers. Native modules (maps, camera, location, Supabase, router) are mocked in `jest.setup.ts`. Last run 2026-11-13: all passing, `tsc` and `expo lint` clean, Android bundle builds with `expo export`.

**Not verified yet:** nothing was run on a phone in Expo Go (camera scan, map tap, real Supabase sign-in against the HS256 secret — see "Token validation" above). Do this first when the keys are in `.env`.

## Knowledge graph

One graph for the whole repo, made with the **Understand-Anything** plugin (rule from AGENTS.md: keep it updated with every change).

- **Files:** `.ua/knowledge-graph.json` (the graph), `.ua/meta.json` and `.ua/fingerprints.json` (let the next run update only changed files), `.ua/.understandignore` (what is left out: secrets such as `application-local.properties` and `.env`, build output, `.claude/`). Scratch folders under `.ua/` are git-ignored.
- **Current version (2026-11-13, commit `54ed920`, after task 8):** 91 files, 219 nodes, 474 edges, 11 layers (Project Documentation, API Contract, Backend App Security & Config, Backend Shared Web Layer, Places Feature, Backend Tests, Backend Build & Config, Database Schema, Infrastructure & Tooling, Frontend App, Frontend Config), 19-step guided tour.
- **Left out on purpose** (`.ua/.understandignore`): secrets, build output, `.claude/`, and frontend noise (`package-lock.json`, `assets/`, `LICENSE`, `.npmrc`).
- **Update it** after each change: run `/understand` (Claude Code) or the same command in Codex; it only reanalyzes changed files. `/understand-dashboard` opens the interactive view.
- **Codex:** the plugin's README lists Codex as supported (install it with the plugin's install script for `codex`); not tested by us yet.
