# API contract

The contract between the Spring backend (`backend/`) and the Expo app (`frontend/`).
The app always calls the real backend (PLAN 17.1); the Jest tests use a mock backend built from the examples below (`frontend/testing/mocks/`),
so **change this file first, then the code**, and tell the team when you do.

Covers PLAN tasks 4–11. Sign-up and login are not here: the app does them directly with Supabase.

---

## Conventions

| Topic | Rule |
|---|---|
| Base URL | `http://<backend-laptop-wifi-ip>:8080` (no `/api` prefix). |
| Auth | `Authorization: Bearer <Supabase access token>`. Endpoints marked **public** work without it. Others answer `401`. |
| Format | JSON, `camelCase` field names. Missing values are `null`, never left out. |
| Ids | UUID strings, except places (`id` UUID, `osmId` text), transit stops and routes (STPT's own ids, strings like `"1"` or `"M11"`). |
| Times | ISO-8601 in UTC, e.g. `"2026-11-14T19:00:00Z"`. The app shows them in Romanian time (Europe/Bucharest). |
| Coordinates | `lat`, `lon` as numbers. |
| `bbox` | Map viewport: `minLon,minLat,maxLon,maxLat`, e.g. `bbox=21.18,45.73,21.26,45.77`. |
| `near` | `near=lat,lon`, e.g. `near=45.7537,21.2257`. |
| Paging | `page` (from 0) and `size` (default 20, max 100; max 500 when `bbox` is given, for map markers). Paged answers use the shape below. |

### Paged answer

```json
{
  "items": [],
  "page": 0,
  "size": 20,
  "totalItems": 57,
  "totalPages": 3
}
```

### Error answer

Every error has this shape. `code` is stable — the app switches on it; `message` is for people.

```json
{
  "status": 409,
  "code": "EVENT_FULL",
  "message": "This event has no free spots left.",
  "fields": null,
  "timestamp": "2026-11-14T18:02:11Z",
  "path": "/events/3f1c2a9e-5b7d-4e2a-9c41-8d6f0b2e7a15/join"
}
```

The codes live in `backend/.../common/exception/ErrorCode.java` — keep both in sync.
For `VALIDATION_FAILED`, `fields` lists per-field errors when available (for example `{ "title": "must not be blank" }`); it is `null` for whole-request rules such as an invalid date range.

| Status | Code | When |
|---|---|---|
| 400 | `VALIDATION_FAILED` | Body or query parameters are invalid. |
| 400 | `INVALID_USERNAME` | Username is not 3–20 letters, digits or `_`. |
| 401 | `UNAUTHORIZED` | Missing, expired or invalid token. |
| 403 | `FORBIDDEN` | Signed in, but not allowed (generic). |
| 403 | `NOT_ORGANIZER` | Only the event's organiser may do this. |
| 403 | `BANNED` | The organiser banned you from this event. |
| 403 | `EXTERNAL_EVENT` | Imported events cannot be edited, joined or scanned (tickets are sold on the source site). |
| 404 | `NOT_FOUND` | The user, event, place, stop or route does not exist. |
| 404 | `TICKET_NOT_FOUND` | The scanned QR code is not a ticket. |
| 405 | `METHOD_NOT_ALLOWED` | The path exists but not for this HTTP method. |
| 409 | `USERNAME_TAKEN` | Someone else has this username (case-insensitive). |
| 409 | `EVENT_FULL` | No free spots. |
| 409 | `ALREADY_JOINED` | You are already in this event. |
| 409 | `IS_ORGANIZER` | Organisers cannot join their own event. |
| 409 | `EVENT_ENDED` | The event is over (join, leave, check-in). |
| 409 | `NOT_JOINED` | You are not in this event (leave, ticket). |
| 409 | `WRONG_EVENT` | The scanned ticket belongs to another event. |
| 409 | `ALREADY_CHECKED_IN` | This ticket was already scanned. |
| 403 | `NOT_ATTENDED` | Only participants the organiser checked in can review the event. |
| 409 | `REVIEWS_CLOSED` | Reviews closed (24 h after the event ended, or the rating was settled). |
| 429 | `RATE_LIMITED` | Reserved. The AI chat no longer has a per-user limit, so nothing returns it today. |
| 500 | `INTERNAL_ERROR` | Unexpected server error (details are only in the backend log). |
| 503 | `AI_UNAVAILABLE` | Gemini did not answer. |
| 503 | `SOURCE_UNAVAILABLE` | STPT or OpenTripPlanner is down and nothing is cached. |

---

## Shared objects

### UserSummary

```json
{ "id": "8b0f6c1e-2d3a-4f5b-9c7d-1e2f3a4b5c6d", "username": "stefan", "reliabilityScore": 115 }
```

### EventSummary

Used in lists, on the map and inside other answers. `spotsLeft` is `null` when there is no limit.

```json
{
  "id": "3f1c2a9e-5b7d-4e2a-9c41-8d6f0b2e7a15",
  "source": "USER",
  "title": "Board games night",
  "category": "GAMES",
  "venueName": "Scârț Loc Lejer",
  "lat": 45.7489,
  "lon": 21.2318,
  "startsAt": "2026-11-14T17:00:00Z",
  "endsAt": "2026-11-14T21:00:00Z",
  "imageUrl": null,
  "priceMin": null,
  "priceMax": null,
  "capacity": 12,
  "spotsLeft": 4,
  "averageRating": 4.5,
  "reviewCount": 2
}
```

`averageRating` is the review average with one decimal (`null` without reviews); `reviewCount` is the number of reviews (see `GET /events/{id}/reviews`).

`source` is `USER` or `EXTERNAL`. Event `category` is one of (filtering by `OTHER` also returns imported events stored without a category):
`PARTY`, `CONCERT`, `THEATRE`, `SPORT`, `GAMES`, `FOOD`, `ART`, `MEETUP`, `OTHER`.
Imported events that cannot be classified get `OTHER`.

### PlaceSummary

`distanceMeters` is set only when the request had `near`.

```json
{
  "id": "c2d4e6f8-1a3b-4c5d-8e9f-0a1b2c3d4e5f",
  "osmId": "node/2845091337",
  "name": "Pizzeria Napoli",
  "category": "restaurant",
  "lat": 45.7537,
  "lon": 21.2257,
  "address": "Strada Alba Iulia 2",
  "distanceMeters": 420
}
```

Place `category` is one of (PLAN 8.1):
`restaurant`, `cafe`, `bar`, `fast_food`, `club`, `pharmacy`, `supermarket`, `park`, `attraction`, `atm`.

---

## Users — PLAN task 4

### `GET /users/username-available?username=stefan` — public

Called by the sign-up screen before creating the account.

```json
{ "username": "stefan", "available": false }
```

`400 INVALID_USERNAME` if the format is wrong.

### `GET /users/me`

```json
{
  "id": "8b0f6c1e-2d3a-4f5b-9c7d-1e2f3a4b5c6d",
  "username": "stefan",
  "reliabilityScore": 115,
  "createdAt": "2026-11-13T15:20:00Z"
}
```

### `PATCH /users/me`

Request:

```json
{ "username": "stefan_tm" }
```

Answer: same as `GET /users/me`. Errors: `400 INVALID_USERNAME`, `409 USERNAME_TAKEN`.

### `GET /users/search?q=ste`

Username prefix, case-insensitive, max 20, sorted by username. `q` is required and must not be blank (`400 VALIDATION_FAILED`).

```json
[
  { "id": "8b0f6c1e-2d3a-4f5b-9c7d-1e2f3a4b5c6d", "username": "stefan", "reliabilityScore": 115 },
  { "id": "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d", "username": "stella_99", "reliabilityScore": 90 }
]
```

### `GET /users/{id}`

Public profile. `attendedEvents`: events with status `ATTENDED`, newest first, max 20.
`organizedEvents`: this user's own events that are already over (end, or start + 3 h), newest first, max 20 — with their ratings, so others can judge the organiser.

```json
{
  "id": "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d",
  "username": "stella_99",
  "reliabilityScore": 90,
  "createdAt": "2026-11-13T16:02:00Z",
  "attendedEvents": [ { "...": "EventSummary" } ],
  "organizedEvents": [ { "...": "EventSummary" } ]
}
```

### `GET /users/me/events` — PLAN 5.8

`joined`: events I am in (any status except `CANCELLED`), with my status. `organizing`: events I created. Both sorted by `startsAt`.

```json
{
  "joined": [
    { "event": { "...": "EventSummary" }, "status": "JOINED" },
    { "event": { "...": "EventSummary" }, "status": "ATTENDED" }
  ],
  "organizing": [ { "...": "EventSummary" } ]
}
```

### `GET /users/{id}/reliability` — PLAN 6.4

Score and the 20 most recent changes.

```json
{
  "reliabilityScore": 90,
  "entries": [
    {
      "pointsChange": -10,
      "reason": "NO_SHOW",
      "eventId": "3f1c2a9e-5b7d-4e2a-9c41-8d6f0b2e7a15",
      "eventTitle": "Board games night",
      "createdAt": "2026-11-14T21:05:00Z"
    }
  ]
}
```

`reason` is `ATTENDED`, `NO_SHOW`, `LATE_CANCEL` or `EVENT_RATING` (the organiser's points from the event's average rating, from -5 to +5). `eventId` / `eventTitle` are `null` if the event was deleted.

---

## Events — PLAN tasks 5 and 6

### `GET /events` — public

Query (all optional): `q` (title search), `category` (repeatable), `from`, `to` (ISO times; `from` defaults to now, so past events are hidden), `bbox`, `source`, `page`, `size`. Sorted by `startsAt`.
With `bbox`, events without coordinates are left out.

Answer: paged list of **EventSummary**.

### `GET /events/{id}` — public

`myStatus` is the caller's participation status (`null` if not joined, cancelled, or no token). A banned caller sees `BANNED` so the app can explain why joining is blocked.
`participantCount` counts `JOINED` + `ATTENDED`.

```json
{
  "id": "3f1c2a9e-5b7d-4e2a-9c41-8d6f0b2e7a15",
  "source": "USER",
  "title": "Board games night",
  "description": "Bring your favourite game. Beginners welcome.",
  "category": "GAMES",
  "venueName": "Scârț Loc Lejer",
  "address": "Strada Mărășești 1",
  "lat": 45.7489,
  "lon": 21.2318,
  "startsAt": "2026-11-14T17:00:00Z",
  "endsAt": "2026-11-14T21:00:00Z",
  "imageUrl": null,
  "priceMin": null,
  "priceMax": null,
  "externalUrl": null,
  "capacity": 12,
  "spotsLeft": 4,
  "participantCount": 8,
  "organizer": { "id": "8b0f6c1e-2d3a-4f5b-9c7d-1e2f3a4b5c6d", "username": "stefan", "reliabilityScore": 115 },
  "myStatus": "JOINED",
  "averageRating": 4.5,
  "reviewCount": 2
}
```

For `EXTERNAL` events: `organizer` is `null`, `externalUrl` links to the ticket page, `capacity`/`spotsLeft` are `null`.

### `POST /events`

Request (`description`, `address`, `endsAt`, `capacity` optional):

```json
{
  "title": "Board games night",
  "description": "Bring your favourite game. Beginners welcome.",
  "category": "GAMES",
  "venueName": "Scârț Loc Lejer",
  "address": "Strada Mărășești 1",
  "lat": 45.7489,
  "lon": 21.2318,
  "startsAt": "2026-11-14T17:00:00Z",
  "endsAt": "2026-11-14T21:00:00Z",
  "capacity": 12
}
```

Rules: `venueName` is required for a user event; `startsAt` in the future; `endsAt` after `startsAt`; `capacity` ≥ 1. Answer: `201` with the event detail.

### `PATCH /events/{id}`

Organiser only. Any subset of the `POST` fields. Omitted fields stay unchanged. Send `null` to clear `description`, `address`, `endsAt`, or `capacity` (unlimited spots); required fields and coordinates cannot be cleared. `capacity` cannot go below the current participant count. A changed `startsAt` must be in the future. Answer: event detail. Errors: `400 VALIDATION_FAILED`, `403 NOT_ORGANIZER`, `403 EXTERNAL_EVENT`.

### `DELETE /events/{id}`

Organiser only. Answer: `204`. Participants lose nothing.

### `POST /events/{id}/join`

Answer `201`:

```json
{ "eventId": "3f1c2a9e-5b7d-4e2a-9c41-8d6f0b2e7a15", "status": "JOINED", "qrToken": "6e2b9a4c-0f1d-4c3e-8b7a-5d9f2e1c0a3b" }
```

Errors: `409 EVENT_FULL`, `409 ALREADY_JOINED`, `409 IS_ORGANIZER`, `409 EVENT_ENDED`, `403 BANNED`, `403 EXTERNAL_EVENT`.
Someone who left (`CANCELLED`) can join again; they keep their old `qrToken`.

### `DELETE /events/{id}/join`

Leave the event. Late-cancel penalty applies if the event starts in less than 2 hours.

```json
{ "status": "CANCELLED", "pointsChange": -2, "reliabilityScore": 113 }
```

`pointsChange` is `0` when there is no penalty. Errors: `409 NOT_JOINED`, `409 EVENT_ENDED`.

### `GET /events/{id}/participants`

Any signed-in user. Everyone except `CANCELLED`, ordered by `joinedAt`.

```json
[
  {
    "user": { "id": "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d", "username": "stella_99", "reliabilityScore": 90 },
    "status": "JOINED",
    "joinedAt": "2026-11-13T18:40:00Z"
  }
]
```

### `POST /events/{id}/participants/{userId}/ban`

Organiser only. Bans a `JOINED` participant, frees the spot, and prevents rejoining. An already checked-in participant cannot be banned (`409 ALREADY_CHECKED_IN`); a cancelled, already banned, or unknown participant answers `404 NOT_FOUND`.

```json
{ "userId": "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d", "status": "BANNED" }
```

### `GET /events/{id}/my-ticket` — PLAN 6.1

The app draws `qrToken` as a QR code. **The QR code contains only the `qrToken` string.**

```json
{ "eventId": "3f1c2a9e-5b7d-4e2a-9c41-8d6f0b2e7a15", "qrToken": "6e2b9a4c-0f1d-4c3e-8b7a-5d9f2e1c0a3b", "status": "JOINED" }
```

`status` is `JOINED`, `ATTENDED` or `NO_SHOW` (the ticket stays readable after the event). Errors: `409 NOT_JOINED` (never joined, or left), `403 BANNED`, `404 NOT_FOUND` (unknown event).

### `POST /events/{id}/check-in` — PLAN 6.2

Organiser scans a participant's QR code. Request:

```json
{ "token": "6e2b9a4c-0f1d-4c3e-8b7a-5d9f2e1c0a3b" }
```

Answer:

```json
{
  "user": { "id": "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d", "username": "stella_99", "reliabilityScore": 95 },
  "status": "ATTENDED",
  "pointsChange": 5
}
```

Errors: `403 NOT_ORGANIZER`, `403 EXTERNAL_EVENT`, `404 TICKET_NOT_FOUND` (unknown token, or scanned text that is not a ticket), `409 WRONG_EVENT`, `409 ALREADY_CHECKED_IN`, `403 BANNED`, `409 NOT_JOINED` (the participant left), `409 EVENT_ENDED` (after the event's end, or start + 3 h without an end time), `400 VALIDATION_FAILED` (blank token).
Scanning the same ticket twice never adds points twice.

### `GET /events/{id}/reviews` — public (token optional)

Every review with its author (most recently updated first), the average, and the caller's own state. The app polls it every 10 s so ratings show up live.

```json
{
  "averageRating": 4.5,
  "reviewCount": 2,
  "reviews": [
    {
      "reviewer": { "id": "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d", "username": "stella_99", "reliabilityScore": 95 },
      "rating": 5,
      "comment": "Great crowd, well organised.",
      "createdAt": "2026-11-14T19:10:00Z",
      "updatedAt": "2026-11-14T19:12:00Z"
    }
  ],
  "reviewsCloseAt": "2026-11-15T21:00:00Z",
  "settled": false,
  "canReview": true,
  "myReview": { "...": "same shape as one review, or null" }
}
```

`reviewsCloseAt` is the event's end (or start + 3 h) + 24 h; `null` for imported events. `settled` turns `true` once the organiser's rating points were applied. `canReview` is `true` only for a signed-in caller who was checked in (`ATTENDED`), is not the organiser, while reviews are open.

### `PUT /events/{id}/reviews/me`

Creates or replaces the caller's review. Request:

```json
{ "rating": 4, "comment": "Nice, but it started 30 minutes late." }
```

`rating` is a whole number 1–5. `comment` is optional (blank = none), at most 300 characters. Answer: the saved review (shape above).
Errors: `400 VALIDATION_FAILED`, `403 NOT_ATTENDED` (not checked in), `403 EXTERNAL_EVENT`, `409 IS_ORGANIZER`, `409 REVIEWS_CLOSED`, `404 NOT_FOUND`.

**Organiser rating settlement.** A backend job (every 5 minutes) settles each user event once its reviews close: with reviews, the organiser gets `round((average − 3) × 2.5)` points (rounded away from zero; at least +1 above 3 stars, at least −1 at 3 stars or less), logged as `EVENT_RATING`. 5★ → +5, 4★ → +3, 3★ → −1, 2★ → −3, 1★ → −5. No reviews → no change. Each event is settled exactly once.

---

## Places — PLAN task 8

### `GET /places` — public

Query (all optional): `category` (repeatable or comma-separated, e.g. `category=cafe&category=bar` or `category=cafe,bar`), `bbox`, `near` + `radius` (meters, default 1500, max 10000; `radius` without `near` is a `400`), `q` (part of the name, case-insensitive), `page`, `size`.
With `near`, only places within `radius` are returned, closest first, with `distanceMeters`; otherwise sorted by name and `distanceMeters` is `null`. Filters combine (AND).

Answer: paged list of **PlaceSummary**. Errors: `400 VALIDATION_FAILED` for an unknown category (the message lists the valid ones) or a malformed `bbox` / `near` / `radius`.

### `GET /places/{id}` — public

`openingHours` is OpenStreetMap's raw text (or `null`). `tags` holds only these OpenStreetMap tags, when present: `cuisine`, `website`, `contact:website`, `phone`, `contact:phone`, `email`, `wheelchair`, `outdoor_seating`, `takeaway`, `delivery`, `diet:vegetarian`, `diet:vegan`, `brand`, `operator`, `description`. Errors: `404 NOT_FOUND`, `400 VALIDATION_FAILED` for a non-UUID id.

```json
{
  "id": "c2d4e6f8-1a3b-4c5d-8e9f-0a1b2c3d4e5f",
  "osmId": "node/2845091337",
  "name": "Pizzeria Napoli",
  "category": "restaurant",
  "lat": 45.7537,
  "lon": 21.2257,
  "address": "Strada Alba Iulia 2",
  "openingHours": "Mo-Su 11:00-23:00",
  "tags": { "cuisine": "pizza", "website": "https://example.ro", "phone": "+40 256 000 000" }
}
```

---

## Transit (STPT) — PLAN task 9

All public. `stale: true` means STPT did not answer and this is the last cached value.

### `GET /transit/routes`

`type` is `TRAM`, `TROLLEYBUS`, `BUS`, `EXPRESS`, `METROPOLITAN` or `BOAT`. Sorted by type (trams first), then by line number.
`from` / `to` are the line's two end stations (either can be `null`). `color` is STPT's line colour for drawing on the map (`null` when STPT has none).

```json
[
  { "id": "1", "type": "TRAM", "name": "1", "from": "Gara de Nord", "to": "Piața Gh. Domășneanu (AEM)", "color": "#e3a900" }
]
```

### `GET /transit/stops?bbox=...`

`bbox` optional (all stops without it).

```json
[
  { "id": "1", "name": "Dâmbovița (Ion Barac)", "lat": 45.74015, "lon": 21.19611, "routes": ["2", "8"] }
]
```

### `GET /transit/vehicles?route=1`

`route` is optional. With it: the vehicles of that one line. Without it: every live vehicle of every line in one answer, with `"route": null` at the top level (one STPT call, shared by all clients for 10 s, so polling every 10 s is fine).
Each vehicle carries its line: `route` is the line id (same as `GET /transit/routes` `id`), `routeName` the name to show (e.g. `"1"`, `"E2"`), `type` and `color` as in `GET /transit/routes`. `type` / `color` are `null` when the line is not in STPT's line list (or that list could not be loaded); `route` / `routeName` are then STPT's own line name, and both are `null` when STPT reports a vehicle without a line. If STPT's line list fails with nothing cached, it is not asked for again for 60 s (vehicles and shapes come back without STPT's type/colour meanwhile).
Refresh every 10 s on the map.

```json
{
  "route": "1",
  "updatedAt": "2026-11-14T18:00:05Z",
  "stale": false,
  "vehicles": [
    {
      "id": "1010",
      "route": "1",
      "routeName": "1",
      "type": "TRAM",
      "color": "#e3a900",
      "lat": 45.73853,
      "lon": 21.22507,
      "bearing": 20.2,
      "speedKmh": 10,
      "headsign": "Gara de Nord",
      "nextStop": "Memorandumului",
      "accessible": true,
      "reportedAt": "2026-11-14T18:00:01Z"
    }
  ]
}
```

### `GET /transit/shapes?route=1`

The drawn path of every line, for map overlays. `route` is optional (only that line; case-insensitive; unknown line gives `[]`).
`polylines` are Google encoded polylines, precision 5 (decode with `frontend/src/lib/polyline.ts`), one per direction/variant of the line.
Built from the STPT GTFS file (`shapes.txt`; trips without a shape are drawn through their stops in order). Each `shapes.txt` path is simplified with Douglas-Peucker at 5 m (the bundled feed: 41,729 points down to about 9,700) so the map stays smooth; stop-sequence paths are sent as they are. `type` / `color` come from STPT's line list, or from the GTFS file when that list is down (then express/metropolitan lines show as `BUS`; that GTFS-only answer is reused for 5 minutes, then rebuilt with STPT's line facts). The app draws each line in its own colour from a fixed palette (by line id), not STPT's `color`, since STPT gives every line of a vehicle type the same colour.
Sorted like `GET /transit/routes`. Kept in memory: it only changes when the GTFS file does. `[]` when the backend has no GTFS file (`infra/otp/get-data.sh`). All lines are about 45 KB (simplified; about 130 KB before), so fetch it once per app session.

