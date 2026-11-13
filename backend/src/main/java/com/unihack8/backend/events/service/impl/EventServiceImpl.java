package com.unihack8.backend.events.service.impl;

import com.unihack8.backend.common.dto.PageParams;
import com.unihack8.backend.common.dto.PageResponse;
import com.unihack8.backend.common.exception.ApiException;
import com.unihack8.backend.common.exception.ErrorCode;
import com.unihack8.backend.common.geo.BoundingBox;
import com.unihack8.backend.events.domain.dto.*;
import com.unihack8.backend.events.domain.entity.Event;
import com.unihack8.backend.events.domain.entity.EventParticipant;
import com.unihack8.backend.events.mapper.EventMapper;
import com.unihack8.backend.events.repository.EventRepository;
import com.unihack8.backend.events.repository.ParticipationRepository;
import com.unihack8.backend.events.service.EventService;
import com.unihack8.backend.users.repository.ProfileRepository;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Applies the task-5 rules while the repositories handle database persistence. */
@Service
public class EventServiceImpl implements EventService {
    private static final Set<String> CATEGORIES = Set.of("PARTY", "CONCERT", "THEATRE", "SPORT",
            "GAMES", "FOOD", "ART", "MEETUP", "OTHER");
    private final EventRepository events;
    private final ParticipationRepository participants;
    private final ProfileRepository profiles;
    private final EventMapper mapper;
    private final Clock clock;

    // Coordinates event storage, participant state, profile reads, and time-dependent rules.
    public EventServiceImpl(EventRepository events, ParticipationRepository participants,
            ProfileRepository profiles, EventMapper mapper, Clock clock) {
        this.events = events;
        this.participants = participants;
        this.profiles = profiles;
        this.mapper = mapper;
        this.clock = clock;
    }

    // Filters public events, defaulting to upcoming start times.
    @Override
    @Transactional(readOnly = true)
    public PageResponse<EventSummary> search(String q, List<String> category, Instant from, Instant to,
            String bbox, String source, Integer page, Integer size) {
        Instant start = from == null ? clock.instant() : from;
        if (to != null && to.isBefore(start)) {
            throw invalid("to must not be before from.");
        }
        List<String> categories = category == null ? List.of() : category.stream()
                .flatMap(value -> Arrays.stream(value.split(",", -1)))
                .map(value -> validCategory(value.trim())).toList();
        String sourceFilter = source == null ? null : source.trim().toUpperCase(Locale.ROOT);
        if (sourceFilter != null && !Set.of("USER", "EXTERNAL").contains(sourceFilter)) {
            throw invalid("source must be USER or EXTERNAL.");
        }
        BoundingBox box = bbox == null ? null : BoundingBox.parse(bbox, "bbox");
        EventSearchCriteria criteria = new EventSearchCriteria(trim(q), categories, start, to, box, sourceFilter);
        PageParams params = box == null ? PageParams.of(page, size) : PageParams.forMap(page, size);
        Page<Event> result = events.search(criteria, params.toPageable(Sort.by("startsAt", "id")));
        Map<UUID, Integer> counts = events.activeCounts(result.getContent().stream().map(Event::id).toList());
        return PageResponse.of(result, e -> mapper.summary(e, counts.getOrDefault(e.id(), 0)));
    }

    // Returns event detail, counts, organizer identity, and the caller's own status.
    @Override
    @Transactional(readOnly = true)
    public EventDetail detail(UUID id, Optional<UUID> caller) {
        Event event = required(id);
        return detailOf(event, caller);
    }

    // Creates a user event after validating time, location and capacity.
    @Override
    @Transactional
    public EventDetail create(UUID caller, CreateEventRequest request) {
        if (request == null) throw invalid("An event body is required.");
        validate(request.title(), request.category(), request.venueName(), request.lat(), request.lon(),
                request.startsAt(), request.endsAt(), request.capacity());
        if (!request.startsAt().isAfter(clock.instant())) throw invalid("startsAt must be in the future.");
        if (!profiles.existsById(caller)) throw ApiException.notFound("User");
        Event event = new Event(UUID.randomUUID(), "USER", null, request.title().trim(), trim(request.description()),
                validCategory(request.category()), request.venueName().trim(), trim(request.address()),
                request.lat(), request.lon(), request.startsAt(), request.endsAt(), request.capacity(), caller,
                null, null, null, null, clock.instant());
        events.insert(event);
        return detailOf(event, Optional.of(caller));
    }

