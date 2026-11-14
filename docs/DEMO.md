# Demo (PLAN 17.2, 17.3, 17.6)

Everything runs on one laptop; phones open the app in Expo Go on the same Wi-Fi. No deployment. The app always uses the real backend (there is no mock mode), so the laptop must be running before anyone opens the app.

## Setup checklist (17.2) — demo morning

1. **Wi-Fi:** laptop and both phones on the same network. Note the laptop's IPv4 (`ipconfig`, Wi-Fi adapter).
2. **Routing server:** `cd infra/otp && docker compose up -d otp` (build the graph first if needed, see `infra/otp/README.md`). Check `http://localhost:8081/`.
3. **Backend with a fresh events import:** from `backend/`
   `./gradlew bootRun --args='--spring.profiles.active=local --events.import.enabled=true'`
   Wait for `Started BackendApplication`. From a phone browser, `http://<ip>:8080/test` must answer `401` (reachable, security on).
4. **App:** `frontend/.env` has `EXPO_PUBLIC_API_URL=http://<ip>:8080` plus the Supabase URL and key. `cd frontend && npx expo start`, then scan the QR code on both phones.
5. **Accounts:** on phone A sign up as the organiser, on phone B as the participant (real e-mail + password; "confirm e-mail" is off, so it is instant).
6. **Content:** on phone A create one or two events through **Create event**, starting about 30 minutes later, with a few spots and a location near the venue.
7. **Quick test:** ask the AI "where can I drink cheap coffee near me and how much will it cost?". It should answer in a few seconds with prices. If it says it is busy (Gemini free-tier quota), wait a minute.

## Full walkthrough on two phones (17.3)

1. Phone B: Home → upcoming events → open phone A's event → **Join** (spots go down).
2. Phone B: **My ticket** shows the QR code.
3. Phone A: event → **Scan tickets** → scan phone B's QR → "Checked in", +5 points.
4. Phone B: Profile → the score went up; the history shows "Attended".
5. No-show: phone B joins a second event and does not check in. After the event ends, the no-show job (runs every few minutes) takes −10 points.
6. Phone B: AI tab → "Where can I eat a cheap pizza near me?", then tap a result card → **Show on map**.
7. Map → tap the place → **Directions** → **Walk + transit** shows the tram/bus steps and the time.

## 3-minute pitch script (17.6)

| Time | Say | Show |
|---|---|---|
| 0:00–0:20 | "Timișoara has great places, events and trams, but the information is scattered across ten apps. We put it in one." | Home: transit strip ("Next tram 2 at … arrives at 21:45 (in 4 min)", or "… It's the last one today."), upcoming events. |
| 0:20–0:50 | "Everything is on one live map." | Map: category chips (cafés), tap a café; **Transit** chip → line 1 vehicles moving; tap a stop → next arrivals and last departure. |
| 0:50–1:30 | "Ask it like a local friend." | AI: "where can I drink cheap coffee near me and how much will it cost?" → prices in lei, distances, cards → **Show on map** → **Directions** by tram. |
| 1:30–2:30 | "Events with limited spots need people who actually come. Reliability points make no-shows visible." | Phone B joins phone A's event → ticket QR → phone A scans it → score +5. Show a profile with its history; mention −10 for no-shows and the organiser's ban button. |
| 2:30–3:00 | "Real data: OpenStreetMap places, live STPT transit, LiveTickets events, researched menu prices, our own routing server. Built in a weekend." | Profile, then back to the map. |

**Backup recording:** record the walkthrough above with the phones' screen recorders the evening before. Play it if the venue Wi-Fi blocks phone-to-laptop traffic.

## If something fails during the demo

| Symptom | Cause | Fix |
|---|---|---|
| Red "You're offline" banner | Phone lost Wi-Fi | Reconnect; data refreshes by itself. |
| "Cannot reach the server" | Laptop IP changed or firewall | Check `ipconfig`, update `.env`, restart Expo; allow Java on private networks. |
| Directions only offer walking | OTP not running, or the timetable has expired (after 2026-12-31) | `docker compose up -d otp`; refresh the timetable (`infra/otp/README.md`). |
| "The assistant is busy" | Gemini free-tier per-minute quota | Wait a minute; avoid asking several questions in a row. |
