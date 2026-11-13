package com.unihack8.backend.places.client;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.sun.net.httpserver.HttpServer;
import com.unihack8.backend.places.client.dto.OverpassElement;
import com.unihack8.backend.places.client.dto.OverpassResponse;
import com.unihack8.backend.places.client.impl.OverpassClientImpl;
import com.unihack8.backend.places.config.PlaceImportProperties;
import com.unihack8.backend.places.domain.PlaceCategory;
import com.unihack8.backend.places.support.OverpassFixtures;
import java.net.InetSocketAddress;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;
import org.springframework.web.client.HttpServerErrorException;

/** Overpass query building, JSON parsing and the HTTP call (against a local fake server, never the real API). */
class OverpassClientImplTest {

    // The fixture parses into 9 elements; unknown top-level fields are ignored.
    @Test
    void parsesFixture() {
        OverpassResponse response = OverpassFixtures.timisoaraSample();

        assertThat(response.elements()).hasSize(9);
        OverpassElement restaurant = response.elements().get(0);
        assertThat(restaurant.type()).isEqualTo("node");
        assertThat(restaurant.id()).isEqualTo(380526548L);
        assertThat(restaurant.lat()).isEqualTo(45.7710081);
        assertThat(restaurant.tags()).containsEntry("name", "Restaurant Tinecz");
    }

    // Ways come with a centre and no lat/lon of their own.
    @Test
    void parsesWayCenter() {
        OverpassElement park = OverpassFixtures.timisoaraSample().elements().get(3);

        assertThat(park.type()).isEqualTo("way");
        assertThat(park.lat()).isNull();
        assertThat(park.center().lat()).isEqualTo(45.751529);
        assertThat(park.center().lon()).isEqualTo(21.2204933);
    }

    // Unknown element fields are ignored and empty bodies give no elements.
    @Test
    void parseIsLenient() {
        OverpassResponse response = OverpassClientImpl.parse(
                "{\"remark\":\"x\",\"elements\":[{\"type\":\"node\",\"id\":1,\"lat\":1.0,\"lon\":2.0,\"extra\":true}]}");

        assertThat(response.elements()).hasSize(1);
        assertThat(response.elements().get(0).tags()).isEmpty();
        assertThat(OverpassClientImpl.parse("").elements()).isEmpty();
        assertThat(OverpassClientImpl.parse("{}").elements()).isEmpty();
    }

    // The query covers every category's key and values, the bbox, and asks for centres.
    @Test
    void queryContainsEveryCategory() {
        String query = OverpassClientImpl.buildQuery(PlaceImportProperties.DEFAULT_BBOX);

        assertThat(query).startsWith("[out:json][timeout:90];(").endsWith(");out center tags;");
        for (PlaceCategory category : PlaceCategory.values()) {
            assertThat(query).contains("nwr[\"" + category.osmKey() + "\"~\"^(");
            for (String value : category.osmValues()) {
                assertThat(query).containsPattern("\"" + category.osmKey() + "\"~\"\\^\\([a-z_|]*\\b" + value + "\\b");
            }
        }
        assertThat(query).contains("(45.69,21.14,45.81,21.31);");
        // One line per OSM key: amenity, shop, leisure, tourism.
        assertThat(query.split("nwr\\[", -1)).hasSize(5);
    }

    // Defaults apply when nothing is configured.
    @Test
    void propertiesDefaults() {
        PlaceImportProperties properties = PlaceImportProperties.defaults();

        assertThat(properties.enabled()).isFalse();
        assertThat(properties.overpassUrls()).containsExactly(
                "https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter");
        assertThat(properties.bbox()).isEqualTo("45.69,21.14,45.81,21.31");
    }

    // A busy first server (502 "at capacity") makes the client fall back to the next one.
    @Test
    void fallsBackToNextServerWhenFirstIsBusy() throws Exception {
        AtomicInteger busyCalls = new AtomicInteger();
        byte[] answer = OverpassFixtures.json(OverpassFixtures.TIMISOARA_SAMPLE).getBytes(StandardCharsets.UTF_8);
        HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/busy", exchange -> {
            busyCalls.incrementAndGet();
            byte[] busy = "This Overpass API server is currently at capacity.".getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(502, busy.length);
            exchange.getResponseBody().write(busy);
            exchange.close();
        });
        server.createContext("/ok", exchange -> {
            exchange.getRequestBody().readAllBytes();
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, answer.length);
            exchange.getResponseBody().write(answer);
            exchange.close();
        });
        server.start();
        try {
            String base = "http://127.0.0.1:" + server.getAddress().getPort();
            OverpassClient client = new OverpassClientImpl(
                    new PlaceImportProperties(false, base + "/busy, " + base + "/ok", "1,2,3,4"));

            assertThat(client.fetchPlaces().elements()).hasSize(9);
            assertThat(busyCalls.get()).isEqualTo(1);
        } finally {
            server.stop(0);
        }
    }

    // When every server is busy, the last error is thrown (the import then keeps the old places).
    @Test
    void throwsWhenAllServersFail() throws Exception {
        HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/busy", exchange -> {
            exchange.sendResponseHeaders(504, -1);
            exchange.close();
        });
        server.start();
        try {
            String base = "http://127.0.0.1:" + server.getAddress().getPort();
            OverpassClient client = new OverpassClientImpl(
                    new PlaceImportProperties(false, base + "/busy," + base + "/busy", "1,2,3,4"));

            assertThatThrownBy(client::fetchPlaces).isInstanceOf(HttpServerErrorException.class);
        } finally {
            server.stop(0);
        }
    }

    // fetchPlaces POSTs data=<query> with our User-Agent and parses the answer (local fake server).
    @Test
    void fetchPlacesPostsQueryToConfiguredUrl() throws Exception {
        AtomicReference<String> requestBody = new AtomicReference<>();
        AtomicReference<String> userAgent = new AtomicReference<>();
        AtomicReference<String> method = new AtomicReference<>();
        byte[] answer = OverpassFixtures.json(OverpassFixtures.TIMISOARA_SAMPLE).getBytes(StandardCharsets.UTF_8);
        HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/api/interpreter", exchange -> {
            method.set(exchange.getRequestMethod());
            userAgent.set(exchange.getRequestHeaders().getFirst("User-Agent"));
            requestBody.set(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, answer.length);
            exchange.getResponseBody().write(answer);
            exchange.close();
        });
        server.start();
        try {
            String url = "http://127.0.0.1:" + server.getAddress().getPort() + "/api/interpreter";
            OverpassClient client = new OverpassClientImpl(new PlaceImportProperties(false, url, "1,2,3,4"));

            OverpassResponse response = client.fetchPlaces();

            assertThat(response.elements()).hasSize(9);
            assertThat(method.get()).isEqualTo("POST");
            assertThat(userAgent.get()).isEqualTo(OverpassClientImpl.USER_AGENT);
            assertThat(requestBody.get()).startsWith("data=");
            String query = URLDecoder.decode(requestBody.get().substring("data=".length()), StandardCharsets.UTF_8);
            assertThat(query).isEqualTo(OverpassClientImpl.buildQuery("1,2,3,4"));
        } finally {
            server.stop(0);
        }
    }
}
