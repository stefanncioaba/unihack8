package com.unihack8.backend.places.client.impl;

import com.unihack8.backend.places.client.OverpassClient;
import com.unihack8.backend.places.client.dto.OverpassResponse;
import com.unihack8.backend.places.config.PlaceImportProperties;
import com.unihack8.backend.places.domain.PlaceCategory;
import java.net.http.HttpClient;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.TreeSet;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.client.HttpServerErrorException;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;
import tools.jackson.databind.DeserializationFeature;
import tools.jackson.databind.json.JsonMapper;

/** Calls the public Overpass API with one union query covering all 10 place categories. */
@Component
public class OverpassClientImpl implements OverpassClient {

    // Identifies the app to the Overpass operators (no personal info).
    public static final String USER_AGENT = "unihack8-hackathon-places-import/0.1";
    private static final Logger log = LoggerFactory.getLogger(OverpassClientImpl.class);
    // Overpass may take a while for a whole city; the query itself allows 90 s.
    private static final Duration CONNECT_TIMEOUT = Duration.ofSeconds(15);
    private static final Duration READ_TIMEOUT = Duration.ofSeconds(100);

    // Parses Overpass JSON; unknown fields (version, osm3s, ...) are ignored.
    private static final JsonMapper JSON = JsonMapper.builder()
            .disable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES)
            .build();

    private final PlaceImportProperties properties;
    private final RestClient restClient;

    // Builds the HTTP client with long timeouts and the import's User-Agent.
    public OverpassClientImpl(PlaceImportProperties properties) {
        this.properties = properties;
        HttpClient httpClient = HttpClient.newBuilder().connectTimeout(CONNECT_TIMEOUT).build();
        JdkClientHttpRequestFactory requestFactory = new JdkClientHttpRequestFactory(httpClient);
        requestFactory.setReadTimeout(READ_TIMEOUT);
        this.restClient = RestClient.builder()
                .requestFactory(requestFactory)
                .defaultHeader(HttpHeaders.USER_AGENT, USER_AGENT)
                .build();
    }

    /**
     * POSTs the query as form field "data" and parses the JSON answer. Public Overpass servers are
     * often "at capacity" (502/503/504) or slow, so each configured server is tried in order; the
     * last failure is rethrown if none answers.
     */
    @Override
    public OverpassResponse fetchPlaces() {
        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("data", buildQuery(properties.bbox()));
        RuntimeException lastFailure = null;
        for (String url : properties.overpassUrls()) {
            try {
                String body = restClient.post()
                        .uri(url)
                        .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                        .accept(MediaType.APPLICATION_JSON)
                        .body(form)
                        .retrieve()
                        .body(String.class);
                return parse(body);
            } catch (HttpServerErrorException | ResourceAccessException e) {
                log.warn("Overpass server {} failed ({}), trying the next one", url, e.getMessage());
                lastFailure = e;
            }
        }
        throw lastFailure != null ? lastFailure : new IllegalStateException("No Overpass server configured");
    }

    // Turns an Overpass JSON body into records (also used by tests on the fixture file).
    public static OverpassResponse parse(String json) {
        if (json == null || json.isBlank()) {
            return new OverpassResponse(null);
        }
        return JSON.readValue(json, OverpassResponse.class);
    }

    /**
     * Builds one Overpass QL query: one nwr[...] line per OSM key (amenity, shop, leisure, tourism)
     * matching every value of the categories using that key, and "out center tags" so ways and
     * relations come with a centre point.
     */
    public static String buildQuery(String bbox) {
        // Group the category values by OSM key, keeping the enum order of the keys.
        Map<String, TreeSet<String>> valuesByKey = new LinkedHashMap<>();
        for (PlaceCategory category : PlaceCategory.values()) {
            valuesByKey.computeIfAbsent(category.osmKey(), k -> new TreeSet<>()).addAll(category.osmValues());
        }
        StringBuilder query = new StringBuilder("[out:json][timeout:90];(");
        valuesByKey.forEach((key, values) -> query
                .append("nwr[\"").append(key).append("\"~\"^(")
                .append(String.join("|", values))
                .append(")$\"](").append(bbox).append(");"));
        return query.append(");out center tags;").toString();
    }
}
