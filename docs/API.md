# API contract

The contract between the Spring backend (`backend/`) and the Expo app (`frontend/`).
The frontend builds against mock data copied from the examples below (`frontend/src/mocks/`),
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
For `VALIDATION_FAILED`, `fields` lists what is wrong: `{ "title": "must not be blank" }`.

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
| 429 | `RATE_LIMITED` | Too many AI requests; try again in a minute. |
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
  "spotsLeft": 4
}
```

`source` is `USER` or `EXTERNAL`. Event `category` is one of:
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

Username prefix, case-insensitive, max 20, best match first.

```json
[
  { "id": "8b0f6c1e-2d3a-4f5b-9c7d-1e2f3a4b5c6d", "username": "stefan", "reliabilityScore": 115 },
  { "id": "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d", "username": "stella_99", "reliabilityScore": 90 }
]
```

### `GET /users/{id}`

Public profile. `attendedEvents`: events with status `ATTENDED`, newest first, max 20.

```json
{
  "id": "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d",
  "username": "stella_99",
  "reliabilityScore": 90,
  "createdAt": "2026-11-13T16:02:00Z",
  "attendedEvents": [ { "...": "EventSummary" } ]
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

`reason` is `ATTENDED`, `NO_SHOW` or `LATE_CANCEL`. `eventId` / `eventTitle` are `null` if the event was deleted.

---

## Events — PLAN tasks 5 and 6

### `GET /events` — public

Query (all optional): `q` (title search), `category` (repeatable), `from`, `to` (ISO times; `from` defaults to now, so past events are hidden), `bbox`, `source`, `page`, `size`. Sorted by `startsAt`.
With `bbox`, events without coordinates are left out.

Answer: paged list of **EventSummary**.

### `GET /events/{id}` — public

`myStatus` is the caller's participation status (`null` if not joined or no token).
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
  "myStatus": "JOINED"
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

Rules: `startsAt` in the future; `endsAt` after `startsAt`; `capacity` ≥ 1. Answer: `201` with the event detail.

### `PATCH /events/{id}`

Organiser only. Any subset of the `POST` fields. `capacity` cannot go below the current participant count. Answer: event detail. Errors: `403 NOT_ORGANIZER`, `403 EXTERNAL_EVENT`.

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

Organiser only. Frees the spot; the user cannot join again.

```json
{ "userId": "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d", "status": "BANNED" }
```

### `GET /events/{id}/my-ticket` — PLAN 6.1

The app draws `qrToken` as a QR code. **The QR code contains only the `qrToken` string.**

```json
{ "eventId": "3f1c2a9e-5b7d-4e2a-9c41-8d6f0b2e7a15", "qrToken": "6e2b9a4c-0f1d-4c3e-8b7a-5d9f2e1c0a3b", "status": "JOINED" }
```

Errors: `409 NOT_JOINED`, `403 BANNED`.

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

Errors: `403 NOT_ORGANIZER`, `404 TICKET_NOT_FOUND`, `409 WRONG_EVENT`, `409 ALREADY_CHECKED_IN`, `403 BANNED`, `409 EVENT_ENDED`.

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

`type` is `TRAM`, `TROLLEYBUS`, `BUS`, `EXPRESS`, `METROPOLITAN` or `BOAT`.

```json
[
  { "id": "1", "type": "TRAM", "name": "1", "from": "Stația Meteo", "to": "Gara de Nord" }
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

Refresh every 10 s on the map.

```json
{
  "route": "1",
  "updatedAt": "2026-11-14T18:00:05Z",
  "stale": false,
  "vehicles": [
    {
      "id": "1010",
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

### `GET /transit/stops/{id}/arrivals`

`live: false` means the time comes from the timetable, not a vehicle's position.

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

The home page line. `message` is ready to show (Romanian or English chosen by the `Accept-Language` header, default English).

```json
{
  "nearestStop": { "id": "1", "name": "Dâmbovița (Ion Barac)", "distanceMeters": 230 },
  "lastDepartures": [
    { "route": "2", "headsign": "Shopping City", "lastDepartureAt": "2026-11-14T21:41:00Z" }
  ],
  "activeAlerts": 1,
  "message": "Last tram 2 from Dâmbovița (Ion Barac) leaves at 23:41"
}
```

---

## Routing — PLAN task 10

### `GET /routes/plan?from=45.7537,21.2257&to=45.7489,21.2318&mode=TRANSIT`

`mode` is `WALK` or `TRANSIT` (walking + public transport). Optional `departAt` (ISO time, default now).
Returns the best route. `fallback: true` means OpenTripPlanner was unavailable and this is a straight-line walking estimate (`legs[0].polyline` is then just the two points).
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

Answer — `places` and `events` are the ones mentioned in `reply`, for cards and "show on map"; `sources` are the web pages the web lookup used:

```json
{
  "reply": "Pizzeria Napoli is 420 m away; reviews mention good prices, pizzas around 30–40 lei...",
  "places": [ { "...": "PlaceSummary" } ],
  "events": [],
  "sources": [ { "title": "Pizzeria Napoli – meniu", "url": "https://example.ro/meniu" } ]
}
```

Errors: `429 RATE_LIMITED` (more than 10 requests per minute per user), `503 AI_UNAVAILABLE`.