```json
[
  {
    "route": "1",
    "routeName": "1",
    "type": "TRAM",
    "color": "#e3a900",
    "polylines": ["_p~iF~ps|U_ulLnnqC", "..."]
  }
]
```

### `GET /transit/stops/{id}/arrivals`

`live: false` means the time comes from the timetable, not a vehicle's position. Sorted soonest first.
`stopName` is `null` only when STPT's stop list could not be loaded. Errors: `404 NOT_FOUND` for an unknown stop.

```json
{
  "stopId": "1",
  "stopName": "Dâmbovița (Ion Barac)",
  "updatedAt": "2026-11-14T18:00:05Z",
  "stale": false,
  "arrivals": [
    { "route": "2", "headsign": "Shopping City", "arrivesAt": "2026-11-14T18:04:00Z", "minutes": 4, "live": true }
  ]
}
```

### `GET /transit/alerts`

```json
[
  { "id": "A155", "title": "Tram traffic diverted in Piața Traian", "description": "Until the end of the year, trams run on diverted routes: ..." }
]
```

### `GET /transit/last-departures?stopId=1`

`source` is `TIMETABLE` (from the GTFS file) or `LIVE_ESTIMATE` (fallback, last arrival seen live — PLAN 9.6).
Normally `TIMETABLE`: the last scheduled departure of each line and direction on today's service day (lines that already left are still listed; compare `lastDepartureAt` with now). `LIVE_ESTIMATE` only when the backend has no timetable file or it does not cover today: then it is the latest of the next few live arrivals, **not** the real end of service.

