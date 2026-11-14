# API contract

The contract between the Spring backend (`backend/`) and the Expo app (`frontend/`).
The app always calls the real backend (PLAN 17.1); the Jest tests use a mock backend built from the examples below (`frontend/testing/mocks/`),
so **change this file first, then the code**, and tell the team when you do.

Covers PLAN tasks 4–11, 22, 24 and 25 (Neighbour Help Board). Sign-up and login are not here: the app does them directly with Supabase.

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
| 403 | `NOT_REQUESTER` | Only the person who posted the help request can do this (cancel, scan). |
| 409 | `IS_REQUESTER` | You cannot offer help on your own request. |
| 409 | `ALREADY_OFFERED` | You already offered to help with this request. |
| 409 | `NOT_OFFERED` | No current offer from you (or from the scanned helper). |
| 409 | `HELP_CLOSED` | The help request is closed: already helped, cancelled, or 24 h passed. |
| 409 | `WRONG_REQUEST` | The scanned helper ticket belongs to another help request. |
| 409 | `SKILL_EXISTS` | You already listed a skill with this name (case-insensitive). |
| 409 | `SKILL_LIMIT` | You already have 10 skills. |
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
`PARTY`, `CONCERT`, `THEATRE`, `SPORT`, `GAMES`, `FOOD`, `ART`, `MEETUP`, `VOLUNTEER`, `OTHER`.
`VOLUNTEER` marks volunteer actions (park cleanups, food drives): checking in at one gives a +5 bonus (see check-in).
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
  "createdAt": "2026-11-13T15:20:00Z",
  "attendedEvents": [ { "...": "EventSummary" } ],
  "organizedEvents": [ { "...": "EventSummary" } ],
  "skills": [ { "id": "7c1d2e3f-4a5b-4c6d-8e9f-0a1b2c3d4e5f", "name": "Carpentry", "category": "CARPENTRY" } ]
}
```

Same shape as `GET /users/{id}`. `skills` (PLAN 28): oldest first, at most 10, `[]` when none.

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
  "organizedEvents": [ { "...": "EventSummary" } ],
  "skills": [ { "id": "7c1d2e3f-4a5b-4c6d-8e9f-0a1b2c3d4e5f", "name": "Dog walking", "category": "PETS" } ]
}
```

### Skills — PLAN 28

A skill is `{ "id", "name", "category" }`: `name` is 2–40 characters (trimmed, inner spaces collapsed), `category` is one of the
Help Board categories (see `HelpRequestSummary`; sent in any case, stored upper-case). At most 10 per user; the same name only once
per user (ignoring case). Everyone sees them on `GET /users/{id}` and next to the helper's offers on `GET /help-requests/{id}`.

- `GET /users/me/skills` — my skills, oldest first.
- `POST /users/me/skills` — body `{ "name": "Carpentry", "category": "CARPENTRY" }` → `201` with the skill.
  Errors: `400 VALIDATION_FAILED`, `409 SKILL_EXISTS`, `409 SKILL_LIMIT`.
- `PATCH /users/me/skills/{id}` — same body → `200` with the skill. Errors: `400 VALIDATION_FAILED`, `404 NOT_FOUND` (not mine), `409 SKILL_EXISTS`.
- `DELETE /users/me/skills/{id}` — `204`. Errors: `404 NOT_FOUND` (not mine or already deleted).

All need a token.

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

`reason` is `ATTENDED`, `NO_SHOW`, `LATE_CANCEL`, `EVENT_RATING` (the organiser's points from the event's average rating, from -5 to +5) or `VOLUNTEER_BONUS` (+5 extra for checking in at a `VOLUNTEER` event). `eventId` / `eventTitle` are `null` if the event was deleted.

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
At a `VOLUNTEER` event `pointsChange` is `10`: +5 `ATTENDED` and +5 `VOLUNTEER_BONUS`, written as two reliability log rows.

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

## Neighbour Help Board — PLAN task 25

"Neighbours helping neighbours, with trust built in." A user posts that they need small help; other users offer to help.
The requester picks whom to trust by their civic trust score, meets them, and scans the helper's QR code.
**The first helper who is scanned closes the request.** All endpoints need a token.

