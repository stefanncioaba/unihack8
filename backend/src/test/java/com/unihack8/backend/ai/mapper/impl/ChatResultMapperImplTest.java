package com.unihack8.backend.ai.mapper.impl;

import static org.assertj.core.api.Assertions.assertThat;

import com.unihack8.backend.ai.domain.ToolContext;
import com.unihack8.backend.ai.domain.dto.ChatResponse;
import com.unihack8.backend.ai.domain.dto.ChatRouteDto;
import com.unihack8.backend.ai.domain.dto.LeaveNowDto;
import com.unihack8.backend.ai.domain.dto.RoutePointDto;
import com.unihack8.backend.common.geo.GeoPoint;
import com.unihack8.backend.events.domain.dto.EventSummary;
import com.unihack8.backend.places.domain.dto.PlaceSummaryDto;
import com.unihack8.backend.places.domain.dto.PriceDto;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/** Picking the places/events a reply names (PLAN 11.5). */
class ChatResultMapperImplTest {

    private final ChatResultMapperImpl mapper = new ChatResultMapperImpl();

    // Bold names select the cards, in reply order; markdown is removed; price sources are listed once.
    @Test
    void boldNamesInReplyOrder() {
        ToolContext context = context();
        ChatResponse response = mapper.toResponse(
                "Try **Starbucks** (8.90 lei) or **5 to go** (5 lei). Cafea is cheap at `home`.", context);

        assertThat(response.reply()).isEqualTo("Try Starbucks (8.90 lei) or 5 to go (5 lei). Cafea is cheap at home.");
        assertThat(response.places()).extracting(PlaceSummaryDto::name).containsExactly("Starbucks", "5 to go");
        assertThat(response.sources()).extracting(s -> s.url())
                .containsExactly("https://glovoapp.com/starbucks", "https://playtech.ro/5togo");
        assertThat(response.sources().getFirst().title()).isEqualTo("Starbucks prices (glovoapp.com)");
        // "Cafea" is a place too, but it was not bold, so it is not a card.
        assertThat(response.places()).extracting(PlaceSummaryDto::name).doesNotContain("Cafea");
    }

    // Without any bold text, whole-word name matches are used; short names never match.
    @Test
    void plainTextFallback() {
        ToolContext context = context();
        ChatResponse response = mapper.toResponse("5 to go has espresso; the Starbucksy shop does not exist.", context);
        assertThat(response.places()).extracting(PlaceSummaryDto::name).containsExactly("5 to go");
    }

    // Events are matched the same way, even when the model shortens the bold title.
    @Test
    void events() {
        ToolContext context = context();
        EventSummary event = new EventSummary(UUID.randomUUID(), "EXTERNAL", "Jazz Night at Scârț", "CONCERT",
                "Scârț", 45.75, 21.23, Instant.parse("2026-11-14T18:00:00Z"), null, null, null, null, null, null, null, 0);
        context.rememberEvent(event);
        ChatResponse response = mapper.toResponse("Go to **Jazz Night** on Saturday.", context);
        assertThat(response.events()).containsExactly(event);
        assertThat(response.places()).isEmpty();
    }

    // Nothing remembered or mentioned gives empty lists, never null.
    @Test
    void nothingMentioned() {
        ChatResponse response = mapper.toResponse("I can only help with Timisoara.", context());
        assertThat(response.places()).isEmpty();
        assertThat(response.events()).isEmpty();
        assertThat(response.sources()).isEmpty();
        assertThat(response.routes()).isEmpty();
        assertThat(response.cost()).isNull();
    }

    // The cost box covers only the recommended (card) places, with stored prices; two cafes are alternatives.
    @Test
    void costFromRecommendedPlacesOnly() {
        ChatResponse response = mapper.toResponse("Try **Starbucks** or **5 to go** for an espresso.", context());
        assertThat(response.cost()).isNotNull();
        assertThat(response.cost().basis()).isEqualTo("OPTIONS");
        assertThat(response.cost().items()).extracting(i -> i.label()).containsExactly("Starbucks", "5 to go");
        assertThat(response.cost().averageTotalLei()).isEqualTo(5.0);

        // A price only in the model text (Cafea has none stored) never makes a cost box.
        assertThat(mapper.toResponse("**Cafea**: espresso about 6 lei.", context()).cost()).isNull();
    }

    // The cost box gets each place's position, so an item is matched only in what is said about that place.
    @Test
    void costMatchesItemsPerPlace() {
        ToolContext context = new ToolContext(null, Instant.parse("2026-11-14T10:00:00Z"));
        PriceDto espresso = new PriceDto("Espresso", "COFFEE", new BigDecimal("5.00"), null, "official", null, null, null);
        PriceDto cappuccino = new PriceDto("Cappuccino", "COFFEE", new BigDecimal("9.00"), null, "official", null, null, null);
        context.rememberPlace(place("Cafe Alpha"), List.of(espresso, cappuccino));
        context.rememberPlace(place("Cafe Beta"), List.of(espresso, cappuccino));

        ChatResponse response = mapper.toResponse("**Cafe Alpha**: espresso 5 lei. **Cafe Beta**: cappuccino 9 lei.", context);
        assertThat(response.cost().items()).extracting(i -> i.detail()).containsExactly("Espresso", "Cappuccino");
        assertThat(response.cost().averageTotalLei()).isEqualTo(7.0);
    }

