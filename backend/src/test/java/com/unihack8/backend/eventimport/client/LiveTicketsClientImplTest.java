package com.unihack8.backend.eventimport.client;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.sun.net.httpserver.HttpServer;
import com.unihack8.backend.eventimport.client.dto.LiveTicketsSearchResponse;
import com.unihack8.backend.eventimport.client.impl.LiveTicketsClientImpl;
import com.unihack8.backend.eventimport.config.EventImportProperties;
import java.io.IOException;
import java.io.InputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import org.junit.jupiter.api.Test;
import org.springframework.web.client.HttpServerErrorException;

/** LiveTickets client (PLAN 7.1) against a saved response and a local fake server — never the real site. */
class LiveTicketsClientImplTest {

    // The saved LiveTickets response body.
    private static String fixtureJson() throws IOException {
        try (InputStream in = LiveTicketsClientImplTest.class.getResourceAsStream("/livetickets/event-search-sample.json")) {
            return new String(in.readAllBytes(), StandardCharsets.UTF_8);
        }
    }

    // The real response shape parses; unknown fields are ignored.
    @Test
    void parsesSavedResponse() throws IOException {
        LiveTicketsSearchResponse response = LiveTicketsClientImpl.parse(fixtureJson());
        assertThat(response.items()).hasSize(11);
        assertThat(response.hasMorePages()).isFalse();
        assertThat(response.items().get(0).name()).isEqualTo("ALBWHO at Fratelli Timisoara");
        assertThat(response.items().get(0).startDate()).isEqualTo("2026-11-13T23:00:00");
    }

    // Empty or missing bodies give no events instead of failing.
    @Test
    void parsesEmptyBodies() {
        assertThat(LiveTicketsClientImpl.parse(null).items()).isEmpty();
        assertThat(LiveTicketsClientImpl.parse("{}").items()).isEmpty();
        assertThat(LiveTicketsClientImpl.parse("{\"events\":{\"items\":null}}").items()).isEmpty();
    }

    // Sends our User-Agent and paging parameters, and follows hasMorePages.
    @Test
    void readsAllPages() throws IOException {
        List<String> queries = new CopyOnWriteArrayList<>();
        List<String> agents = new CopyOnWriteArrayList<>();
        String page1 = "{\"events\":{\"items\":[{\"event_id\":\"a\",\"name\":\"A\"}],\"hasMorePages\":true}}";
        String page2 = "{\"events\":{\"items\":[{\"event_id\":\"b\",\"name\":\"B\"}],\"hasMorePages\":false}}";
        HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/public/event-search", exchange -> {
            String query = exchange.getRequestURI().getQuery();
            queries.add(query);
            agents.add(exchange.getRequestHeaders().getFirst("User-Agent"));
            byte[] body = (query.contains("spc.pageNumber=1") ? page1 : page2).getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, body.length);
            exchange.getResponseBody().write(body);
            exchange.close();
        });
        server.start();
        try {
            String url = "http://127.0.0.1:" + server.getAddress().getPort() + "/public/event-search";
            LiveTicketsClient client = new LiveTicketsClientImpl(new EventImportProperties(false, url, null, null, null));

            assertThat(client.fetchUpcomingEvents()).extracting(e -> e.name()).containsExactly("A", "B");
            assertThat(queries).containsExactly(
                    "spc.pageNumber=1&spc.numberOfRecords=1000", "spc.pageNumber=2&spc.numberOfRecords=1000");
            assertThat(agents).containsOnly(LiveTicketsClientImpl.USER_AGENT);
        } finally {
            server.stop(0);
        }
    }

    // A failing LiveTickets is reported to the caller (the runner then keeps the stored events).
    @Test
    void serverErrorIsThrown() throws IOException {
        HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/public/event-search", exchange -> {
            exchange.sendResponseHeaders(503, -1);
            exchange.close();
        });
        server.start();
        try {
            String url = "http://127.0.0.1:" + server.getAddress().getPort() + "/public/event-search";
            LiveTicketsClient client = new LiveTicketsClientImpl(new EventImportProperties(false, url, null, null, null));
            assertThatThrownBy(client::fetchUpcomingEvents).isInstanceOf(HttpServerErrorException.class);
        } finally {
            server.stop(0);
        }
    }

    // Defaults point at the real LiveTickets and Timișoara.
    @Test
    void propertiesDefaults() {
        EventImportProperties defaults = EventImportProperties.defaults();
        assertThat(defaults.enabled()).isFalse();
        assertThat(defaults.liveticketsUrl()).isEqualTo("https://api.livetickets.ro/public/event-search");
        assertThat(defaults.city()).isEqualTo("Timișoara");
        assertThat(defaults.nominatimUrl()).isEqualTo("https://nominatim.openstreetmap.org/search");
    }
}