```json
{
  "stopId": "1",
  "stopName": "Dâmbovița (Ion Barac)",
  "source": "TIMETABLE",
  "departures": [
    { "route": "2", "headsign": "Shopping City", "lastDepartureAt": "2026-11-14T21:41:00Z" }
  ]
}
```

### `GET /transit/summary?near=45.7537,21.2257`

The home page line. `message` is ready to show (Romanian when `Accept-Language` starts with `ro`, otherwise English). `near` is required.
`nextArrival` is the soonest arrival at the nearest stop (`minutes` from now, `live` = tracked vehicle). `last: true` means the timetable has no later trip of that line (same direction) today; it is only set when `lastDepartures` comes from the timetable. The message then says it is the last one ("Last tram 9 at … arrives at 22:52 (in 2 min). It's the last one today."); otherwise "Next tram 2 at … arrives at 21:41 (in 4 min)".
When no arrival is known (or STPT's arrivals are down) `nextArrival` is `null` and the message names the line from `lastDepartures` that stops earliest among those still running; when all have left it says there are no more departures tonight; with no departures at all it says none are known. If alerts cannot be loaded, `activeAlerts` is `0`.

```json
{
  "nearestStop": { "id": "1", "name": "Dâmbovița (Ion Barac)", "distanceMeters": 230 },
  "nextArrival": { "route": "2", "headsign": "Shopping City", "arrivesAt": "2026-11-14T19:45:00Z", "minutes": 4, "live": true, "last": false },
  "lastDepartures": [
    { "route": "2", "headsign": "Shopping City", "lastDepartureAt": "2026-11-14T21:41:00Z" }
  ],
  "activeAlerts": 1,
  "message": "Next tram 2 at Dâmbovița (Ion Barac) arrives at 21:45 (in 4 min)"
}
```

---

## Routing — PLAN task 10

### `GET /routes/plan?from=45.7537,21.2257&to=45.7489,21.2318&mode=TRANSIT`

`mode` is `WALK` or `TRANSIT` (walking + public transport). Optional `departAt` (ISO time, default now).
Returns the route that arrives first. The answer's `mode` is what the route really uses: a `TRANSIT` request with no trip found (e.g. at night) answers the walking route with `mode: "WALK"`.
`fallback: true` means OpenTripPlanner was unavailable (or found no walking route) and this is a straight-line walking estimate (`legs[0].polyline` is then just the two points).
`polyline` is a Google encoded polyline (as OpenTripPlanner returns it); the app decodes it to draw the line.
Leg `mode` is `WALK`, `TRAM`, `TROLLEYBUS` or `BUS`; `route` and `headsign` are `null` for walking.

```json
{
  "mode": "TRANSIT",
  "durationMinutes": 18,
  "distanceMeters": 3400,
  "startsAt": "2026-11-14T18:02:00Z",
  "endsAt": "2026-11-14T18:20:00Z",
  "fallback": false,
  "legs": [
    {
      "mode": "WALK",
      "route": null,
      "headsign": null,
      "from": { "name": "Start", "lat": 45.7537, "lon": 21.2257 },
      "to": { "name": "Piața Libertății", "lat": 45.7550, "lon": 21.2280 },
      "startsAt": "2026-11-14T18:02:00Z",
      "endsAt": "2026-11-14T18:06:00Z",
      "durationMinutes": 4,
      "polyline": "a~l~Fjk~uOwHJy@P"
    },
    {
      "mode": "TRAM",
      "route": "1",
      "headsign": "Gara de Nord",
      "from": { "name": "Piața Libertății", "lat": 45.7550, "lon": 21.2280 },
      "to": { "name": "Gara de Nord", "lat": 45.7505, "lon": 21.2075 },
      "startsAt": "2026-11-14T18:08:00Z",
      "endsAt": "2026-11-14T18:20:00Z",
      "durationMinutes": 12,
      "polyline": "u~l~Fjk~uOwHJy@Pq@d@"
    }
  ]
}
```

Errors: `400 VALIDATION_FAILED` (bad coordinates), `503 SOURCE_UNAVAILABLE` only for `TRANSIT` (walking always answers).

---

## AI assistant — PLAN task 11

### `POST /ai/chat`

Nothing is stored. The app sends the whole conversation (max 20 messages, oldest dropped first); "New chat" clears it in the app.
`location` is optional (`null` if permission was denied).

Request:

```json
{
  "messages": [
    { "role": "user", "content": "Where can I eat a cheap pizza near me with good reviews?" }
  ],
  "location": { "lat": 45.7537, "lon": 21.2257 }
}
```

Answer — `reply` is plain text (no markdown) in the user's language (Romanian or English). `places` and `events` are the ones named in `reply`, in the order they appear, for cards and "show on map" (`places[].distanceMeters` is from the user, or from Piața Victoriei when `location` is `null`). `sources` are the pages the quoted prices come from (stored price list, PLAN 11.3). `routes` are the routes the assistant planned for this answer (PLAN 18), one per route, for route cards: `from` / `to` (`lat`, `lon`, `name` — `"Your location"` for the user, otherwise the place or event the tools returned within ~75 m, or `null`), `mode` (`WALK` | `TRANSIT`, what the route really uses), `durationMinutes`, `distanceMeters`, and `startsFromUser`. `startsFromUser` is `true` only when the request carried `location` **and** the route starts there (no start given, or one within ~50 m of the user); it is `false` for a route from another place and always `false` when `location` is `null`. The app shows the **Go** button only when it is `true`. The same route planned twice is listed once. Lists are empty, never `null`.

```json
{
  "reply": "- 5 to go: 127 m away (2 min walk). Espresso about 5 lei. Open until 19:00.\nPrices may have changed.",
  "places": [ { "...": "PlaceSummary" } ],
  "events": [],
  "sources": [ { "title": "5 to go prices (playtech.ro)", "url": "https://playtech.ro/..." } ],
  "routes": [
    {
      "from": { "lat": 45.7537, "lon": 21.2257, "name": "Your location" },
      "to": { "lat": 45.7546, "lon": 21.2266, "name": "5 to go" },
      "mode": "WALK",
      "durationMinutes": 2,
      "distanceMeters": 127,
      "startsFromUser": true
    }
  ]
}
```

**Off-topic requests (PLAN 19):** the assistant answers only about Timișoara (places, food and drinks, events, public transport, the city) and directions. Anything else (code, maths/homework, essays, translations, general knowledge, general chat) gets a normal `200` answer whose `reply` is one short sentence, in the user's language, saying what it can help with; `places`, `events` and `sources` (and `routes`, once PLAN 18 adds it) are empty. There is no special error code, so the app shows it like any other answer. A mixed message gets the city part answered and the rest declined in one sentence.

Takes 2–10 s (the model may call several tools). Errors: `400 VALIDATION_FAILED` (empty `messages`, a `role` other than `user`/`assistant`, a message over 2000 characters, or the last message not from the user) (there is no per-user request limit), `503 AI_UNAVAILABLE` (Gemini down or busy; the message says to try again in a minute).