Rules (see `DOCS.md` → Reliability rules):

- The scanned helper gets **+5** (`HELPED` log row; in `GET /users/{id}/reliability` its `eventId` and `eventTitle` are `null`). Nobody else's score changes: not the requester, not the other helpers.
- Withdrawing an offer and cancelling a request are free. There is no limit on how many people can offer.
- A request that nobody closed **disappears 24 hours after it was posted** (`expiresAt`): it leaves the board and can no longer be offered on or scanned. No points change.

### HelpRequestSummary

```json
{
  "id": "5d1e2f3a-4b5c-4d6e-8f70-1a2b3c4d5e6f",
  "title": "Borrow a ladder for 30 minutes",
  "category": "BORROW",
  "address": "Strada Paris 12",
  "lat": 45.7489,
  "lon": 21.2318,
  "requester": { "id": "8b0f6c1e-2d3a-4f5b-9c7d-1e2f3a4b5c6d", "username": "stefan", "reliabilityScore": 115 },
  "status": "OPEN",
  "createdAt": "2026-11-14T17:00:00Z",
  "expiresAt": "2026-11-15T17:00:00Z",
  "offerCount": 2,
  "myOffer": "OFFERED"
}
```

- `category` is one of `BORROW` (lend a tool or thing), `CARRY` (carry or move something), `PETS` (walk or feed a pet), `ERRANDS` (shopping, pick-ups), `REPAIRS` (small fixes around the home), and since PLAN 28 `CARPENTRY`, `PLUMBING`, `ELECTRICAL`, `PAINTING`, `GARDENING`, `CLEANING`, `TECH` (phones, computers), `TUTORING`, `COOKING`, `BIKES`, `CARS`, `ELDERLY` (keeping an older neighbour company), then `OTHER`. The app shows them in this order.
- `status` is `OPEN`, `HELPED` (closed by a scan), `CANCELLED` (by the requester) or `EXPIRED` (24 h passed while open).
- `address`, `lat` and `lon` are optional (`lat`/`lon` both or neither). `offerCount` counts current offers (`OFFERED` and `HELPED`).
- `myOffer` is the caller's offer status, or `null`: `OFFERED`, `WITHDRAWN`, `HELPED` (the caller was scanned) or `NOT_NEEDED` (someone else was scanned first).

### `GET /help-requests`

The board: open, not expired requests, newest first, at most 50. Optional `near=lat,lon` sorts by distance instead (requests without a location last).
Optional `bbox=minLon,minLat,maxLon,maxLat` (same format as `GET /events?bbox=`) keeps only requests **with a location inside the box** (edges included; min greater than max is a 400) — used by Neighbourhood Pulse for one area's requests; it combines with `near`.
Answer: array of `HelpRequestSummary`. Errors: `400 VALIDATION_FAILED` (bad `near` or `bbox`).

### `GET /help-requests/mine`

```json
{ "requested": [ HelpRequestSummary ], "offered": [ HelpRequestSummary ] }
```

The caller's own requests and the requests they offered on (every status, `WITHDRAWN` offers left out), newest first, at most 20 each.

### `POST /help-requests`

```json
{ "title": "Borrow a ladder for 30 minutes", "description": "Changing a bulb in the hallway.", "category": "BORROW",
  "address": "Strada Paris 12", "lat": 45.7489, "lon": 21.2318 }
```

`title` 3–80 characters, `description` optional ≤ 500, `address` optional ≤ 120, `category` from the list, `lat`/`lon` both or neither and valid.
Answer `201`: `HelpRequestDetail`. Errors: `400 VALIDATION_FAILED`.

### `GET /help-requests/{id}`

`HelpRequestDetail` = `HelpRequestSummary` plus:

```json
{
  "description": "Changing a bulb in the hallway.",
  "closedAt": null,
  "helper": null,
  "offers": [
    { "user": { "id": "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d", "username": "stella_99", "reliabilityScore": 95 },
      "status": "OFFERED", "offeredAt": "2026-11-14T17:10:00Z",
      "skills": [ { "id": "7c1d2e3f-4a5b-4c6d-8e9f-0a1b2c3d4e5f", "name": "Ladders and heights", "category": "BORROW" } ] }
  ],
  "isRequester": false,
  "canOffer": false
}
```

