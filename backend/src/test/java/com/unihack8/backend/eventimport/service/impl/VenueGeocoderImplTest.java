package com.unihack8.backend.eventimport.service.impl;

import static org.assertj.core.api.Assertions.assertThat;

import com.sun.net.httpserver.HttpServer;
import com.unihack8.backend.common.geo.GeoPoint;
import com.unihack8.backend.eventimport.config.EventImportProperties;
import com.unihack8.backend.places.domain.PlaceCategory;
import com.unihack8.backend.places.domain.entity.Place;
import com.unihack8.backend.places.repository.PlaceRepository;
import java.net.InetSocketAddress;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.atomic.AtomicReference;
import javax.sql.DataSource;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase.Replace;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * Venue geocoding (PLAN 7.3) against the H2 places table (PostgreSQL-mode test database) and a local fake Nominatim server;
 * never calls the real Nominatim or the real database.
 */
@DataJpaTest
@AutoConfigureTestDatabase(replace = Replace.NONE)
class VenueGeocoderImplTest {

    private static final String NOMINATIM_HIT = "[{\"place_id\":1,\"lat\":\"45.7539\",\"lon\":\"21.2257\","
            + "\"display_name\":\"Somewhere, Timișoara\",\"importance\":0.3}]";

    @Autowired
    private PlaceRepository places;
    @Autowired
    private DataSource dataSource;

    private HttpServer server;
    private final AtomicInteger hits = new AtomicInteger();
    private final List<Map<String, String>> queries = new CopyOnWriteArrayList<>();
    private final AtomicReference<String> userAgent = new AtomicReference<>();
    private final AtomicReference<String> responseBody = new AtomicReference<>("[]");
    private final AtomicInteger responseStatus = new AtomicInteger(200);
    private final List<Long> sleeps = new ArrayList<>();
    private final AtomicLong clock = new AtomicLong(1_000_000);

