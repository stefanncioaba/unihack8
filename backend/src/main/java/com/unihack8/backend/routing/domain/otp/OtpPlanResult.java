package com.unihack8.backend.routing.domain.otp;

import java.util.List;

/**
 * JSON returned by OpenTripPlanner's GraphQL API for our planConnection query
 * (only the fields we ask for). Times are ISO offset date-times, durations in seconds.
 */
public record OtpPlanResult(Data data, List<GraphQlError> errors) {

    /** GraphQL "data" object. */
    public record Data(PlanConnection planConnection) {
    }

    /** One GraphQL error message. */
    public record GraphQlError(String message) {
    }

    /** The planConnection result: itineraries wrapped in edges. */
    public record PlanConnection(List<Edge> edges) {
    }

    /** Wrapper around one itinerary. */
    public record Edge(Itinerary node) {
    }

    /** A complete trip from start to destination. */
    public record Itinerary(String start, String end, Long duration, List<Leg> legs) {
    }

    /** One part of an itinerary (walking or riding one vehicle). */
    public record Leg(
            String mode,
            String headsign,
            Double duration,
            Double distance,
            Place from,
            Place to,
            LegTime start,
            LegTime end,
            Route route,
            Geometry legGeometry) {
    }

    /** A named point (stop or start/end label). */
    public record Place(String name, Double lat, Double lon) {
    }

    /** Scheduled time of a leg's start or end. */
    public record LegTime(String scheduledTime) {
    }

    /** Public transport line. */
    public record Route(String shortName) {
    }

    /** Encoded polyline of a leg. */
    public record Geometry(String points) {
    }
}
