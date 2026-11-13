# PLAN

Mobile app for the "Connected Communities" theme: events, places, live public transport and an AI guide for Timișoara.

## How to use this plan

- Big tasks are numbered `1, 2, 3…`, their steps `1.1, 1.2…`. Tick a box when the step is implemented, documented, represented in the knowledge graph, and tested. Merging still requires Stefan's approval and passing tests.
- Every big task has an **owner track** (A, B or C) and a **needs** line. If "needs" is already done, nobody is waiting on anybody.
- Task 1 is done **together, first**. After it, the three tracks run in parallel.
- The mobile track builds against **mock data** that follows `docs/API.md` (task 1.6), so it never waits for the backend. Swapping a mock for the real endpoint is one line per feature.

### Tracks (who is A, B, C is up to you)

| Track | Area | Big tasks |
|---|---|---|
| **A** | Supabase, auth, users, events, QR + reliability | 2, 3, 4, 5, 6, 7 |
| **B** | City data: places, STPT live transit, routing, AI | 8, 9, 10, 11 |
| **C** | Mobile app (React Native + Expo Go) | 12, 13, 14, 15, 16 |
| All | Foundation and final integration | 1, 17 |

Track C has the most screens. Whoever finishes their backend tasks first takes screens from C, in this order: QR screens (13.6, 13.7), create-event form (13.5), route panel (14.5).

### Rules to avoid blocking each other

- One branch per person (`<name>_dev`). Branches are merged into `main` **only when Stefan says so** — never on a schedule and never by an agent on its own. After a merge, everyone pulls `main` into their branch.
- Each track only edits its own folders: A and B own separate backend packages, C owns `frontend/`.
- Shared files (`build.gradle`, `application.properties`, `SecurityConfig`, `docs/API.md`) belong to track A. Others change them through a small PR and say so in chat.
- `DOCS.md` has one section per feature. Edit only your own section.
- A change to an endpoint's shape is made in `docs/API.md` **first**, then in code.

### Definition of done (from AGENTS.md, applies to every step)

- Tests written and passing.
- `DOCS.md` updated.
- Knowledge graph updated.
- A short comment before every function.
- Commits are never co-authored.

### Dependency map

```
1 Foundation ──┬─> 2 Database ─> 3 Backend base ─┬─> 4 Users ──────┐
               │                                 ├─> 5 Events ─> 6 QR + reliability
               │                                 ├─> 7 LiveTickets import
               │                                 ├─> 8 Places ─────┐
               │                                 ├─> 9 STPT live ──┼─> 11 AI
               │                                 └─> 10 Routing ───┘
               └─> 12 Mobile base ─> 13 Home, 14 Map, 15 AI chat, 16 Profile (all on mocks)
                                                         everything ─> 17 Integration + demo
```

Tasks 8, 9 and 10 do not need the database to start: B can build and test them against the external sources while A is still on tasks 2 and 3.

---

## 1. Foundation — all three, together, before anything else

**Needs:** nothing. **Goal:** everyone can run the project and knows the API shapes.

- [x] **1.1 Create the Supabase project** (manual, in the Supabase dashboard). Region: Frankfurt (`eu-central-1`). Save the database password in a password manager, not in the repo.
- [x] **1.2 Connect the Supabase MCP server to Claude Code.** Add the hosted Supabase MCP server scoped to this project's ref, log in through the browser prompt, then check that it can list tables. Keep it scoped to this one project. Each teammate who wants to run migrations repeats this on their machine.
- [x] **1.3 Collect the keys.** Example files committed; each person copies them and fills in the database password, pooler host and Gemini key (see `DOCS.md` → "Configuration and running").
  - **Backend:** all keys live in `backend/src/main/resources/application-local.properties` (already git-ignored). Commit an `application-local.properties.example` with the same names and empty values:
    - Supabase URL and the legacy JWT secret (for token validation)
    - database URL, user, password (session pooler connection string)
    - Gemini API key and model names (backend only — never in the mobile app)
    - OpenTripPlanner base URL
  - **Mobile:** done later, in step 12.1.