    // Updates editable fields while holding the event lock and respecting occupied spots.
    @Override
    @Transactional
    public EventDetail update(UUID id, UUID caller, UpdateEventRequest request) {
        Event old = editable(id, caller);
        if (request == null || request.fields() == null) throw invalid("An event body is required.");
        if (!Set.of("title", "description", "category", "venueName", "address", "lat", "lon",
                "startsAt", "endsAt", "capacity").containsAll(request.fields().keySet())) {
            throw invalid("Event update contains an unknown field.");
        }
        Event updated = new Event(old.id(), old.source(), old.externalId(),
                request.has("title") ? string(request.value("title"), "title") : old.title(),
                request.has("description") ? string(request.value("description"), "description") : old.description(),
                request.has("category") ? string(request.value("category"), "category") : old.category(),
                request.has("venueName") ? string(request.value("venueName"), "venueName") : old.venueName(),
                request.has("address") ? string(request.value("address"), "address") : old.address(),
                request.has("lat") ? number(request.value("lat"), "lat") : old.lat(),
                request.has("lon") ? number(request.value("lon"), "lon") : old.lon(),
                request.has("startsAt") ? time(request.value("startsAt"), "startsAt") : old.startsAt(),
                request.has("endsAt") ? time(request.value("endsAt"), "endsAt") : old.endsAt(),
                request.has("capacity") ? integer(request.value("capacity"), "capacity") : old.capacity(),
                old.organizerId(), old.imageUrl(), old.priceMin(), old.priceMax(), old.externalUrl(), old.createdAt());
        validate(updated.title(), updated.category(), updated.venueName(), updated.lat(), updated.lon(),
                updated.startsAt(), updated.endsAt(), updated.capacity());
        if (request.has("startsAt") && !updated.startsAt().isAfter(clock.instant())) {
            throw invalid("startsAt must be in the future.");
        }
        if (updated.capacity() != null && updated.capacity() < events.activeCount(id)) {
            throw invalid("capacity cannot be below the current participant count.");
        }
        events.update(updated);
        return detailOf(updated, Optional.of(caller));
    }

    // Deletes a user event; the schema cascades participation without a penalty.
    @Override
    @Transactional
    public void delete(UUID id, UUID caller) {
        editable(id, caller);
        events.delete(id);
    }

    // Locks the event row so concurrent last-spot joins cannot both succeed.
    @Override
    @Transactional
    public JoinResponse join(UUID id, UUID caller) {
        Event event = events.lock(id).orElseThrow(() -> ApiException.notFound("Event"));
        requireUserEvent(event);
        if (caller.equals(event.organizerId())) throw new ApiException(ErrorCode.IS_ORGANIZER);
        if (!clock.instant().isBefore(event.startsAt())) throw new ApiException(ErrorCode.EVENT_ENDED);
        EventParticipant existing = participants.find(id, caller).orElse(null);
        if (existing != null) {
            if ("BANNED".equals(existing.status())) throw new ApiException(ErrorCode.BANNED);
            if (!"CANCELLED".equals(existing.status())) throw new ApiException(ErrorCode.ALREADY_JOINED);
        }
        if (event.capacity() != null && events.activeCount(id) >= event.capacity()) {
            throw new ApiException(ErrorCode.EVENT_FULL);
        }
        UUID token;
        if (existing == null) {
            token = UUID.randomUUID();
            participants.insert(new EventParticipant(id, caller, "JOINED", token, clock.instant(), null));
        } else {
            token = existing.qrToken();
            participants.status(id, caller, "JOINED");
        }
        return new JoinResponse(id, "JOINED", token);
    }

    // Cancels a live join and deducts two points only within two hours of the start.
    @Override
    @Transactional
    public LeaveResponse leave(UUID id, UUID caller) {
        Event event = events.lock(id).orElseThrow(() -> ApiException.notFound("Event"));
        requireUserEvent(event);
        if (!clock.instant().isBefore(effectiveEnd(event))) throw new ApiException(ErrorCode.EVENT_ENDED);
        EventParticipant participant = participants.find(id, caller).orElse(null);
        if (participant == null || !"JOINED".equals(participant.status())) {
            throw new ApiException(ErrorCode.NOT_JOINED);
        }
        participants.status(id, caller, "CANCELLED");
        int points = Duration.between(clock.instant(), event.startsAt()).compareTo(Duration.ofHours(2)) < 0 ? -2 : 0;
        int score = points == 0 ? profile(caller).getReliabilityScore()
                : participants.changeReliability(caller, id, points, "LATE_CANCEL", clock.instant());
        return new LeaveResponse("CANCELLED", points, score);
    }

    // Lists non-cancelled people in join order, with current profile scores.
    @Override
    @Transactional(readOnly = true)
    public List<ParticipantResponse> participants(UUID id) {
        required(id);
        return participants.participants(id).stream()
                .map(p -> new ParticipantResponse(mapper.user(profile(p.userId())), p.status(), p.joinedAt()))
                .toList();
    }

    // Bans a joined participant, freeing their place without changing points.
    @Override
    @Transactional
    public BanResponse ban(UUID id, UUID organizer, UUID userId) {
        editable(id, organizer);
        EventParticipant participant = participants.find(id, userId).orElseThrow(() -> ApiException.notFound("Participant"));
        if ("ATTENDED".equals(participant.status())) {
            throw new ApiException(ErrorCode.ALREADY_CHECKED_IN, "Checked-in participants cannot be banned.");
        }
        if (!"JOINED".equals(participant.status())) throw ApiException.notFound("Participant");
        participants.status(id, userId, "BANNED");
        return new BanResponse(userId, "BANNED");
    }

