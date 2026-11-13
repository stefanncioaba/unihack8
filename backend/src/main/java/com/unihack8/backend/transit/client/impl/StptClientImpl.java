package com.unihack8.backend.transit.client.impl;

import com.unihack8.backend.transit.client.StptClient;
import com.unihack8.backend.transit.domain.dto.stpt.StptAlert;
import com.unihack8.backend.transit.domain.dto.stpt.StptArrival;
import com.unihack8.backend.transit.domain.dto.stpt.StptRoute;
import com.unihack8.backend.transit.domain.dto.stpt.StptStop;
import com.unihack8.backend.transit.domain.dto.stpt.StptVehicle;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/**
 * Calls STPT and reads its JSON leniently (unknown fields ignored, missing ones become null),
 * because these are the site's own endpoints, not a documented API.
 */
@Component
public class StptClientImpl implements StptClient {

    private final RestClient http;
    private final ObjectMapper json;

    // Uses the STPT RestClient from StptClientConfig.
    public StptClientImpl(@Qualifier("stptRestClient") RestClient http, ObjectMapper json) {
        this.http = http;
        this.json = json;
    }

    // Stops come as an object keyed by stop id.
    @Override
    public List<StptStop> fetchStops() {
        JsonNode root = get("/gtfs-data/stops-index.json");
        List<StptStop> stops = new ArrayList<>();
        for (Map.Entry<String, JsonNode> e : root.properties()) {
            JsonNode s = e.getValue();
            String code = text(s, "stop_code");
            stops.add(new StptStop(code != null ? code : e.getKey(), text(s, "stop_name"),
                    s.path("lat").asDouble(), s.path("lon").asDouble(), strings(s.path("routes"))));
        }
        return stops;
    }

    // Lines come in "routes", an object keyed by line name.
    @Override
    public List<StptRoute> fetchRoutes() {
        JsonNode routes = get("/gtfs-data/route-manifest.json").path("routes");
        List<StptRoute> result = new ArrayList<>();
        for (Map.Entry<String, JsonNode> e : routes.properties()) {
            JsonNode r = e.getValue();
            String name = text(r, "route_short_name");
            result.add(new StptRoute(name != null ? name : e.getKey(), text(r, "route_long_name"),
                    text(r, "route_type"), text(r, "category"), text(r, "route_color")));
        }
        return result;
    }

    // Answer shape: { "success": true, "data": { "vehicles": [...] } }.
    @Override
    public List<StptVehicle> fetchVehicles(String route) {
        JsonNode root = parse(http.get()
                .uri(b -> b.path("/gtfs-vehicles.php").queryParam("route", route).build())
                .retrieve().body(String.class));
        if (root.has("success") && !root.path("success").asBoolean()) {
            throw new IllegalStateException("STPT vehicles answer was not successful");
        }
        List<StptVehicle> vehicles = new ArrayList<>();
        for (JsonNode v : root.path("data").path("vehicles")) {
            vehicles.add(new StptVehicle(text(v, "id"), v.path("lat").asDouble(), v.path("lng").asDouble(),
                    number(v, "bearing"), number(v, "speed"), text(v, "route"), text(v, "headsign"),
                    text(v, "stop"), v.hasNonNull("timestamp") ? v.path("timestamp").asLong() : null,
                    v.hasNonNull("isAccessible") ? v.path("isAccessible").asBoolean() : null));
        }
        return vehicles;
    }

    // Answer is an array, one item per line and direction.
    @Override
    public List<StptArrival> fetchArrivals(String stopId) {
        JsonNode root = parse(http.get()
                .uri(b -> b.path("/proxy-smtt-cache.php").queryParam("stopid", stopId).build())
                .retrieve().body(String.class));
        if (!root.isArray()) {
            throw new IllegalStateException("STPT arrivals answer is not a list");
        }
        List<StptArrival> arrivals = new ArrayList<>();
        for (JsonNode a : root) {
            arrivals.add(new StptArrival(text(a, "route"), text(a, "type"), text(a, "destination"),
                    text(a, "vehicleId"), strings(a.path("times"))));
        }
        return arrivals;
    }

    // Answer shape: { "alerts": [ { id, headerText, descriptionText } ] }.
    @Override
    public List<StptAlert> fetchAlerts() {
        List<StptAlert> alerts = new ArrayList<>();
        for (JsonNode a : get("/proxy-alerts.php").path("alerts")) {
            alerts.add(new StptAlert(text(a, "id"), text(a, "headerText"), text(a, "descriptionText")));
        }
        return alerts;
    }

    // GET a path and parse the body as JSON.
    private JsonNode get(String path) {
        return parse(http.get().uri(path).retrieve().body(String.class));
    }

    // Parses a body; an empty body counts as a failure.
    private JsonNode parse(String body) {
        if (body == null || body.isBlank()) {
            throw new IllegalStateException("STPT sent an empty answer");
        }
        return json.readTree(body);
    }

    // Field as text, or null when missing or JSON null.
    private static String text(JsonNode node, String field) {
        JsonNode v = node.get(field);
        return v == null || v.isNull() ? null : v.asString();
    }

    // Field as a number, or null when missing.
    private static Double number(JsonNode node, String field) {
        JsonNode v = node.get(field);
        return v == null || v.isNull() ? null : v.asDouble();
    }

    // Array of strings (empty list when missing).
    private static List<String> strings(JsonNode array) {
        List<String> result = new ArrayList<>();
        for (JsonNode item : array) {
            result.add(item.asString());
        }
        return result;
    }
}