    // Routes take the names of the closest place/event; the user start is "Your location" (PLAN 18.2).
    @Test
    void routesNamedAfterToolResults() {
        GeoPoint user = new GeoPoint(45.7560, 21.2290);
        ToolContext context = new ToolContext(user, Instant.parse("2026-11-14T10:00:00Z"));
        context.rememberPlace(place("Starbucks"), List.of()); // at 45.75, 21.22
        EventSummary event = new EventSummary(UUID.randomUUID(), "USER", "Board games", "OTHER", "Club",
                45.7400, 21.2400, Instant.parse("2026-11-14T18:00:00Z"), null, null, null, null, null, null, null, 0);
        context.rememberEvent(event);
        GeoPoint nearStarbucks = new GeoPoint(45.7502, 21.2201); // about 25 m away
        context.rememberRoute(new ToolContext.PlannedRoute(user, nearStarbucks, "WALK", 14, 1100, true));
        context.rememberRoute(new ToolContext.PlannedRoute(nearStarbucks, new GeoPoint(45.7400, 21.2400), "TRANSIT", 20, 2600, false));
        context.rememberRoute(new ToolContext.PlannedRoute(user, new GeoPoint(45.70, 21.30), "WALK", 90, 8000, true));

        List<ChatRouteDto> routes = mapper.toResponse("Walk to **Starbucks**.", context).routes();

        assertThat(routes).hasSize(3);
        assertThat(routes.get(0).from()).isEqualTo(new RoutePointDto(45.7560, 21.2290, "Your location"));
        assertThat(routes.get(0).to().name()).isEqualTo("Starbucks");
        assertThat(routes.get(0).startsFromUser()).isTrue();
        assertThat(routes.get(1).from().name()).isEqualTo("Starbucks");
        assertThat(routes.get(1).to().name()).isEqualTo("Board games");
        assertThat(routes.get(1).startsFromUser()).isFalse();
        assertThat(routes.get(1).mode()).isEqualTo("TRANSIT");
        // Nothing the tools returned is near this point: no name.
        assertThat(routes.get(2).to().name()).isNull();
    }

    // The same route planned twice is listed once (the last plan wins); other modes stay separate.
    @Test
    void sameRouteListedOnce() {
        GeoPoint user = new GeoPoint(45.7560, 21.2290);
        GeoPoint to = new GeoPoint(45.7400, 21.2400);
        ToolContext context = new ToolContext(user, Instant.parse("2026-11-14T10:00:00Z"));
        context.rememberRoute(new ToolContext.PlannedRoute(user, to, "TRANSIT", 20, 2600, true));
        context.rememberRoute(new ToolContext.PlannedRoute(user, to, "WALK", 30, 2200, true));
        context.rememberRoute(new ToolContext.PlannedRoute(user, to, "TRANSIT", 19, 2600, true));

        List<ChatRouteDto> routes = mapper.toResponse("ok", context).routes();
        assertThat(routes).extracting(ChatRouteDto::mode).containsExactly("WALK", "TRANSIT");
        assertThat(routes.get(1).durationMinutes()).isEqualTo(19);
    }

    // A route's "leave now" reaches the route card unchanged; routes without one keep null.
    @Test
    void leaveNowReachesTheRouteCard() {
        GeoPoint user = new GeoPoint(45.7560, 21.2290);
        Instant now = Instant.parse("2026-11-14T10:00:00Z");
        LeaveNowDto leave = new LeaveNowDto("1", "TRAM", "Gara de Nord", "Piața Libertății", 4,
                now.plusSeconds(540), now.plusSeconds(240), LeaveNowDto.SOURCE_LIVE, null);
        ToolContext context = new ToolContext(user, now);
        context.rememberRoute(new ToolContext.PlannedRoute(user, new GeoPoint(45.74, 21.24), "TRANSIT", 20, 2600, true, leave));
        context.rememberRoute(new ToolContext.PlannedRoute(user, new GeoPoint(45.74, 21.24), "WALK", 30, 2200, true));

        List<ChatRouteDto> routes = mapper.toResponse("ok", context).routes();
        assertThat(routes.get(0).leaveNow()).isEqualTo(leave);
        assertThat(routes.get(1).leaveNow()).isNull();
    }

    // Three remembered places, two with prices.
    private static ToolContext context() {
        ToolContext context = new ToolContext(null, Instant.parse("2026-11-14T10:00:00Z"));
        context.rememberPlace(place("Starbucks"), List.of(price("https://glovoapp.com/starbucks")));
        context.rememberPlace(place("5 to go"), List.of(price("https://playtech.ro/5togo"), price("https://playtech.ro/5togo")));
        context.rememberPlace(place("Cafea"), List.of());
        return context;
    }

    // Minimal place summary.
    private static PlaceSummaryDto place(String name) {
        return new PlaceSummaryDto(UUID.randomUUID(), "node/" + name.hashCode(), name, "cafe", 45.75, 21.22, null, 100);
    }

    // Minimal price row.
    private static PriceDto price(String url) {
        return new PriceDto("Espresso", "COFFEE", new BigDecimal("5.00"), null, "delivery_app", url, "2026-11", null);
    }
}
