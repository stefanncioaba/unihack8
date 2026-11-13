# API contract

All endpoints return JSON. Send a Supabase access token in `Authorization: Bearer <token>` for the user endpoints below. IDs are UUIDs; timestamps use ISO 8601 UTC. The backend reads the caller's user ID from the verified token's `sub` claim.

## Users and profiles (PLAN 4)

### `GET /users/me`

Returns the caller's profile, including attended events.

```json
{
  "id": "11111111-1111-1111-1111-111111111111",
  "username": "alex_21",
  "reliabilityScore": 100,
  "createdAt": "2026-11-13T10:00:00Z",
  "attendedEvents": [
    { "id": "22222222-2222-2222-2222-222222222222", "title": "Community meetup", "startsAt": "2026-11-12T18:00:00Z" }
  ]
}
```

### `PATCH /users/me`

Request:

```json
{ "username": "alex_new" }
```

Username must contain 3–20 ASCII letters, digits, or underscores. It is unique without regard to case. Returns the updated profile in the same shape as `GET /users/me`.

### `GET /users/search?q=alex`

Case-insensitive username prefix search. `q` must contain at least one character. Returns at most 20 entries, ordered by username.

```json
[
  { "id": "11111111-1111-1111-1111-111111111111", "username": "alex_21", "reliabilityScore": 100 }
]
```

### `GET /users/{id}`

Returns the public profile in the same shape as `GET /users/me`.

## Errors

```json
{ "code": "USERNAME_TAKEN", "message": "Username is already taken" }
```

The user endpoints use `400 INVALID_INPUT`, `401 UNAUTHORIZED` for a missing or invalid token, `404 USER_NOT_FOUND`, and `409 USERNAME_TAKEN`. Contracts for PLAN 5–11 are still pending under PLAN 1.6.