- [x] **1.4 Configure Supabase Auth:** email + password sign-in. Turn off "confirm email" for the hackathon so demo accounts work instantly.
- [x] **1.5 Repo layout and branches** — each teammate creates their own `<name>_dev` branch; `frontend/` is created by the frontend teammates (task 12.1). Layout:
  ```
  backend/              Spring Boot API (exists)
  frontend/             Expo app (task 12.1, created by the frontend teammates)
  infra/otp/            OpenTripPlanner data + docker-compose (exists, filled in task 10)
  supabase/migrations/  SQL of every migration applied through MCP (exists)
  supabase/tests/       schema checks (exists)
  docs/API.md           API contract (exists)
  ```
- [x] **1.6 Write the API contract** in `docs/API.md`: every endpoint listed in tasks 4–11 with request and response JSON examples and the error shape. Track C copies the examples into `frontend/src/mocks/`. **This step is what removes the waiting — do not skip it.**
- [x] **1.7 Agree the reliability rules** (agreed 2026-11-13): start at 100, attended `+5`, no-show `−10`, cancel less than 2 h before start `−2`, never below 0. Details in `DOCS.md` → "Reliability rules".
- [x] **1.8 Docs and knowledge graph baseline:** `DOCS.md` skeleton done; first knowledge graph generated in `.ua/` with Understand-Anything (see `DOCS.md` → "Knowledge graph").

---

## 2. Database (Supabase, through MCP) — Track A

**Needs:** 1.1, 1.2. Every migration is applied through MCP **and** saved as a `.sql` file in `supabase/migrations/`. Every `id` column is a UUID.