    // Returns non-cancelled joins and the caller's organized events, sorted by start time.
    @Override
    @Transactional(readOnly = true)
    public MyEventsResponse mine(UUID caller) {
        List<MyEventsResponse.JoinedEvent> joined = participants.joinedBy(caller).stream().map(p -> {
            Event event = required(p.eventId());
            return new MyEventsResponse.JoinedEvent(mapper.summary(event, events.activeCount(event.id())), p.status());
        }).toList();
        List<EventSummary> organizing = events.organizedBy(caller).stream()
                .map(e -> mapper.summary(e, events.activeCount(e.id()))).toList();
        return new MyEventsResponse(joined, organizing);
    }

    // Fetches an event or gives the shared 404 response.
    private Event required(UUID id) {
        return events.find(id).orElseThrow(() -> ApiException.notFound("Event"));
    }

    // Locks and authorizes an organizer-only edit.
    private Event editable(UUID id, UUID caller) {
        Event event = events.lock(id).orElseThrow(() -> ApiException.notFound("Event"));
        requireUserEvent(event);
        if (!caller.equals(event.organizerId())) throw new ApiException(ErrorCode.NOT_ORGANIZER);
        return event;
    }

    // Imported events are read-only and ticketed on their source site.
    private void requireUserEvent(Event event) {
        if (!"USER".equals(event.source())) throw new ApiException(ErrorCode.EXTERNAL_EVENT);
    }

    // Combines counts, organizer and caller-specific state in the detail response.
    private EventDetail detailOf(Event event, Optional<UUID> caller) {
        UserSummary organizer = !"USER".equals(event.source()) || event.organizerId() == null
                ? null : mapper.user(profile(event.organizerId()));
        String status = caller.flatMap(id -> participants.find(event.id(), id)).map(EventParticipant::status)
                .filter(value -> !"CANCELLED".equals(value) && !"BANNED".equals(value)).orElse(null);
        return mapper.detail(event, events.activeCount(event.id()), organizer, status);
    }

    // Reads a profile required by an event response.
    private com.unihack8.backend.users.domain.entity.Profile profile(UUID userId) {
        return profiles.findById(userId).orElseThrow(() -> ApiException.notFound("User"));
    }

    // Rejects invalid event fields before the database constraints do.
    private void validate(String title, String category, String venue, Double lat, Double lon,
            Instant starts, Instant ends, Integer capacity) {
        if (title == null || title.isBlank()) throw invalid("title must not be blank.");
        validCategory(category);
        if (venue == null || venue.isBlank()) throw invalid("venueName must not be blank.");
        if (lat == null || lon == null || !Double.isFinite(lat) || !Double.isFinite(lon)
                || lat < -90 || lat > 90 || lon < -180 || lon > 180) throw invalid("lat and lon must be valid coordinates.");
        if (starts == null) throw invalid("startsAt is required.");
        if (ends != null && !ends.isAfter(starts)) throw invalid("endsAt must be after startsAt.");
        if (capacity != null && capacity < 1) throw invalid("capacity must be at least 1.");
    }

    // Normalizes and validates the event category against docs/API.md.
    private String validCategory(String value) {
        String normalized = value == null ? "" : value.toUpperCase(Locale.ROOT);
        if (!CATEGORIES.contains(normalized)) throw invalid("category must be one of " + CATEGORIES + ".");
        return normalized;
    }

    // Trims optional text and preserves null for missing values.
    private String trim(String value) {
        return value == null ? null : value.trim();
    }

    // Reads a text PATCH field without coercing objects or numbers.
    private String string(Object value, String field) {
        if (value == null) return null;
        if (!(value instanceof String text)) throw invalid(field + " must be text.");
        return text.trim();
    }

    // Reads a finite coordinate from a PATCH body.
    private Double number(Object value, String field) {
        if (value == null) return null;
        if (!(value instanceof Number number)) throw invalid(field + " must be a number.");
        return number.doubleValue();
    }

    // Reads an integer capacity without accepting fractions.
    private Integer integer(Object value, String field) {
        if (value == null) return null;
        if (!(value instanceof Number number) || number.doubleValue() % 1 != 0
                || number.longValue() > Integer.MAX_VALUE || number.longValue() < Integer.MIN_VALUE) {
            throw invalid(field + " must be an integer.");
        }
        return number.intValue();
    }

    // Parses an ISO timestamp supplied in a PATCH body.
    private Instant time(Object value, String field) {
        if (value == null) return null;
        if (!(value instanceof String text)) throw invalid(field + " must be an ISO timestamp.");
        try {
            return Instant.parse(text);
        } catch (java.time.format.DateTimeParseException error) {
            throw invalid(field + " must be an ISO timestamp.");
        }
    }

    // Missing end times count as three hours after the start.
    private Instant effectiveEnd(Event event) {
        return event.endsAt() == null ? event.startsAt().plus(Duration.ofHours(3)) : event.endsAt();
    }

    // Creates a contract-compatible 400 response.
    private ApiException invalid(String message) {
        return new ApiException(ErrorCode.VALIDATION_FAILED, message);
    }
}
