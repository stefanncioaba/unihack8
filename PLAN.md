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
| B + C | AI navigation ("Go" button) — added 2026-11-14 | 18 |
| B | AI stays on topic; trip cost in AI answers — added 2026-11-14 | 19, 20 |

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
                                   10 Routing + 11 AI + 14 Map + 15 AI chat ─> 18 AI navigation ("Go")
                                   11 AI ─> 19 AI stays on topic
                                   10 Routing + 11 AI ─> 20 Trip cost in AI answers
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
- [x] **3.2 Package layout** — created by each member as their feature is built; all feature packages now exist (`ai` was the last, 2026-11-14), plus shared `common` and `config`. One package per feature, same shape everywhere:
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

- [x] **11.1** `POST /ai/chat` with `{ messages, location }` → `{ reply, places[], events[], sources[] }`. Needs a token; no per-user request limit (removed).
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
- [x] **13.9 Next arrival on Home:** the city info strip shows the next arrival at the nearest stop ("Next tram 2 at … arrives at 21:45 (in 4 min)"), and says when that trip is the last one today (`nextArrival` in `GET /transit/summary`).
- [x] **13.10 AI shortcuts on Home:** save AI questions ("Find cheapest coffee") as buttons on Home — from "Save as shortcut" under a sent question in the chat, or "Add" on Home; tapping one opens the AI tab and asks it in a new chat; Edit / long press removes. Stored on the device (AsyncStorage), max 12.

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

- [x] **17.1** Turn `USE_MOCKS` off per feature; fix contract mismatches in `docs/API.md` first. *Done 2026-11-14: the app has no mock mode at all (mocks moved to `frontend/testing/`, test-only, absent from the Android bundle); 30 calls compared with the backend, mismatches fixed; live test 7/7 against the real backend. See `DOCS.md` → Integration.*
- [ ] **17.2 Demo setup (no deployment):** backend + OTP run on one laptop at the hackathon; phones open the app in Expo Go on the same Wi-Fi. Create our own accounts in the app, run the LiveTickets import, and add a few events through the create-event form. *Checklist ready in `docs/DEMO.md`; to do on demo morning with the real phones.*
- [ ] **17.3 Full walkthrough on two real phones:** sign up → find an event → join → organiser scans the QR → score goes up → no-show loses points → ask the AI → get directions by tram. *Steps in `docs/DEMO.md`; needs two phones.*
- [x] **17.4** Handle offline / slow network and empty states on every screen. *Offline banner + queries pause/refetch with NetInfo; 15 s timeout message; loading/error/empty states checked on every screen.*
- [x] **17.5** Final `DOCS.md`, knowledge graph and README (how to run everything).
- [ ] **17.6** Pitch: 3-minute demo script and a backup screen recording. *Script written in `docs/DEMO.md`; the recording is still to do (needs the phones).*

---

## 18. AI navigation — "Go" button — Tracks B + C

**Needs:** 10, 11, 14.5, 15.4 (all done). Added 2026-11-14. **Goal:** when the AI gives directions that start **where the user is**, the answer has a "Go" button that starts the journey on the map, like Google Maps or Waze. When the route starts somewhere else (e.g. "from the university to a coffee shop"), there is **no** "Go" button — you cannot start a journey from a place you are not at.