- [x] **2.1 `profiles`**: `id` (uuid, = `auth.users.id`), `username` (unique, case-insensitive), `reliability_score` (int, default 100), `created_at`. No profile picture column for now — the app shows one default picture for everyone; custom pictures only if time is left.
- [x] **2.2 Trigger** on `auth.users` insert that creates the matching `profiles` row (username taken from sign-up metadata).
- [x] **2.3 `events`**: `id`, `source` (`USER` | `EXTERNAL`), `external_id` (the event's id on the platform it came from, prefixed with the platform name, e.g. `livetickets:<id>`; unique; null for user events), `title`, `description`, `category`, `venue_name`, `address`, `lat`, `lon`, `starts_at`, `ends_at`, `capacity` (null = unlimited), `organizer_id` (null for imported events), `image_url`, `price_min`, `price_max`, `external_url`, `created_at`.
- [x] **2.4 `event_participants`**: `event_id`, `user_id` (unique pair), `status` (`JOINED` | `ATTENDED` | `NO_SHOW` | `CANCELLED` | `BANNED`), `qr_token` (unique, random), `joined_at`, `checked_in_at`.
- [x] **2.5 `reliability_log`**: `id`, `user_id`, `event_id`, `points_change` (how many points were added or removed, e.g. `+5` or `-10`), `reason`, `created_at` — the history behind each score.
- [x] **2.6 `places`**: `id` (our UUID, how the app refers to the place), `osm_id` (text, unique — the id OpenStreetMap gave the place, e.g. `node/2845091337`; it is how the import recognises a place it already saved, so re-running it updates rows instead of creating duplicates), `name`, `category`, `lat`, `lon`, `address`, `opening_hours`, `tags` (jsonb). Filled by task 8.
- [x] **2.7 Indexes:** events by `starts_at` and by `lat`/`lon`, places by `category` and `lat`/`lon`, trigram index on `profiles.username` and `events.title` for search.
- [x] **2.8 Row Level Security:** enable RLS on every table with no public policies. The app reads and writes only through the Spring API; the mobile app talks to Supabase for sign-in only.
- [x] **2.9 Security check:** run the Supabase security advisor and fix what it reports. **No seed data** — no mock users and no mock events in the database. We create our own accounts in the app; events arrive from the LiveTickets import (task 7) and from the create-event form.

---

## 3. Backend foundation — Track A

**Needs:** 1.3, and 2.1 for the first real query. Spring Boot 4.1.2 / Java 21 / Gradle are already set up.

- [x] **3.1 Dependencies and config:** add the OAuth2 resource-server starter; keys are read from `application-local.properties`, which Spring loads when the app runs with the `local` profile (set in the IntelliJ run configuration — `application.properties` stays free of secrets, so tests never load real keys); JPA `ddl-auto=validate` (the schema lives in Supabase, not in Hibernate).
- [ ] **3.2 Package layout** — created by each member as their feature is built (shared `common` and `config` packages exist). One package per feature, same shape everywhere:
  ```
  com.unihack8.backend.<feature>/
    domain/entity/     domain/dto/
    controller/
    mapper/            mapper/impl/      (interface + hand-written implementation)
    repository/
    service/           service/impl/     (interface + implementation)
  ```
  Features: `users`, `events`, `reliability`, `places`, `transit`, `routing`, `ai`, plus `common` and `config`.
- [x] **3.3 Security:** validate the Supabase access token (JWT) with the project's **legacy JWT secret** (HS256, `supabase.jwt-secret` in `application-local.properties`): a `JwtDecoder` bean built with `NimbusJwtDecoder.withSecretKey(...)` and `MacAlgorithm.HS256`. Before this works, the project's current signing key in Supabase (Project Settings → JWT Keys) must be the legacy HS256 secret — see `DOCS.md`. The user id is the token's `sub`. Public: `GET` on events, places, transit, and `GET /users/username-available` (see `docs/API.md`). Everything else needs a token. CORS open for development.
- [x] **3.4 Common pieces:** one error response shape, a global exception handler, a "current user" helper, pagination parameters.
- [x] **3.5 Test setup:** service unit tests with Mockito, controller tests with MockMvc and real HS256 test tokens (`support/JwtTestTokens`). Tests run on an in-memory H2 database (`src/test/resources/application.properties`) — no test may need the real Supabase database.
- [x] **3.6 Run guide** in `DOCS.md`: how to start the API on a laptop and reach it from a phone running Expo Go on the same Wi-Fi. No health endpoint for now — nothing is deployed.

---

## 4. Users and profiles — Track A

**Needs:** 3.

- [x] **4.1** `GET /users/me` — own profile.
- [x] **4.2** `PATCH /users/me` — change username (3–20 characters, letters/digits/underscore, unique; clear error when taken).
- [x] **4.3** `GET /users/search?q=` — search by username prefix, max 20 results.
- [x] **4.4** `GET /users/{id}` — public profile: username, reliability score, attended events.
- [x] **4.5** Tests for each endpoint, including "username taken" and "no token".

---

## 5. Events and participation — Track A

**Needs:** 3.

- [x] **5.1** `GET /events` — filters: `q` (text), `category`, `from`/`to` dates, `bbox` (for the map), `source`; paged; sorted by start time.
- [x] **5.2** `GET /events/{id}` — details, free spots, organiser summary, and whether the caller has joined.
- [x] **5.3** `POST /events` — create a user event (title, description, category, location, start/end, optional capacity). `PATCH` and `DELETE` for the organiser only.
- [x] **5.4** `POST /events/{id}/join` — fails when full, banned, or already joined; must be safe when two people take the last spot at once. Creates the participant's `qr_token`.
- [x] **5.5** `DELETE /events/{id}/join` — leave; applies the late-cancel penalty from 1.7.
- [x] **5.6** `GET /events/{id}/participants` — username + reliability score of each participant (so the organiser can decide whom to trust).
- [x] **5.7** `POST /events/{id}/participants/{userId}/ban` — organiser only; frees the spot.
- [x] **5.8** `GET /users/me/events` — events I joined and events I organise.
- [x] **5.9** Tests: capacity limit, double join, ban, organiser-only rules.

---

## 6. QR check-in and reliability — Track A

**Needs:** 5. Flow: the participant shows a QR code, the organiser scans it at the venue.

- [x] **6.1** `GET /events/{id}/my-ticket` — returns the caller's `qr_token` (the mobile app draws it as a QR code).
- [x] **6.2** `POST /events/{id}/check-in` with `{ token }` — organiser only; marks `ATTENDED`, adds points, writes `reliability_log`. Rejects wrong event, unknown token, and a second scan.
- [x] **6.3 No-show job:** a scheduled task that, after an event ends, turns every remaining `JOINED` into `NO_SHOW` and subtracts points. Runs every few minutes and is safe to run twice.
- [x] **6.4** `GET /users/{id}/reliability` — score plus the recent log entries.
- [x] **6.5** Tests: check-in happy path, duplicate scan, no-show job, score never below 0.

---

## 7. LiveTickets events import — Track A

**Needs:** 3 and 2.3. Source details are in `DOCS.md` → "External data sources".

- [x] **7.1 Client** for the LiveTickets public events endpoint; keep only events whose `city` is Timișoara. Imported rows get `source = EXTERNAL`. Save one real response as a test fixture.
- [x] **7.2 Mapping** to our `events` row: title, cleaned description (the source sends HTML), venue name, dates, prices, image, link back to the ticket page.
- [x] **7.3 Geocoding** (turning a venue name into map coordinates): only for events that are **new** in this import — events already saved keep their coordinates, so no separate cache table is needed. First look for the venue by name in our own `places` table; if it is not there, ask OpenStreetMap Nominatim (at most 1 request per second, identify the app in the request header). Events that cannot be located are saved without coordinates and appear in lists but not on the map.
- [x] **7.4 Import job:** runs on demand, not on a schedule (team decision 2026-11-13: the hackathon ends 15 Nov, so a weekly job would first run after it, and a GitHub workflow would need the database password as a secret). Run it once to fill the database and once more on demo morning: start the backend with `--events.import.enabled=true` (see `DOCS.md` → Events import). Upsert on `external_id` so re-runs never duplicate; upcoming events LiveTickets no longer lists are removed.
- [x] **7.5** Tests with the saved fixture (no network in tests).

---

## 8. Places (OpenStreetMap) — Track B

**Needs:** nothing to start (work against a local JSON file); 2.6 to store.

Restaurants, cafés and the other places are stored in our database from OpenStreetMap: name, category, position, opening hours. OpenStreetMap has no prices, menus or reviews — prices come from a researched, stored price list (task 11.3). We do not copy places out of Google Maps: its terms forbid bulk extraction and saving its place data.

- [x] **8.1 Category list** shared with mobile: restaurant, café, bar/pub, fast food, club, pharmacy, supermarket, park, museum/attraction, ATM. Map each to its OSM tags.
- [x] **8.2 Import script:** one Overpass query for the Timișoara area covering all categories, normalised into `places`. Run once (and re-runnable, no duplicates); do not call Overpass on every user request. Run with `--places.import.enabled=true` (see `DOCS.md` → Places). Falls back to a mirror server when the main Overpass server is busy.
- [x] **8.3** `GET /places` — filters: `category` (multiple), `bbox`, `near=lat,lon` + `radius`, `q`; returns distance when `near` is given.
- [x] **8.4** `GET /places/{id}` — details including opening hours when OSM has them.
- [x] **8.5** Tests for filtering and distance sorting.

---

## 9. Live public transport (STPT) — Track B

**Needs:** nothing to start. The backend calls `live.stpt.ro` and caches; the mobile app never calls it directly. Endpoints are in `DOCS.md` → "External data sources".

- [x] **9.1 STPT client** with short caches (vehicles 10 s, arrivals 20 s, alerts 5 min, stops/routes 24 h) and a timeout, so a slow source never hangs our API.
- [x] **9.2** `GET /transit/stops` (optional `bbox`) and `GET /transit/routes`.
- [x] **9.3** `GET /transit/vehicles?route=` — live positions for the map.
- [x] **9.4** `GET /transit/stops/{id}/arrivals` — next arrivals at a stop.
- [x] **9.5** `GET /transit/alerts` — current service alerts.
- [x] **9.6 "Last tram/bus" info:** `GET /transit/last-departures?stopId=` and `GET /transit/summary?near=lat,lon` (home page line such as "Last tram 1 from Gara de Nord leaves at 23:41"). Computed from the GTFS timetable used in task 10; before the GTFS file is available, return the last arrival known from 9.4.
- [x] **9.7** Tests with saved sample responses; test the fallback when the source is down (serve the last cached value and flag it as stale).

---

## 10. Routing (OpenStreetMap + OpenTripPlanner 2) — Track B

**Needs:** nothing to start; Docker on one machine.

- [x] **10.1 Get the data:** a Timișoara street extract from OpenStreetMap (`.osm.pbf`, cut from the Romania extract) and the STPT GTFS zip. The live site is generated from a file named `smtt-timisoara-ro.zip`; **finding a download for it is the first thing to do in this task** (see open question 2).
- [x] **10.2 Run OTP 2** with `infra/otp/docker-compose.yml`: build the graph once, save it, serve it. Document the two commands. OTP is its own server, separate from the Spring API: only the Spring backend calls it (address set in `application-local.properties`), the mobile app never does. Both use port 8080 by default, so run OTP on 8081.
- [x] **10.3** `GET /routes/plan?from=lat,lon&to=lat,lon&mode=WALK|TRANSIT` — the backend calls OTP's GraphQL API and returns a small shape: total minutes, and legs (mode, line, from/to stop, start/end time, polyline).
- [x] **10.4 Walking-only fallback:** if OTP is down or the GTFS file was not found, still answer `mode=WALK` (OTP with streets only, or straight-line distance × walking speed) so the demo never shows an error.
- [x] **10.5** Tests: mapping of a saved OTP response, and the fallback path.

---

## 11. AI assistant — Track B

**Needs:** 8 and 5 for real answers (start with stubbed tools). Uses the **Gemini API** (free tier). No chat history is stored: the mobile app sends the whole conversation each time and "New chat" just clears it.

- [x] **11.1** `POST /ai/chat` with `{ messages, location }` → `{ reply, places[], events[], sources[] }`. Needs a token; rate-limited per user (10/min).
- [x] **11.2 Database tools the model can call:** `search_places` (task 8, with stored prices and open-now), `search_events` (task 5), `transit_info` (task 9), `plan_route` (task 10). The model answers from tool results, so it cannot invent venues.
- [x] **11.3 Prices** — *changed 2026-11-13 (team decision):* Gemini's Google Search is not in the free tier any more and `gemini-2.5-flash` is retired for our key, so instead of a `web_lookup` tool, prices come from a **stored, researched price list** (table `place_prices`, 232 prices for 79 places, each with its source link). `search_places` returns them; places without a stored price are answered as "price unknown". See `DOCS.md` → AI assistant.
- [x] **11.4 System prompt:** Timișoara guide, current date/time and user location included, short answers, reply in the user's language (Romanian or English).
- [x] **11.5 Structured results:** return the places/events mentioned (bold names matched to tool results), so the app can show cards and a "show on map" button; `sources[]` lists the price pages.
- [x] **11.6** Tests with a fake Gemini client: tool call loop, empty results, tool errors, provider error, model fallback and quota retry (48 new tests). Also checked live against real Gemini and Supabase data (see `DOCS.md`).

---

## 12. Mobile foundation — Track C

**Needs:** 1.6 for mocks. Everything must run in **Expo Go** (no custom native code).

- [x] **12.1 Create the Expo app** in `frontend/` (TypeScript, Expo Router) with four tabs: Home, Map, AI, Profile. Add `frontend/.env` (git-ignored) with a committed `.env.example`: Supabase URL, Supabase publishable key, and the backend laptop's Wi-Fi address (`http://<ip>:8080`). Public values only — Expo bundles every `EXPO_PUBLIC_` variable into the app.
- [x] **12.2 Auth:** sign-up (email, password, username), sign-in, sign-out with the Supabase client; session kept on the device; signed-out users see only the auth screens.
- [x] **12.3 API layer:** one client that adds the Supabase token to every request, plus a `USE_MOCKS` switch that serves `frontend/src/mocks/` instead. Data fetching with TanStack Query.
- [x] **12.4 Shared UI:** colours, typography, buttons, cards, loading / empty / error states, and the one default profile picture used for every user.
- [x] **12.5 Location permission** and a "current position" hook, defaulting to Piața Victoriei when denied.
- [x] **12.6 Test setup:** Jest + React Native Testing Library, one test per screen at minimum.

---

## 13. Home page — Track C

**Needs:** 12. Real data from 4, 5, 6, 9.

- [x] **13.1 City info strip:** last tram/bus near you, active transit alerts (from 9.5, 9.6).
- [x] **13.2 Upcoming events** list with image, date, place, free spots.
- [x] **13.3 "All events" screen:** search box, category and date filters, endless scroll.
- [x] **13.4 Event details:** description, location with "show on map", organiser, participants with reliability scores (tap opens their profile), join / leave.
- [x] **13.5 Create event form:** title, description, category, date/time, capacity, location picked on a map.
- [x] **13.6 My ticket:** the participant's QR code for an event.
- [x] **13.7 Organiser scanner:** camera QR scan → check-in result (success, already scanned, wrong event); ban button in the participant list.
- [x] **13.8 User search:** search by username → opens the public profile (16.4).

---

## 14. Map page — Track C

**Needs:** 12. Real data from 5, 8, 9, 10. Use `react-native-maps` (works in Expo Go).

- [x] **14.1 Map** centred on Timișoara with the user's position.
- [x] **14.2 Category filter chips** (list from 8.1) and place markers loaded for the visible area only.
- [x] **14.3 Event markers** with a separate on/off toggle; tap opens event details.
- [x] **14.4 Transit layer:** stops, live vehicles for a chosen line (refresh every 10 s), tap a stop for next arrivals and last departure.
- [x] **14.5 Directions:** pick a destination (marker or long-press) → walking vs walking + public transport, with time estimate, steps and the route drawn on the map.
- [x] **14.6 Performance:** cluster markers when zoomed out; debounce reloads while the map moves.

---

## 15. AI chat page — Track C

**Needs:** 12. Real data from 11.

- [x] **15.1 Chat screen:** message list, input, "thinking" indicator, error + retry.
- [x] **15.2 "New chat" button** that clears the conversation (kept in memory only — nothing is saved).
- [x] **15.3 Suggested questions** on an empty chat ("Where can I eat pizza near me?", "What can I do this weekend?").
- [x] **15.4 Result cards** for places and events in an answer, with "show on map" and "open event".

---

## 16. Profile page — Track C

**Needs:** 12. Real data from 4, 6.

- [x] **16.1 My profile:** username, reliability score with a short explanation of how it changes.
- [x] **16.2 Change username** with inline validation and the "already taken" error.
- [x] **16.3 Events I attended** and upcoming events I joined or organise.
- [x] **16.4 Public profile screen** (other users): username, score, attended events. Reused from 13.4 and 13.8.
- [x] **16.5 Sign out.**
- [x] **16.6 Real data:** 16.1–16.3 call the Spring API (`PATCH /users/me`, `GET /users/me/events`, `GET /users/{id}/reliability`) when `EXPO_PUBLIC_USE_MOCKS=false`; pinned by `__tests__/api.users.real.test.ts`.

---

## 17. Integration, polish and demo — all three

**Needs:** everything above, but start switching mocks off feature by feature as soon as an endpoint is merged.

- [ ] **17.1** Turn `USE_MOCKS` off per feature; fix contract mismatches in `docs/API.md` first.
- [ ] **17.2 Demo setup (no deployment):** backend + OTP run on one laptop at the hackathon; phones open the app in Expo Go on the same Wi-Fi. Create our own accounts in the app, run the LiveTickets import, and add a few events through the create-event form.
- [ ] **17.3 Full walkthrough on two real phones:** sign up → find an event → join → organiser scans the QR → score goes up → no-show loses points → ask the AI → get directions by tram.
- [ ] **17.4** Handle offline / slow network and empty states on every screen.
- [ ] **17.5** Final `DOCS.md`, knowledge graph and README (how to run everything).
- [ ] **17.6** Pitch: 3-minute demo script and a backup screen recording.

---

## If time runs short — cut in this order

1. Marker clustering (14.6) and AI result cards (15.4).
2. Late-cancel penalty (5.5) and reliability log screen (6.4).
3. Transit routing through OTP (keep walking-only, 10.4).
4. LiveTickets import (the demo then shows only events created in the app).

Never cut: sign-in, events + join, QR check-in with reliability, map with filters, live vehicles, AI chat. These are the pitch.

## Open questions (need an answer from the team)

1. ~~**Prices, menus and reviews come from the AI's web lookup (11.3).**~~ Answered 2026-11-13: web search is not free any more; prices come from a stored, researched price list instead (11.3). Reviews are not available.
2. ~~**STPT GTFS file.**~~ Answered 2026-11-13: SMTT publishes it at `https://smtt.ro/transit/gtfs/maps/smtt-timisoara-ro.zip` (Mobility Database `mdb-2868`). Transit routing works; see `DOCS.md` → Routing.
3. **Permission.** The STPT and LiveTickets endpoints are the ones their own websites use; they are not documented public APIs. For a hackathon demo with caching this is low-volume, but ask both for permission if the app goes beyond the demo.4. **Reliability numbers** in 1.7 — confirm or change.
