package com.unihack8.backend.ai.domain;

import static org.assertj.core.api.Assertions.assertThat;

import com.unihack8.backend.common.geo.GeoPoint;
import com.unihack8.backend.places.domain.dto.PlaceSummaryDto;
import com.unihack8.backend.places.domain.dto.PriceDto;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/** When a route counts as starting from the user (PLAN 18.3). */
class ToolContextTest {

    private static final Instant NOW = Instant.parse("2026-11-14T16:00:00Z");
    // Near the Opera, a few hundred metres from the city-centre default.
    private static final GeoPoint USER = new GeoPoint(45.7560, 21.2290);

    // Real location and no start point given: the route starts at the user.
    @Test
    void noStartWithLocationIsTheUser() {
        assertThat(new ToolContext(USER, NOW).startsFromUser(null)).isTrue();
    }

    // A start point the model gave about 30 m from the user still counts as the user.
    @Test
    void startNearTheUserIsTheUser() {
        GeoPoint thirtyMetresNorth = new GeoPoint(USER.lat() + 0.00027, USER.lon());
        assertThat(USER.distanceMetersTo(thirtyMetresNorth)).isBetween(25.0, 35.0);
        assertThat(new ToolContext(USER, NOW).startsFromUser(thirtyMetresNorth)).isTrue();
    }

    // Another place (the university, about 1 km away) is not the user; just over 50 m is not either.
    @Test
    void otherStartIsNotTheUser() {
        ToolContext context = new ToolContext(USER, NOW);
        assertThat(context.startsFromUser(new GeoPoint(45.7472, 21.2310))).isFalse();
        assertThat(context.startsFromUser(new GeoPoint(USER.lat() + 0.0005, USER.lon()))).isFalse();
    }

    // Without a location the city-centre default is used for distances, but it is never "the user".
    @Test
    void noLocationIsNeverTheUser() {
        ToolContext context = new ToolContext(null, NOW);
        assertThat(context.locationKnown()).isFalse();
        assertThat(context.startsFromUser(null)).isFalse();
        assertThat(context.startsFromUser(ToolContext.CITY_CENTRE)).isFalse();
    }

    // Routes are kept in the order they were planned.
    @Test
    void remembersRoutes() {
        ToolContext context = new ToolContext(USER, NOW);
        context.rememberRoute(new ToolContext.PlannedRoute(USER, ToolContext.CITY_CENTRE, "WALK", 12, 900, true));
        context.rememberRoute(new ToolContext.PlannedRoute(USER, new GeoPoint(45.75, 21.20), "TRANSIT", 18, 3400, true));
        assertThat(context.routes()).extracting(ToolContext.PlannedRoute::mode).containsExactly("WALK", "TRANSIT");
    }

    // The same place returned by two searches (COFFEE, then PIZZA) keeps every distinct price the model saw.
    @Test
    void mergesPricesOfAPlaceReturnedTwice() {
        ToolContext context = new ToolContext(USER, NOW);
        PlaceSummaryDto place = new PlaceSummaryDto(UUID.randomUUID(), "node/1", "Bistro", "restaurant", 45.75, 21.22,
                null, 100);
        PriceDto espresso = price("Espresso", "COFFEE", "6.00");
        PriceDto margherita = price("Margherita", "PIZZA", "32.00");
        context.rememberPlace(place, List.of(espresso));
        context.rememberPlace(place, List.of(margherita, espresso));

        assertThat(context.places()).hasSize(1);
        assertThat(context.places().getFirst().prices()).containsExactly(espresso, margherita);
    }

    // A stored menu price.
    private static PriceDto price(String item, String type, String lei) {
        return new PriceDto(item, type, new BigDecimal(lei), null, "delivery_app", null, "2026-11", null);
    }
}