`helper` is the scanned helper (`UserSummary`) once `HELPED`. `offers` lists everyone who offered except withdrawn offers, oldest first,
each with that helper's profile `skills` (PLAN 28, `[]` when none) so the requester can see who fits the task.
`canOffer` is true when the request is `OPEN`, the caller is not the requester and has no current offer.
Expired and closed requests stay readable here. Errors: `404 NOT_FOUND`.

### `DELETE /help-requests/{id}`

Requester only, while `OPEN`: sets `CANCELLED` and `closedAt`. Offers keep their status (no points change for anyone). Answer: `HelpRequestDetail`.
Errors: `403 NOT_REQUESTER`, `409 HELP_CLOSED` (already helped, cancelled or expired).

### `POST /help-requests/{id}/offers`

Offer to help. Answer `201`: `{ "requestId": "…", "qrToken": "…", "status": "OFFERED" }`. Offering again after withdrawing keeps the same QR token.
Errors: `409 IS_REQUESTER`, `409 ALREADY_OFFERED`, `409 HELP_CLOSED`.

### `DELETE /help-requests/{id}/offers/me`

Withdraw an `OFFERED` offer; free. Answer: `{ "requestId": "…", "status": "WITHDRAWN" }`. Errors: `409 NOT_OFFERED`, `409 HELP_CLOSED`.

### `GET /help-requests/{id}/my-ticket`

The helper's QR code (it contains only `qrToken`): `{ "requestId": "…", "qrToken": "…", "status": "OFFERED" }`.
`status` is `OFFERED`, `HELPED` or `NOT_NEEDED`. Errors: `409 NOT_OFFERED` (never offered, or withdrew).

### `POST /help-requests/{id}/check-in`

The requester scans a helper's QR code: `{ "token": "…" }`. Answer:

```json
{
  "user": { "id": "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d", "username": "stella_99", "reliabilityScore": 100 },
  "status": "HELPED",
  "pointsChange": 5
}
```

The helper's offer becomes `HELPED`, every other offer `NOT_NEEDED` (no points), the request `HELPED` with `closedAt`.
Errors: `403 NOT_REQUESTER`, `404 TICKET_NOT_FOUND` (unknown token or not a ticket), `409 WRONG_REQUEST` (ticket of another request),
`409 NOT_OFFERED` (the helper withdrew), `409 HELP_CLOSED` (already helped — also a second scan — cancelled or expired), `400 VALIDATION_FAILED` (blank token).
Checks run in this order: blank token (400), unknown request (404), `NOT_REQUESTER`, `HELP_CLOSED`, `TICKET_NOT_FOUND`, `WRONG_REQUEST`, `NOT_OFFERED`.

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

`type` is `TRAM`, `TROLLEYBUS`, `BUS`, `EXPRESS`, `METROPOLITAN`, `SCHOOL` (STPT category `school`) or `BOAT`. Sorted by type (trams first), then by line number.
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

`route` is optional. With it: the vehicles of that one line. Without it: every live vehicle of every line in one answer, with `"route": null` at the top level (one STPT call, shared by all clients for 5 s — `stpt.ttl.vehicles`, default `5s` — so polling every 5 s is fine; when STPT does not answer the last cached value comes back with `stale: true`).
Each vehicle carries its line: `route` is the line id (same as `GET /transit/routes` `id`), `routeName` the name to show (e.g. `"1"`, `"E2"`), `type` and `color` as in `GET /transit/routes`. `type` / `color` are `null` when the line is not in STPT's line list (or that list could not be loaded); `route` / `routeName` are then STPT's own line name, and both are `null` when STPT reports a vehicle without a line. If STPT's line list fails with nothing cached, it is not asked for again for 60 s (vehicles and shapes come back without STPT's type/colour meanwhile).
Refresh every 5 s on the map; the app animates each vehicle linearly from its previous to its new position over about 4.8 s (like live.stpt.ro), and snaps instead when the previous update is more than 12 s old, the jump is over about 1 km, or the map is being panned / zoomed.

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
`variants` has one item per polyline (same order, same `polyline` string), describing it:

