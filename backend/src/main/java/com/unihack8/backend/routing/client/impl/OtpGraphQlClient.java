package com.unihack8.backend.routing.client.impl;

import com.unihack8.backend.routing.client.OtpClient;
import com.unihack8.backend.routing.client.OtpUnavailableException;
import com.unihack8.backend.routing.domain.model.GeoPoint;
import com.unihack8.backend.routing.domain.model.TravelMode;
import com.unihack8.backend.routing.domain.otp.OtpPlanResult;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import tools.jackson.databind.json.JsonMapper;

/** Calls OTP 2's GTFS GraphQL API (POST /otp/gtfs/v1) with a planConnection query. */
@Component
public class OtpGraphQlClient implements OtpClient {

    static final String GRAPHQL_PATH = "/otp/gtfs/v1";

    // How many itineraries to ask for; the service keeps the one that arrives first.
    static final int ITINERARIES = 3;

    static final String PLAN_QUERY = """
            query Plan($origin: PlanLabeledLocationInput!, $destination: PlanLabeledLocationInput!,
                       $dateTime: PlanDateTimeInput, $modes: PlanModesInput, $first: Int) {
              planConnection(origin: $origin, destination: $destination, dateTime: $dateTime,
                             modes: $modes, first: $first) {
                edges {
                  node {
                    start
                    end
                    duration
                    legs {
                      mode
                      headsign
                      duration
                      distance
                      from { name lat lon }
                      to { name lat lon }
                      start { scheduledTime }
                      end { scheduledTime }
                      route { shortName }
                      legGeometry { points }
                    }
                  }
                }
              }
            }
            """;

    // Plain JSON writer for the request body (thread-safe, no Spring config needed).
    private static final JsonMapper JSON = JsonMapper.builder().build();

    private final RestClient restClient;

    // Uses the RestClient from OtpClientConfig (base URL and timeouts already set).
    public OtpGraphQlClient(@Qualifier("otpRestClient") RestClient restClient) {
        this.restClient = restClient;
    }

    // Sends the planConnection query and unwraps the itineraries.
    @Override
    public List<OtpPlanResult.Itinerary> plan(GeoPoint from, GeoPoint to, TravelMode mode, Instant departAt) {
        // Serialized to bytes here so the request has a Content-Length: OTP's server rejects
        // chunked bodies (it reads the chunk size as JSON and answers 400).
        byte[] body = JSON.writeValueAsBytes(Map.of(
                "query", PLAN_QUERY,
                "variables", variables(from, to, mode, departAt)));
        OtpPlanResult result;
        try {
            result = restClient.post()
                    .uri(GRAPHQL_PATH)
                    .contentType(MediaType.APPLICATION_JSON)
                    .accept(MediaType.APPLICATION_JSON)
                    .body(body)
                    .retrieve()
                    .body(OtpPlanResult.class);
        } catch (RestClientException e) {
            throw new OtpUnavailableException("OpenTripPlanner request failed", e);
        }
        if (result == null || result.data() == null || result.data().planConnection() == null) {
            String message = result != null && result.errors() != null && !result.errors().isEmpty()
                    ? result.errors().getFirst().message()
                    : "empty answer";
            throw new OtpUnavailableException("OpenTripPlanner error: " + message, null);
        }
        List<OtpPlanResult.Edge> edges = result.data().planConnection().edges();
        if (edges == null) {
            return List.of();
        }
        return edges.stream().map(OtpPlanResult.Edge::node).filter(Objects::nonNull).toList();
    }

    // GraphQL variables: labelled start/end, departure time and the allowed modes.
    static Map<String, Object> variables(GeoPoint from, GeoPoint to, TravelMode mode, Instant departAt) {
        String departure = DateTimeFormatter.ISO_OFFSET_DATE_TIME
                .format(departAt.truncatedTo(ChronoUnit.SECONDS).atOffset(ZoneOffset.UTC));
        return Map.of(
                "origin", location("Start", from),
                "destination", location("Destination", to),
                "dateTime", Map.of("earliestDeparture", departure),
                "modes", modes(mode),
                "first", ITINERARIES);
    }

    // PlanLabeledLocationInput for one point.
    private static Map<String, Object> location(String label, GeoPoint point) {
        return Map.of(
                "label", label,
                "location", Map.of("coordinate", Map.of("latitude", point.lat(), "longitude", point.lon())));
    }

    // PlanModesInput: walking only, or walking + tram/trolleybus/bus (direct walk still allowed for short trips).
    private static Map<String, Object> modes(TravelMode mode) {
        if (mode == TravelMode.WALK) {
            return Map.of("directOnly", true, "direct", List.of("WALK"));
        }
        return Map.of(
                "direct", List.of("WALK"),
                "transit", Map.of(
                        "access", List.of("WALK"),
                        "egress", List.of("WALK"),
                        "transfer", List.of("WALK"),
                        "transit", List.of(
                                Map.of("mode", "TRAM"),
                                Map.of("mode", "TROLLEYBUS"),
                                Map.of("mode", "BUS"))));
    }
}
