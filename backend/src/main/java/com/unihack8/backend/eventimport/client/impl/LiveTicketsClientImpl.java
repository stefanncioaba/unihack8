package com.unihack8.backend.eventimport.client.impl;

import com.unihack8.backend.eventimport.client.LiveTicketsClient;
import com.unihack8.backend.eventimport.client.dto.LiveTicketsEvent;
import com.unihack8.backend.eventimport.client.dto.LiveTicketsSearchResponse;
import com.unihack8.backend.eventimport.config.EventImportProperties;
import java.net.http.HttpClient;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.util.UriComponentsBuilder;
import tools.jackson.databind.DeserializationFeature;
import tools.jackson.databind.json.JsonMapper;

/**
 * Calls https://api.livetickets.ro/public/event-search — the endpoint LiveTickets' own website uses
 * (not a documented public API; see DOCS.md → External data sources). One large page usually holds
 * every upcoming event; further pages are read while LiveTickets reports more.
 */
@Component
public class LiveTicketsClientImpl implements LiveTicketsClient {

    // Identifies the app to LiveTickets (no personal info).
    public static final String USER_AGENT = "unihack8-hackathon-event-import/0.1";
    static final int PAGE_SIZE = 1000;
    // Safety stop so a misbehaving "hasMorePages" can never loop forever.
    static final int MAX_PAGES = 10;

    // Parses LiveTickets JSON; unknown fields are ignored.
    private static final JsonMapper JSON = JsonMapper.builder()
            .disable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES)
            .build();

    private final EventImportProperties properties;
    private final RestClient restClient;

    // Builds the HTTP client with timeouts and the import's User-Agent.
    public LiveTicketsClientImpl(EventImportProperties properties) {
        this.properties = properties;
        HttpClient httpClient = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(15)).build();
        JdkClientHttpRequestFactory requestFactory = new JdkClientHttpRequestFactory(httpClient);
        requestFactory.setReadTimeout(Duration.ofSeconds(60));
        this.restClient = RestClient.builder()
                .requestFactory(requestFactory)
                .defaultHeader(HttpHeaders.USER_AGENT, USER_AGENT)
                .build();
    }

    // Reads page after page until LiveTickets reports no more (or MAX_PAGES is reached).
    @Override
    public List<LiveTicketsEvent> fetchUpcomingEvents() {
        List<LiveTicketsEvent> events = new ArrayList<>();
        for (int page = 1; page <= MAX_PAGES; page++) {
            String uri = UriComponentsBuilder.fromUriString(properties.liveticketsUrl())
                    .queryParam("spc.pageNumber", page)
                    .queryParam("spc.numberOfRecords", PAGE_SIZE)
                    .build()
                    .toUriString();
            String body = restClient.get()
                    .uri(uri)
                    .accept(MediaType.APPLICATION_JSON)
                    .retrieve()
                    .body(String.class);
            LiveTicketsSearchResponse response = parse(body);
            events.addAll(response.items());
            if (!response.hasMorePages() || response.items().isEmpty()) {
                break;
            }
        }
        return events;
    }

    // Turns a LiveTickets JSON body into records (also used by tests on the fixture file).
    public static LiveTicketsSearchResponse parse(String json) {
        if (json == null || json.isBlank()) {
            return new LiveTicketsSearchResponse(null);
        }
        return JSON.readValue(json, LiveTicketsSearchResponse.class);
    }
}