- `direction`: `"TUR"` (GTFS `direction_id` 0), `"RETUR"` (1), or `null` when the feed gives no direction.
- `headsign`: where that direction is heading (its terminus): the GTFS `trip_headsign`, or the name of its last stop.
- `stops`: that direction's stops in order (`{ id, name, lat, lon }`, `id` as in `GET /transit/stops`). Only with `route=`: in the all-lines answer `stops` is `null` to keep it small.

Direction, headsign and stops come from one representative trip per path (the first trip that uses that GTFS shape).
Built from the STPT GTFS file (`shapes.txt`; trips without a shape are drawn through their stops in order). Each `shapes.txt` path is simplified with Douglas-Peucker at 5 m (the bundled feed: 41,729 points down to about 9,700) so the map stays smooth; stop-sequence paths are sent as they are. `type` / `color` come from STPT's line list, or from the GTFS file when that list is down (then express/metropolitan lines show as `BUS`; that GTFS-only answer is reused for 5 minutes, then rebuilt with STPT's line facts). The app does not use STPT's `color` (STPT gives every line of a type the same colour): each line gets its own shade from its type's hue family (trams yellows, trolleybuses purples, buses teals, express oranges, school reds, metropolitan blues / greens), picked by line id.
Sorted like `GET /transit/routes`. Kept in memory: it only changes when the GTFS file does. `[]` when the backend has no GTFS file (`infra/otp/get-data.sh`).
The Map tab asks for one line at a time (`route=`) when the user picks it in the line picker, like live.stpt.ro: one direction is drawn (Tur / Retur toggle) with its stops and that line's vehicles.