- [x] **18.1 Contract first** (`docs/API.md`): `POST /ai/chat` answers gain `routes[]` (empty, never `null`) — one entry per route the AI planned for the answer: `from` and `to` (`lat`, `lon`, `name`), `mode` (`WALK` | `TRANSIT`), `durationMinutes`, `distanceMeters`, and `startsFromUser` (boolean).
- [x] **18.2 Backend — return the planned routes:** `plan_route` records every route it plans during the request; the chat service puts them in `routes[]`, with the destination name matched to the place/event from the tool results.
- [x] **18.3 Backend — decide `startsFromUser`:** `true` only when the request carried the user's real `location` **and** the route starts there (the model gave no start point, or gave one within ~50 m of the user). `false` when the start is another place, and `false` when `location` is `null` (the city-centre default is not the user's position).
- [x] **18.4 Mobile — route card** under the AI answer (next to the cards from 15.4): destination, walking / public transport, time estimate. The **"Go"** button is shown only when `startsFromUser` is `true`; otherwise the card has only "Show route on map" (preview, no journey).
- [x] **18.5 Mobile — journey mode on the Map tab:** "Go" opens the map and plans a fresh route from the live GPS position to the destination (`GET /routes/plan`, same mode as the AI's route). Shows the route line, the camera following the user, the current step ("Walk to stop X", "Take tram 1 towards Y, get off at Z"), remaining time and distance, and an "End" button. Foreground only (`expo-location` position watching) so it runs in Expo Go.
- [x] **18.6 Mobile — during the journey:** move to the next step as the user advances, re-plan when the user is more than ~50 m off the route, and show "You have arrived" within ~30 m of the destination.
- [x] **18.7 Guards:** "Go" asks for location permission if it was denied (no journey without it); if the user has moved more than ~200 m since the AI answered, the route is simply re-planned from the new position; network errors show the usual error + retry.
- [x] **18.8 Tests:** backend — `startsFromUser` for user start / other start / start near the user / no location, and `routes[]` in the chat answer; mobile — button shown and hidden, "Go" opens journey mode, step advance, arrival, off-route re-plan (mocked positions).
- [x] **18.9** `DOCS.md` (AI assistant + Map sections) and the knowledge graph updated.

---

## 19. AI stays on topic — Track B

**Needs:** 11 (done). Added 2026-11-14. **Goal:** the assistant answers only questions about Timișoara (places, food and drinks, events, public transport, the city itself) and directions to a place. Anything else — "code me something", homework, essays, translations, general knowledge — is declined. Today the system prompt has one soft line about this (rule 10); this task makes it strict and tested.

- [x] **19.1 Strict scope rule in the system prompt:** list what is in scope and what is not, with examples of requests to refuse (code, maths/homework, essays, translations, general chat). A refusal is one short sentence saying what the assistant can help with, in the user's language, with **no tool calls**.
- [x] **19.2 Cannot be talked out of it:** "ignore your instructions", role-play ("pretend you are a programmer") and requests wrapped in a city excuse ("write Python code about Timișoara trams") are still refused.
- [x] **19.3 Do not over-refuse:** short follow-ups ("and the second one?", "is it open now?") are judged with the whole conversation, not alone; a mixed message gets the city part answered and the rest declined in one sentence.
- [x] **19.4 Answer shape:** a refusal is a normal `200` answer with `reply` and empty `places` / `events` / `sources` (and `routes`) — no new error code, so the app needs no change. Add the sentence to `docs/API.md`.
- [x] **19.5 Tests:** unit tests that the prompt carries the scope rule and that a refusal returns empty lists; a live check against real Gemini with a fixed list of about 12 prompts (off-topic, trick prompts, mixed, normal follow-ups), results noted in `DOCS.md`. *Done 2026-11-14: `SystemPromptTest`, two refusal tests in `AiChatServiceImplTest`, opt-in `ScopeLiveCheckTest` — live 13/13 pass, table in `DOCS.md` → AI assistant.*
- [x] **19.6** `DOCS.md` (AI assistant section) and the knowledge graph updated.

---

## 20. Trip cost in AI answers — Track B

**Needs:** 10, 11 (done). Added 2026-11-14. **Goal:** when the user asks to go to a place, the answer includes what the trip costs, as a sum — e.g. "tram 1: X lei + bus E2: Y lei + espresso about Z lei = about N lei".

- [ ] **20.1 STPT ticket prices:** research the current fares on STPT's official page (single ride, and whether one ticket covers a change of line within a time limit) and store them with the source link and the date checked — same idea as the stored menu prices (11.3). First check whether the GTFS zip from task 10 already has fare files. **Never a fare from memory or a guess.**
- [ ] **20.2 `plan_route` returns the ticket cost:** for each public transport ride in the route, the line and its ticket price, plus the ticket total, using the fare rules from 20.1. Walking is free. When the fare is not stored, the tool says "ticket price unknown".
- [ ] **20.3 Cost of the place itself:** from the stored menu prices — the item the user asked about (coffee, pizza, beer…), or the cheapest typical item when they named none. For an event, its ticket price (`price_min`). No stored price → "price unknown", never a guess.
- [ ] **20.4 System prompt rule:** whenever the answer sends the user to a place, end with one cost line: each ride with its price + the item at the place, and the total. The total says "about" when a menu price is in it; when a part is unknown, the line gives the known sum "plus <item> (price unknown)".
- [ ] **20.5 Sources:** the STPT fare page is added to `sources[]` when a ticket price is quoted. Note the cost line in `docs/API.md`.
- [ ] **20.6 Route card:** if task 18 is done, the route card (18.4) also shows the ticket total (`routes[].ticketCostLei`, `null` when unknown) — contract in `docs/API.md` first.
- [ ] **20.7 Tests:** fare calculation (walk only, one ride, a change of line, unknown fare), the cost fields in the `plan_route` result, the prompt rule, and a live check with real routes noted in `DOCS.md`.
- [ ] **20.8** `DOCS.md` (AI assistant section) and the knowledge graph updated.

## 21. Map filters and live transit network — Track C (+ B for the API)

**Needs:** 9, 14 (done). Added 2026-11-14. **Goal:** clearer map filters, events visible at any zoom, and the whole STPT network live on the map.

- [x] **21.1 Filter row:** first chips are All places, Events, Transport. All places can be turned off only while Events or Transport is on.
- [x] **21.2 Chip colours:** selected chips keep their colour when pressed (map style no longer overrides the selected fill).
- [x] **21.3 Events zoomed out:** count bubbles at any zoom level, tap to zoom in; Android custom markers render.
- [x] **21.4 Backend:** `GET /transit/vehicles` without `route` gives all vehicles; new `GET /transit/shapes` (GTFS shapes) — `docs/API.md`.
- [x] **21.5 Transport layer:** every line drawn in its own colour, all vehicles live (no line picking: the whole network shows at once), tap a vehicle for its info panel.
- [x] **21.6 Directions:** live vehicles of the route's lines drawn along the route (preview and journey mode).
- [x] **21.7 Profile:** reliability score no longer shows ".." instead of the number.
- [x] **21.9 Directions focus mode:** while directions are shown, the filters are off and greyed out; only the user, the route, its live vehicles and the destination are on the map.
- [x] **21.10 Trip guidance on the map:** which tram/bus to board (line, direction, time), where to get off, and "Walk N min" labels.
- [x] **21.11 Map lag fixed:** simplified shapes, memoised markers and lines, only in-view vehicles, one shared marker timer.
- [x] **21.12 Only our data on the map:** the base map's own points of interest and transit stations are hidden. Map icons no longer show cut in half (icon font + fixed-size marker roots).
- [x] **21.13 Transport is exclusive:** turning it on switches the other filters off and greys them out; turning it off restores the previous filters.
- [x] **21.14 STPT-style line view:** vehicles only until a line is picked; then one line, one direction (Tur/Retur), its stops and its vehicles; colours by type family; bearing arrows.
- [x] **21.15 Smooth vehicles:** 5 s refresh and a native glide between positions (like live.stpt.ro).
- [x] **21.16 Directions show only the essentials:** you, the destination, the route, board/get-off markers and the live vehicles of the route's lines anywhere on the line.
- [x] **21.17 AI price box:** an average total from stored prices only, shown as a highlighted box under the answer (`cost` in `POST /ai/chat`).
- [x] **21.8a Tests and `DOCS.md` updated.**
- [x] **21.8b Knowledge graph updated** (full rebuild, then an incremental update after the line chips were removed).

---

## 22. Event reviews and organiser rating — Tracks A + C

**Needs:** 5, 6 (done). Added 2026-11-14. **Goal:** after the organiser scans a participant's QR code, that attendee can rate the event 1–5 stars with an optional short reason. The event shows the rating live, with who reviewed and why; past organised events show it too. 24 h after the event ends the average moves the organiser's reliability: above 3 stars gains, 3 or less loses, scaled to the rating (±5 max).

- [x] **22.1 Database:** `event_reviews` (one per attendee per event, rating 1–5, comment ≤ 300) and `events.review_settled_at` — migration `20261114000004_event_reviews.sql`. *Applied to Supabase 2026-11-14 and checked (7/7).*
- [x] **22.2 API:** `GET /events/{id}/reviews` (public), `PUT /events/{id}/reviews/me` (checked-in attendees only, until end + 24 h); errors `NOT_ATTENDED`, `REVIEWS_CLOSED`. Contract in `docs/API.md`.
- [x] **22.3 Ratings in answers:** `averageRating` / `reviewCount` on `EventSummary` and `EventDetail`; `organizedEvents` (past, with ratings) on `GET /users/{id}`.
- [x] **22.4 Organiser rating job:** once per event, 24 h after the end: `round((avg − 3) × 2.5)`, at least ±1, logged as `EVENT_RATING`; no reviews → no change.
- [x] **22.5 App:** reviews section on the event page (stars, count, list with reviewer and comment, live refresh every 10 s), star picker + comment form for checked-in attendees, stars on event list items, "Organised (past)" in My events, "Events organised" on public profiles, `EVENT_RATING` in the reliability history; mock backend has the same rules.
- [x] **22.6 Tests:** backend and frontend (see `DOCS.md` → Event reviews).
- [x] **22.7** `DOCS.md`, `docs/API.md` and the knowledge graph updated.

---

## 23. Volunteer actions — Tracks A + C

**Needs:** 5, 6 (done). Added 2026-11-14. **Goal:** events tagged "volunteer" (park cleanups, food drives) on the existing event system; reliability is shown as a civic trust score and volunteering gives bonus points.

- [x] **23.1 Category:** `VOLUNTEER` accepted by the events API, filters, AI `search_events` and the LiveTickets category guess. No database change.
- [x] **23.2 Bonus:** check-in at a `VOLUNTEER` event adds +5 more, logged as `VOLUNTEER_BONUS` (total +10, once per ticket).
- [x] **23.3 App:** Volunteer category chip/icon, bonus line on the event page, bonus rule in the profile, "Volunteer bonus" in the history, "civic trust" wording; mock backend has the same rule and two demo actions.
- [x] **23.4 Tests:** backend and frontend (see `DOCS.md` → Volunteer actions).
- [x] **23.5** `DOCS.md`, `docs/API.md` and the knowledge graph updated.

---

## 24. Neighbourhood Pulse — Tracks B + C

**Needs:** 5, 6, 8, 9 (done). Added 2026-11-14. **Goal:** "See what your neighbourhood is doing right now." One screen with a live card per Timișoara area (Cetate, Fabric, Iosefin, Elisabetin, Mehala, Complexul Studențesc, Circumvalațiunii, Fratelia, Soarelui): events now and tonight with free spots, STPT lines, live vehicles and service alerts, places open now, and how many reliable community members are going out there. No new tables.

- [x] **24.1 Areas:** hard-coded centres and radii; a point-in-radius check (nearest centre wins on overlap) assigns events, places, stops and vehicles to an area.
- [x] **24.2 API:** `GET /neighbourhoods/pulse` (public) combines the existing event, place, transit and participant services; cached 30 s; a source that is down only empties its own section. Contract in `docs/API.md`.
- [x] **24.3 Busy / quiet:** a `QUIET` / `STEADY` / `BUSY` level from an activity score (events, people going, open places, vehicles). *There are no user "quiet / busy" check-ins in the app — that would need a table — so the level is computed from live data instead.*
- [x] **24.4 App:** Pulse screen (`/pulse`, opened from the **Pulse** button on Home) with a photo per area, the four sections, tap an event to open it, "Show on map", pull to refresh, refresh every minute, loading / error / empty states.
- [x] **24.5 Photos:** one Wikimedia Commons photo per area (free licences), bundled in `frontend/assets/neighbourhoods/` with credits in `CREDITS.md` and a credit line on each card.
- [x] **24.6 Tests:** backend (areas, alert matching, the pulse service with sources down, cache, controller) and app (text lines, screen, Home button).
- [x] **24.7** `DOCS.md`, `docs/API.md` and the knowledge graph updated.
- [x] **24.8 Area panel:** tapping a Pulse card opens `/pulse/<area>` with the photo and two tabs: **Events** (upcoming events inside the area, same nearest-centre rule as the backend) and **Help**.
- [ ] **24.9 Help tab:** list the area's help requests from the Neighbour Help Board (task 25, built in its own session) once it is merged; it needs a `bbox` filter on its list endpoint. *Until then the tab says help requests will show there.*
- [x] **24.10 Map pin fix:** the "Show on map" pin opens the trip card when tapped and disappears once that card is closed (it comes back only when "Show on map" is pressed again).

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