    // Starts a fake Nominatim on 127.0.0.1 that records each request and answers with the configured body.
    @BeforeEach
    void startServer() throws Exception {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/search", exchange -> {
            hits.incrementAndGet();
            userAgent.set(exchange.getRequestHeaders().getFirst("User-Agent"));
            queries.add(decodeQuery(exchange.getRequestURI().getRawQuery()));
            byte[] body = responseBody.get().getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            exchange.sendResponseHeaders(responseStatus.get(), body.length);
            exchange.getResponseBody().write(body);
            exchange.close();
        });
        server.start();
    }

    // Stops the fake server.
    @AfterEach
    void stopServer() {
        server.stop(0);
    }

    // --- places table ---

    // An exact name match ignoring case and diacritics comes from the places table, without Nominatim.
    @Test
    void matchesPlaceIgnoringCaseAndDiacritics() {
        place("Nemesis Art Club", 45.7501, 21.2301);
        place("Muzeul Satului Bănățean", 45.7790, 21.2650);
        GeoPoint nemesis = new GeoPoint(45.7501, 21.2301);

        VenueGeocoderImpl geocoder = geocoder();

        assertThat(geocoder.locate("NEMESIS ART CLUB")).contains(nemesis);
        assertThat(geocoder.locate("muzeul satului banatean")).contains(new GeoPoint(45.7790, 21.2650));
        assertThat(hits).hasValue(0);
    }

    // Punctuation and spacing differences are ignored ("&" vs "and"-less, extra spaces).
    @Test
    void matchesPlaceIgnoringPunctuation() {
        place("Fratelli Lounge & Club", 45.7480, 21.2390);

        assertThat(geocoder().locate("  Fratelli   Lounge - Club ")).contains(new GeoPoint(45.7480, 21.2390));
    }

    // A trailing or leading city word is dropped before matching.
    @Test
    void matchesPlaceAfterDroppingCityWord() {
        place("Fratelli Lounge & Club", 45.7480, 21.2390);
        place("MINA", 45.7560, 21.2280);
        place("Hibana", 45.7570, 21.2270);

        VenueGeocoderImpl geocoder = geocoder();

        assertThat(geocoder.locate("Fratelli Lounge & Club Timisoara")).contains(new GeoPoint(45.7480, 21.2390));
        assertThat(geocoder.locate("MINA Timișoara")).contains(new GeoPoint(45.7560, 21.2280));
        assertThat(geocoder.locate("Timişoara Hibana")).contains(new GeoPoint(45.7570, 21.2270));
        assertThat(hits).hasValue(0);
    }

    // A place whose name only contains the venue (or vice versa) is not a match; Nominatim is asked instead.
    @Test
    void substringDoesNotMatch() {
        place("No Name Bistro", 45.7500, 21.2300);
        place("Heaven Lounge", 45.7510, 21.2310);

        VenueGeocoderImpl geocoder = geocoder();

        assertThat(geocoder.locate("No Name")).isEmpty();
        assertThat(geocoder.locate("Heaven")).isEmpty();
        assertThat(geocoder.locate("No Name Bistro Terrace")).isEmpty();
        assertThat(hits).hasValue(3);
    }

    // The same name at two far-apart places (a chain) is ambiguous and not used.
    @Test
    void ambiguousPlaceNameIsIgnored() {
        place("Ted's Coffee", 45.7400, 21.2000);
        place("Ted's Coffee", 45.7900, 21.2900);

        assertThat(geocoder().locate("Ted's Coffee")).isEmpty();
        assertThat(hits).hasValue(1);
    }

    // --- Nominatim ---

    // The request carries the venue with city and country, the bounded viewbox and the app's User-Agent.
    @Test
    void asksNominatimWithExpectedParameters() {
        responseBody.set(NOMINATIM_HIT);

        Optional<GeoPoint> result = geocoder().locate("Expovest");

        assertThat(result).contains(new GeoPoint(45.7539, 21.2257));
        assertThat(hits).hasValue(1);
        assertThat(userAgent.get()).isEqualTo(VenueGeocoderImpl.USER_AGENT);
        Map<String, String> query = queries.getFirst();
        assertThat(query).containsEntry("q", "Expovest, Timișoara, Romania")
                .containsEntry("format", "jsonv2")
                .containsEntry("limit", "1")
                .containsEntry("countrycodes", "ro")
                .containsEntry("viewbox", "21.1,45.85,21.4,45.65")
                .containsEntry("bounded", "1");
    }

    // Special characters in the venue (&, #, quotes) are encoded and reach Nominatim intact.
    @Test
    void encodesSpecialCharacters() {
        responseBody.set(NOMINATIM_HIT);

        geocoder().locate("#altfel & \"Friends\"");

        assertThat(queries.getFirst()).containsEntry("q", "#altfel & \"Friends\", Timișoara, Romania");
    }

    // A result outside the Timișoara bbox (e.g. Bucharest) is rejected.
    @Test
    void rejectsResultOutsideArea() {
        responseBody.set("[{\"lat\":\"44.4268\",\"lon\":\"26.1025\"}]");

        assertThat(geocoder().locate("Sala Palatului")).isEmpty();
    }

    // No result gives empty.
    @Test
    void emptyResultGivesEmpty() {
        assertThat(geocoder().locate("Vineri 15")).isEmpty();
        assertThat(hits).hasValue(1);
    }

    // HTTP 500 and unparseable bodies give empty instead of throwing.
    @Test
    void serverErrorGivesEmpty() {
        responseStatus.set(500);
        responseBody.set("{\"error\":\"boom\"}");
        VenueGeocoderImpl geocoder = geocoder();

        assertThat(geocoder.locate("FABER")).isEmpty();

        responseStatus.set(200);
        responseBody.set("<html>not json</html>");
        assertThat(geocoder.locate("Banat Village Museum")).isEmpty();
    }

    // An unreachable server gives empty instead of throwing.
    @Test
    void unreachableServerGivesEmpty() {
        int port = server.getAddress().getPort();
        server.stop(0);
        VenueGeocoderImpl geocoder = geocoder("http://127.0.0.1:" + port + "/search");

        assertThat(geocoder.locate("Expovest")).isEmpty();
    }

    // Blank or city-only venues give empty without calling Nominatim.
    @Test
    void cityOnlyOrBlankVenueIsNotLookedUp() {
        responseBody.set(NOMINATIM_HIT);
        VenueGeocoderImpl geocoder = geocoder();

        assertThat(geocoder.locate("Timișoara")).isEmpty();
        assertThat(geocoder.locate("TIMISOARA")).isEmpty();
        assertThat(geocoder.locate("timişoara")).isEmpty();
        assertThat(geocoder.locate("  ")).isEmpty();
        assertThat(geocoder.locate(null)).isEmpty();
        assertThat(hits).hasValue(0);
    }

    // The same venue (even spelled differently) is asked once; hits and misses are both cached.
    @Test
    void cachesHitsAndMisses() {
        responseBody.set(NOMINATIM_HIT);
        VenueGeocoderImpl geocoder = geocoder();

        Optional<GeoPoint> first = geocoder.locate("Shopping City Timișoara");
        Optional<GeoPoint> second = geocoder.locate("shopping city timisoara");
        assertThat(second).isEqualTo(first).isPresent();

        responseBody.set("[]");
        assertThat(geocoder.locate("Strandul No Name")).isEmpty();
        assertThat(geocoder.locate("Strandul No Name")).isEmpty();

        assertThat(hits).hasValue(2);
    }

    // Two different venues back to back: the second request waits so requests are 1 s apart.
    @Test
    void spacesRequestsOneSecondApart() {
        VenueGeocoderImpl geocoder = geocoder();

        geocoder.locate("Expovest");
        clock.addAndGet(250);
        geocoder.locate("FABER");
        clock.addAndGet(5_000);
        geocoder.locate("Heaven");

        assertThat(hits).hasValue(3);
        assertThat(sleeps).containsExactly(750L);
    }

    // Normalization lowercases, strips Romanian diacritics (both comma and cedilla forms) and punctuation.
    @Test
    void normalizesNames() {
        assertThat(VenueGeocoderImpl.normalize("Aeroportul Internațional \"Traian Vuia\" Timişoara"))
                .isEqualTo("aeroportul international traian vuia timisoara");
        assertThat(VenueGeocoderImpl.normalize("ĂÂÎȘŞȚŢ ăâîșşțţ")).isEqualTo("aaisstt aaisstt");
        assertThat(VenueGeocoderImpl.normalize("#altfel   Timisoara!")).isEqualTo("altfel timisoara");
    }

    // The "south,west,north,east" setting maps onto BoundingBox's minLon,minLat,maxLon,maxLat.
    @Test
    void parsesBboxSetting() {
        var box = VenueGeocoderImpl.parseBbox(EventImportProperties.DEFAULT_BBOX);

        assertThat(box.minLat()).isEqualTo(45.65);
        assertThat(box.minLon()).isEqualTo(21.10);
        assertThat(box.maxLat()).isEqualTo(45.85);
        assertThat(box.maxLon()).isEqualTo(21.40);
    }

    // --- curated venues.txt and brackets ---

    // Exact coordinates from the curated file are used as they are, without Nominatim.
    @Test
    void curatedCoordinatesAreUsedDirectly() {
        VenueGeocoderImpl geocoder = geocoderWithDirectory("Vineri 15 | 45.74844, 21.23080");

        assertThat(geocoder.locate("VINERI 15")).contains(new GeoPoint(45.74844, 21.23080));
        assertThat(hits).hasValue(0);
    }

    // A curated address is geocoded as the Nominatim query (city words in the venue name are ignored).
    @Test
    void curatedAddressIsGeocoded() {
        responseBody.set(NOMINATIM_HIT);
        VenueGeocoderImpl geocoder = geocoderWithDirectory(
                "# comment line\nFratelli Lounge & Club | Bulevardul Corneliu Coposu 3, Timișoara\nbroken line");

        assertThat(geocoder.locate("Fratelli Lounge & Club Timisoara")).contains(new GeoPoint(45.7539, 21.2257));
        assertThat(queries).singleElement()
                .satisfies(q -> assertThat(q).containsEntry("q", "Bulevardul Corneliu Coposu 3, Timișoara, Romania"));
    }

    // The places table still wins over the curated file.
    @Test
    void placesTableWinsOverCuratedFile() {
        place("Expovest", 45.7700, 21.2800);
        VenueGeocoderImpl geocoder = geocoderWithDirectory("Expovest | 45.7744, 21.2889");

        assertThat(geocoder.locate("Expovest")).contains(new GeoPoint(45.7700, 21.2800));
    }

    // When the full name is not found, the text in brackets is tried next.
    @Test
    void triesTextInBrackets() {
        VenueGeocoderImpl geocoder = geocoder();

        assertThat(geocoder.locate("Strandul No Name (no name beach)")).isEmpty();
        assertThat(queries).extracting(q -> q.get("q")).containsExactly(
                "Strandul No Name (no name beach), Timișoara, Romania", "no name beach, Timișoara, Romania");
    }

    // No brackets, or empty ones, give no second query.
    @Test
    void textInBracketsParsing() {
        assertThat(VenueGeocoderImpl.textInBrackets("Strandul No Name (no name beach)")).isEqualTo("no name beach");
        assertThat(VenueGeocoderImpl.textInBrackets("Heaven")).isNull();
        assertThat(VenueGeocoderImpl.textInBrackets("Club ( )")).isNull();
        assertThat(VenueGeocoderImpl.textInBrackets(null)).isNull();
    }

    // The bundled venues.txt loads and knows the venues OpenStreetMap lacks.
    @Test
    void bundledDirectoryLoads() {
        VenueDirectory directory = VenueDirectory.load(VenueGeocoderImpl::normalize);

        assertThat(directory.find(List.of("expovest"))).isPresent();
        assertThat(directory.find(List.of("vineri 15"))).isPresent();
        assertThat(directory.find(List.of("fratelli lounge club timisoara"))).isPresent();
        assertThat(directory.find(List.of("heaven"))).isEmpty();
    }

    // Geocoder pointed at the fake server, with a curated directory parsed from the given text.
    private VenueGeocoderImpl geocoderWithDirectory(String venuesTxt) {
        EventImportProperties properties = new EventImportProperties(null, null, null,
                "http://127.0.0.1:" + server.getAddress().getPort() + "/search", null);
        return new VenueGeocoderImpl(properties, new JdbcTemplate(dataSource), sleeps::add, clock::get,
                VenueDirectory.parse(venuesTxt, VenueGeocoderImpl::normalize));
    }

    // Geocoder pointed at the fake server, with a recorded sleeper and a manual clock.
    private VenueGeocoderImpl geocoder() {
        return geocoder("http://127.0.0.1:" + server.getAddress().getPort() + "/search");
    }

    // Geocoder pointed at the given Nominatim URL.
    private VenueGeocoderImpl geocoder(String nominatimUrl) {
        EventImportProperties properties = new EventImportProperties(null, null, null, nominatimUrl, null);
        return new VenueGeocoderImpl(properties, new JdbcTemplate(dataSource), sleeps::add, clock::get);
    }

    // Saves a place row in the H2 places table.
    private void place(String name, double lat, double lon) {
        Place place = new Place("node/" + name.hashCode() + "/" + lat);
        place.update(name, PlaceCategory.CLUB, lat, lon, null, null, Map.of());
        places.saveAndFlush(place);
    }

    // Decodes a raw query string into a parameter map.
    private static Map<String, String> decodeQuery(String rawQuery) {
        Map<String, String> params = new LinkedHashMap<>();
        for (String pair : rawQuery.split("&")) {
            int eq = pair.indexOf('=');
            params.put(URLDecoder.decode(pair.substring(0, eq), StandardCharsets.UTF_8),
                    URLDecoder.decode(pair.substring(eq + 1), StandardCharsets.UTF_8));
        }
        return params;
    }
}