```json
[
  {
    "route": "1",
    "routeName": "1",
    "type": "TRAM",
    "color": "#e3a900",
    "polylines": ["_p~iF~ps|U_ulLnnqC", "..."],
    "variants": [
      {
        "polyline": "_p~iF~ps|U_ulLnnqC",
        "direction": "TUR",
        "headsign": "Gara de Nord",
        "stops": [{ "id": "2", "name": "Gara de Nord", "lat": 45.7505, "lon": 21.2075 }]
      },
      { "polyline": "...", "direction": "RETUR", "headsign": "Piața Gh. Domășneanu (AEM)", "stops": [] }
    ]
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

## Neighbourhoods — PLAN task 24

### `GET /neighbourhoods/pulse` — public

Every Timișoara area as a live card, **busiest first** (by `score`). Areas are hard-coded circles (`id`, centre, `radiusMeters`); an event, place, stop or vehicle belongs to the nearest centre whose circle covers it. Cached for 30 s on the server. A source that is down only empties its own section: STPT down → `transit.available: false`; events or places down → zero counts. Never 503.

```json
{
  "generatedAt": "2026-11-14T18:00:00Z",
  "areas": [
    {
      "id": "cetate", "name": "Cetate", "lat": 45.7568, "lon": 21.229, "radiusMeters": 750,
      "level": "BUSY", "score": 21,
      "events": {
        "nowCount": 1, "tonightCount": 2, "freeSpots": 6,
        "highlights": [
          { "id": "…", "title": "Board games night", "category": "GAMES", "venueName": "Scârț Loc Lejer",
            "startsAt": "2026-11-14T17:00:00Z", "endsAt": "2026-11-14T21:00:00Z",
            "capacity": 12, "spotsLeft": 4, "imageUrl": null, "happeningNow": true }
        ]
      },
      "transit": { "available": true, "lines": ["1", "2", "8", "E2"], "stopCount": 5, "liveVehicles": 3,
                   "alerts": [ { "id": "A155", "title": "…", "description": "…" } ] },
      "places": { "total": 120, "openNow": 64, "topCategories": ["restaurant", "cafe"] },
      "people": { "going": 9, "reliableGoing": 7 }
    }
  ]
}
```

- `events`: **now** = started and not ended (no `endsAt` → counts as 3 h long); **tonight** = starts later, before 05:00 local time. `freeSpots` sums `spotsLeft` of limited events. `highlights`: at most 3, running ones first, then by start.
- `transit.lines`: line names of the stops inside the area; `alerts`: STPT alerts that name one of those lines after a line word ("linia 8", "tramvaiele 1 și 2") or one of the area's stop names.
- `places.openNow`: places whose OpenStreetMap opening hours say open now (unknown hours are not counted); `topCategories`: up to 3 categories with the most open places.
- `people`: different users `JOINED` or `ATTENDED` in the area's events now/tonight; `reliableGoing` = reliability score ≥ 100 (the starting score).
- `level`: `score = 4 × now + 2 × tonight + going + min(openNow / 5, 8) + min(liveVehicles, 5)`; `BUSY` from 15, `STEADY` from 5, else `QUIET`.

---

## News — PLAN task 27

Timișoara news from local news sites' RSS feeds (TION, Opinia Timișoarei, Timișoara Știri, Banatul Azi). **Timișoara only:** an article is kept when its headline, text or categories name the city ("Timișoara", "timișorean(i)", with or without diacritics); links and the site's own name do not count, and county-only news (Lugoj, "județul Timiș") is left out. Each site is read at most every 10 minutes; the app never calls the sites. Only the headline, a short summary (≤ 220 characters) and the site's picture are returned; `url` opens the full story on the site.

### `GET /news?source=tion&q=tramvai&page=0&size=20` — public

All parameters optional. `source`: one site id from `GET /news/sources` (unknown id → `400 VALIDATION_FAILED` listing the valid ids). `q`: any word of 3+ letters in the headline or summary (accents ignored). Newest first (articles without a date last); the same story on two sites is listed once (the newest: headlines sharing ≥ 60 % and at least 3 meaningful words, published within 12 h). Paged like every list (`size` ≤ 100). `503 SOURCE_UNAVAILABLE` only when no asked site can be read and nothing is cached; one site down just leaves its articles out (or shows its last cached ones).

```json
{
  "items": [
    {
      "id": "6f1c2a0e-1b7d-3c4e-9a51-2f0d8e7b6a43",
      "sourceId": "tion",
      "sourceName": "TION",
      "title": "Primăria Timișoara montează 300 de suporturi pentru biciclete",
      "summary": "Suporturile vor fi montate în tot orașul până la sfârșitul anului…",
      "url": "https://www.tion.ro/...",
      "imageUrl": "https://www.tion.ro/wp-content/uploads/....jpg",
      "publishedAt": "2026-11-14T12:21:00Z"
    }
  ],
  "page": 0, "size": 20, "totalItems": 39, "totalPages": 2
}
```

- `id`: stable, built from the article link. `imageUrl`: from the feed, else the site's WordPress featured image; `null` when there is none. `publishedAt`: `null` when the site gave no date. Only `http(s)` links and pictures are returned.

### `GET /news/sources` — public

```json
[ { "id": "tion", "name": "TION", "siteUrl": "https://www.tion.ro", "available": true, "stale": false, "articleCount": 5, "updatedAt": "2026-11-14T17:01:06Z" } ]
```

`available: false` = the site cannot be read and nothing is cached; `stale: true` = the last read failed and older articles are shown; `articleCount` = its Timișoara articles kept now.

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

`cost` is the "about how much" box the app shows under the answer, or `null` when nothing the answer recommends has a stored price. It is built by the backend, never by the model: only stored prices the tools returned for this answer (menu prices from `search_places`, event `price_min` / `price_max` from `search_events`), and only for the places/events in `places` / `events` (the recommended ones). A price that appears only in the model text never makes a box.

- `currency`: always `"RON"` (amounts in lei, rounded to 0.1).
- `items[]`: one line per recommended place/event with a stored price, in reply order: `label` (place or event name), `detail` (the item, e.g. `"Espresso"`; `"N stored prices"`; or `"Ticket"`), `kind` (`MENU` | `EVENT`; `TICKET` is reserved for stored STPT fares, PLAN 20, and not sent yet), `minLei`, `maxLei`, `averageLei` = (`minLei` + `maxLei`) / 2. A place line uses the stored prices whose item the reply names in that place's part of the reply (from its name to the next recommended name; the whole reply when it is the only recommendation). When it names none, every stored price the tools returned for that place, but only if they are all of one item type (e.g. a PIZZA search); a mixed menu (e.g. water and steak) gives no line, and the place is listed in `note` as unpriced. A place returned by several searches keeps every price the tools returned for it. An event line uses `price_min`..`price_max` (one alone counts as both).
- Totals: the lines are grouped by kind (places, events). Within a group the user picks one, so it counts with the **mean of its line averages**, its cheapest `minLei` and its dearest `maxLei`; `averageTotalLei`, `minTotalLei`, `maxTotalLei` are the **sums over the groups**. Alternatives of one kind are never summed, and a meal is never averaged with a ticket. Example: two pizzerias (36 and 44 lei) and a concert (100 lei) give ≈ 140 lei, range 136–144.
- `basis`: `TOTAL` when the answer is one plan (at most one place and at most one event, e.g. "concert, then pizza"; the totals are plain sums of the lines). `OPTIONS` when it offers alternatives (two or more places, or two or more events — the user picks one of each kind). The app labels it "Average total", "Average per option" (one kind) or "Average per plan" (alternatives plus another kind).
- `note`: short remark (saved prices may have changed; recommendations without a stored price: "Not included (price unknown): …" for `TOTAL`, "No stored price for …" for `OPTIONS`).

`routes[].leaveNow` (PLAN 26, "Leave now" box) says when to leave to catch the route's first tram/trolleybus/bus. It is `null` for walking routes, when `startsFromUser` is `false`, and for routes planned for a later time (`depart_at`). Fields: `line`, `vehicleType` (`TRAM` | `TROLLEYBUS` | `BUS`), `headsign` (or `null`), `stopName` (where to get on), `walkMinutes` (from the user to that stop), `boardAt` (when the vehicle the user can still catch reaches the stop), `leaveAt` (`boardAt` minus the walk and one spare minute; never before the answer time), `source` (`LIVE` = tracked vehicle, `TIMETABLE` = STPT's scheduled time, `PLAN` = the route planner's time because STPT's arrivals were unavailable), and `missedBoardAt` (an earlier vehicle of the same line that leaves before the user can reach the stop, or `null`). The app counts down to `leaveAt` itself.

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
      "startsFromUser": true,
      "leaveNow": null
    },
    {
      "from": { "lat": 45.7537, "lon": 21.2257, "name": "Your location" },
      "to": { "lat": 45.7505, "lon": 21.2075, "name": "Gara de Nord" },
      "mode": "TRANSIT",
      "durationMinutes": 20,
      "distanceMeters": 3400,
      "startsFromUser": true,
      "leaveNow": {
        "line": "1",
        "vehicleType": "TRAM",
        "headsign": "Gara de Nord",
        "stopName": "Piața Libertății",
        "walkMinutes": 4,
        "boardAt": "2026-11-14T18:41:00Z",
        "leaveAt": "2026-11-14T18:36:00Z",
        "source": "LIVE",
        "missedBoardAt": "2026-11-14T18:33:00Z"
      }
    }
  ],
  "cost": {
    "currency": "RON",
    "basis": "TOTAL",
    "items": [ { "label": "5 to go", "detail": "Espresso", "kind": "MENU", "minLei": 5.0, "maxLei": 5.0, "averageLei": 5.0 } ],
    "averageTotalLei": 5.0,
    "minTotalLei": 5.0,
    "maxTotalLei": 5.0,
    "note": "Saved menu prices (often from delivery apps); they may have changed."
  }
}
```

**Off-topic requests (PLAN 19):** the assistant answers only about Timișoara (places, food and drinks, events, public transport, the city) and directions. Anything else (code, maths/homework, essays, translations, general knowledge, general chat) gets a normal `200` answer whose `reply` is one short sentence, in the user's language, saying what it can help with; `places`, `events`, `sources` and `routes` are empty and `cost` is `null`. There is no special error code, so the app shows it like any other answer. A mixed message gets the city part answered and the rest declined in one sentence.

Takes 2–10 s (the model may call several tools). Errors: `400 VALIDATION_FAILED` (empty `messages`, a `role` other than `user`/`assistant`, a message over 2000 characters, or the last message not from the user) (there is no per-user request limit), `503 AI_UNAVAILABLE` (Gemini down or busy; the message says to try again in a minute).
