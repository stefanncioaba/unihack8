package com.unihack8.backend.help.service.impl;

import com.unihack8.backend.common.exception.ApiException;
import com.unihack8.backend.common.exception.ErrorCode;
import com.unihack8.backend.common.geo.BoundingBox;
import com.unihack8.backend.common.geo.GeoPoint;
import com.unihack8.backend.events.domain.dto.UserSummary;
import com.unihack8.backend.events.repository.ParticipationRepository;
import com.unihack8.backend.help.domain.HelpRules;
import com.unihack8.backend.help.domain.dto.CreateHelpRequest;
import com.unihack8.backend.help.domain.dto.HelpRequestDetail;
import com.unihack8.backend.help.domain.dto.HelpRequestSummary;
import com.unihack8.backend.help.domain.dto.HelpTicketResponse;
import com.unihack8.backend.help.domain.dto.MyHelpResponse;
import com.unihack8.backend.help.domain.dto.WithdrawResponse;
import com.unihack8.backend.help.domain.entity.HelpOffer;
import com.unihack8.backend.help.domain.entity.HelpRequest;
import com.unihack8.backend.help.domain.entity.HelpRequestView;
import com.unihack8.backend.help.mapper.HelpMapper;
import com.unihack8.backend.help.repository.HelpOfferRepository;
import com.unihack8.backend.help.repository.HelpRequestRepository;
import com.unihack8.backend.help.service.HelpService;
import com.unihack8.backend.reliability.domain.ReliabilityRules;
import com.unihack8.backend.reliability.domain.dto.CheckInResponse;
import com.unihack8.backend.users.domain.entity.Profile;
import com.unihack8.backend.users.repository.ProfileRepository;
import java.time.Clock;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import com.unihack8.backend.users.service.SkillService;
import com.unihack8.backend.users.domain.dto.SkillResponse;
import com.unihack8.backend.help.domain.entity.HelpOfferView;
import java.util.Locale;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Help board rules. Every change locks the request row first (like join and check-in lock the event
 * row), so an offer, a withdrawal, a cancel and a scan of the same request run one after the other and
 * only the first scanned helper closes it. Points go through the events feature's
 * {@link ParticipationRepository#changeReliability}, the single place that changes a score.
 */
@Service
public class HelpServiceImpl implements HelpService {

    // How many open requests are read before sorting by distance.
    private static final int NEAR_CANDIDATES = 200;

    private final HelpRequestRepository requests;
    private final HelpOfferRepository offers;
    private final ParticipationRepository participations;
    private final ProfileRepository profiles;
    private final HelpMapper mapper;
    private final SkillService skills;
    private final Clock clock;

    // Reuses the events feature's reliability writer and the users feature's profiles.
    public HelpServiceImpl(HelpRequestRepository requests, HelpOfferRepository offers,
                           ParticipationRepository participations, ProfileRepository profiles, HelpMapper mapper,
                           SkillService skills, Clock clock) {
        this.requests = requests;
        this.offers = offers;
        this.participations = participations;
        this.profiles = profiles;
        this.mapper = mapper;
        this.skills = skills;
        this.clock = clock;
    }

    // Newest first; with `near`, nearest first and requests without a location last; `bbox` filters first.
    @Override
    @Transactional(readOnly = true)
    public List<HelpRequestSummary> board(UUID caller, GeoPoint near, BoundingBox bbox) {
        Instant now = clock.instant();
        if (near == null) {
            return requests.openRequests(now, caller, bbox, HelpRules.BOARD_LIMIT).stream()
                    .map(v -> mapper.toSummary(v, now)).toList();
        }
        return requests.openRequests(now, caller, bbox, NEAR_CANDIDATES).stream()
                .sorted(Comparator.comparingDouble(v -> distance(v, near)))
                .limit(HelpRules.BOARD_LIMIT)
                .map(v -> mapper.toSummary(v, now)).toList();
    }

    // Both lists newest first, at most 20 each.
    @Override
    @Transactional(readOnly = true)
    public MyHelpResponse mine(UUID caller) {
        Instant now = clock.instant();
        return new MyHelpResponse(
                requests.requestedBy(caller, HelpRules.MINE_LIMIT).stream().map(v -> mapper.toSummary(v, now)).toList(),
                requests.offeredBy(caller, HelpRules.MINE_LIMIT).stream().map(v -> mapper.toSummary(v, now)).toList());
    }

    // Validates the body, then saves an OPEN request that expires 24 h from now.
    @Override
    @Transactional
    public HelpRequestDetail create(UUID caller, CreateHelpRequest body) {
        if (body == null) {
            throw new ApiException(ErrorCode.VALIDATION_FAILED, "The request body is missing.");
        }
        String title = trimToNull(body.title());
        if (title == null || title.length() < HelpRules.TITLE_MIN || title.length() > HelpRules.TITLE_MAX) {
            throw invalid("Title must be " + HelpRules.TITLE_MIN + "-" + HelpRules.TITLE_MAX + " characters.");
        }
        String description = trimToNull(body.description());
        if (description != null && description.length() > HelpRules.DESCRIPTION_MAX) {
            throw invalid("Description must be at most " + HelpRules.DESCRIPTION_MAX + " characters.");
        }
        String category = body.category() == null ? null : body.category().trim().toUpperCase(Locale.ROOT);
        if (category == null || !HelpRules.CATEGORIES.contains(category)) {
            throw invalid("Category must be one of " + String.join(", ", HelpRules.CATEGORY_ORDER) + ".");
        }
        String address = trimToNull(body.address());
        if (address != null && address.length() > HelpRules.ADDRESS_MAX) {
            throw invalid("Address must be at most " + HelpRules.ADDRESS_MAX + " characters.");
        }
        validateLocation(body.lat(), body.lon());
        profiles.findById(caller).orElseThrow(() -> ApiException.notFound("User"));
        Instant now = clock.instant();
        UUID id = UUID.randomUUID();
        requests.insert(new HelpRequest(id, caller, title, description, category, address, body.lat(), body.lon(),
                HelpRules.OPEN, now, HelpRules.expiresAt(now), null, null));
        return detail(id, caller);
    }

    // Readable in every status, also after it expired.
    @Override
    @Transactional(readOnly = true)
    public HelpRequestDetail detail(UUID id, UUID caller) {
        HelpRequestView view = requests.findView(id, caller).orElseThrow(() -> ApiException.notFound("Help request"));
        List<HelpOfferView> list = offers.offers(id);
        Map<UUID, List<SkillResponse>> helperSkills = skills.skillsOf(list.stream().map(o -> o.offer().helperId()).toList());
        return mapper.toDetail(view, list, helperSkills, caller, clock.instant());
    }

    // Requester only, while open; nobody's points change.
    @Override
    @Transactional
    public HelpRequestDetail cancel(UUID id, UUID caller) {
        HelpRequest request = lock(id);
        if (!caller.equals(request.requesterId())) {
            throw new ApiException(ErrorCode.NOT_REQUESTER);
        }
        Instant now = clock.instant();
        requireOpen(request, now);
        if (requests.cancel(id, now) == 0) {
            throw new ApiException(ErrorCode.HELP_CLOSED);
        }
        return detail(id, caller);
    }

    // New offer with a fresh QR token, or a withdrawn offer made current again (same token).
    @Override
    @Transactional
    public HelpTicketResponse offer(UUID id, UUID caller) {
        HelpRequest request = lock(id);
        if (caller.equals(request.requesterId())) {
            throw new ApiException(ErrorCode.IS_REQUESTER);
        }
        Instant now = clock.instant();
        requireOpen(request, now);
        HelpOffer existing = offers.find(id, caller).orElse(null);
        if (existing == null) {
            profiles.findById(caller).orElseThrow(() -> ApiException.notFound("User"));
            HelpOffer created = new HelpOffer(id, caller, HelpRules.OFFERED, UUID.randomUUID(), now, null);
            offers.insert(created);
            return new HelpTicketResponse(id, created.qrToken(), HelpRules.OFFERED);
        }
        if (!HelpRules.WITHDRAWN.equals(existing.status())) {
            throw new ApiException(ErrorCode.ALREADY_OFFERED);
        }
        offers.changeStatus(id, caller, HelpRules.WITHDRAWN, HelpRules.OFFERED);
        return new HelpTicketResponse(id, existing.qrToken(), HelpRules.OFFERED);
    }

    // Only a current offer on an open request can be withdrawn; free.
    @Override
    @Transactional
    public WithdrawResponse withdraw(UUID id, UUID caller) {
        HelpRequest request = lock(id);
        requireOpen(request, clock.instant());
        if (offers.changeStatus(id, caller, HelpRules.OFFERED, HelpRules.WITHDRAWN) == 0) {
            throw new ApiException(ErrorCode.NOT_OFFERED);
        }
        return new WithdrawResponse(id, HelpRules.WITHDRAWN);
    }

    // The QR token while the caller has an offer (also after it was HELPED or NOT_NEEDED).
    @Override
    @Transactional(readOnly = true)
    public HelpTicketResponse myTicket(UUID id, UUID caller) {
        requests.findView(id, caller).orElseThrow(() -> ApiException.notFound("Help request"));
        HelpOffer offer = offers.find(id, caller)
                .filter(o -> !HelpRules.WITHDRAWN.equals(o.status()))
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_OFFERED));
        return new HelpTicketResponse(id, offer.qrToken(), offer.status());
    }

    // First valid scan wins: helper HELPED (+5), others NOT_NEEDED (0), request HELPED.
    @Override
    @Transactional
    public CheckInResponse checkIn(UUID id, UUID caller, String token) {
        HelpRequest request = lock(id);
        if (!caller.equals(request.requesterId())) {
            throw new ApiException(ErrorCode.NOT_REQUESTER);
        }
        Instant now = clock.instant();
        requireOpen(request, now);
        HelpOffer offer = offers.findByToken(parseToken(token))
                .orElseThrow(() -> new ApiException(ErrorCode.TICKET_NOT_FOUND));
        if (!id.equals(offer.requestId())) {
            throw new ApiException(ErrorCode.WRONG_REQUEST);
        }
        if (HelpRules.WITHDRAWN.equals(offer.status())) {
            throw new ApiException(ErrorCode.NOT_OFFERED, "This helper withdrew their offer.");
        }
        if (offers.markHelped(id, offer.helperId(), now) == 0 || requests.close(id, offer.helperId(), now) == 0) {
            throw new ApiException(ErrorCode.HELP_CLOSED);
        }
        offers.markOthersNotNeeded(id, offer.helperId());
        int score = participations.changeReliability(offer.helperId(), null, ReliabilityRules.HELPED_POINTS,
                ReliabilityRules.HELPED_REASON, now);
        Profile helper = profiles.findById(offer.helperId()).orElseThrow(() -> ApiException.notFound("User"));
        return new CheckInResponse(new UserSummary(helper.getId(), helper.getUsername(), score), HelpRules.HELPED,
                ReliabilityRules.HELPED_POINTS);
    }

    // Locks the request or answers 404.
    private HelpRequest lock(UUID id) {
        return requests.lock(id).orElseThrow(() -> ApiException.notFound("Help request"));
    }

    // 409 HELP_CLOSED when the request was helped, cancelled or has expired.
    private static void requireOpen(HelpRequest request, Instant now) {
        if (!HelpRules.isOpen(request.status(), request.expiresAt(), now)) {
            throw new ApiException(ErrorCode.HELP_CLOSED);
        }
    }

    // lat and lon are both missing, or both set and on Earth.
    private static void validateLocation(Double lat, Double lon) {
        if (lat == null && lon == null) {
            return;
        }
        if (lat == null || lon == null) {
            throw invalid("Give both lat and lon, or neither.");
        }
        try {
            new GeoPoint(lat, lon);
        } catch (IllegalArgumentException e) {
            throw invalid("lat/lon are outside valid coordinates.");
        }
    }

    // Distance from `near`, or infinity for requests without a location (so they sort last).
    private static double distance(HelpRequestView view, GeoPoint near) {
        HelpRequest r = view.request();
        return r.lat() == null || r.lon() == null ? Double.POSITIVE_INFINITY
                : near.distanceMetersTo(new GeoPoint(r.lat(), r.lon()));
    }

    // The scanned text must be a UUID; anything else is not one of our tickets.
    private static UUID parseToken(String token) {
        try {
            return UUID.fromString(token == null ? "" : token.trim());
        } catch (IllegalArgumentException e) {
            throw new ApiException(ErrorCode.TICKET_NOT_FOUND);
        }
    }

    // Trimmed text, or null when blank.
    private static String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    // 400 VALIDATION_FAILED with a readable message.
    private static ApiException invalid(String message) {
        return new ApiException(ErrorCode.VALIDATION_FAILED, message);
    }
}
