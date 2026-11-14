package com.unihack8.backend.ai.domain;

import static org.assertj.core.api.Assertions.assertThat;

import com.unihack8.backend.common.geo.GeoPoint;
import java.time.Instant;
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
}
