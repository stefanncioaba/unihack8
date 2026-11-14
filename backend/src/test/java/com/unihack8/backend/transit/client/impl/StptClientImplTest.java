package com.unihack8.backend.transit.client.impl;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withServerError;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import com.unihack8.backend.transit.domain.dto.stpt.StptAlert;
import com.unihack8.backend.transit.domain.dto.stpt.StptArrival;
import com.unihack8.backend.transit.domain.dto.stpt.StptRoute;
import com.unihack8.backend.transit.domain.dto.stpt.StptStop;
import com.unihack8.backend.transit.domain.dto.stpt.StptVehicle;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;
import tools.jackson.databind.json.JsonMapper;

/** Parsing of real STPT answers saved on 2026-11-13 (src/test/resources/stpt), no network. */
class StptClientImplTest {

    private static final String BASE = "https://live.stpt.test";

    private MockRestServiceServer server;
    private StptClientImpl client;

    // Binds a mock server to the RestClient the client uses.
    @BeforeEach
    void setUp() {
        RestClient.Builder builder = RestClient.builder().baseUrl(BASE);
        server = MockRestServiceServer.bindTo(builder).build();
        client = new StptClientImpl(builder.build(), JsonMapper.builder().build());
    }

    // Reads a saved STPT answer.
    static String fixture(String name) throws IOException {
        return new ClassPathResource("stpt/" + name).getContentAsString(StandardCharsets.UTF_8);
    }

    // Stops keyed by id become a list with name, position and lines.
    @Test
    void parsesStops() throws IOException {
        server.expect(requestTo(BASE + "/gtfs-data/stops-index.json"))
                .andRespond(withSuccess(fixture("stops-index.json"), MediaType.APPLICATION_JSON));

        List<StptStop> stops = client.fetchStops();

        assertThat(stops).hasSize(3);
        StptStop first = stops.stream().filter(s -> s.stopCode().equals("1")).findFirst().orElseThrow();
        assertThat(first.stopName()).isEqualTo("Dâmbovița (Ion Barac)");
        assertThat(first.lat()).isEqualTo(45.74015);
        assertThat(first.lon()).isEqualTo(21.19611);
        assertThat(first.routes()).containsExactly("2", "9");
    }

    // Route manifest lines carry type, category, long name and colour.
    @Test
    void parsesRoutes() throws IOException {
        server.expect(requestTo(BASE + "/gtfs-data/route-manifest.json"))
                .andRespond(withSuccess(fixture("route-manifest.json"), MediaType.APPLICATION_JSON));

        List<StptRoute> routes = client.fetchRoutes();

        assertThat(routes).extracting(StptRoute::shortName)
                .containsExactlyInAnyOrder("1", "11", "13", "2", "E4b", "M14", "M22");
        StptRoute tram = routes.stream().filter(r -> r.shortName().equals("1")).findFirst().orElseThrow();
        assertThat(tram.category()).isEqualTo("tram");
        assertThat(tram.routeType()).isEqualTo("0");
        assertThat(tram.longName()).isEqualTo("Gara de Nord - Piața Gh. Domășneanu (AEM)");
        assertThat(tram.color()).isEqualTo("e3a900");
    }

    // Vehicles come from data.vehicles with lng and epoch-ms timestamps.
    @Test
    void parsesVehicles() throws IOException {
        server.expect(requestTo(BASE + "/gtfs-vehicles.php?route=1"))
                .andRespond(withSuccess(fixture("vehicles-route-1.json"), MediaType.APPLICATION_JSON));

        List<StptVehicle> vehicles = client.fetchVehicles("1");

        assertThat(vehicles).hasSize(2);
        StptVehicle v = vehicles.get(0);
        assertThat(v.id()).isEqualTo("1010");
        assertThat(v.lng()).isEqualTo(21.257930755615234);
        assertThat(v.headsign()).isEqualTo("Gara de Nord");
        assertThat(v.timestamp()).isEqualTo(1794594883000L);
        assertThat(v.isAccessible()).isTrue();
    }

    // Without a route STPT is asked once, with no query, for every line's vehicles.
    @Test
    void parsesAllVehicles() throws IOException {
        server.expect(requestTo(BASE + "/gtfs-vehicles.php"))
                .andRespond(withSuccess(fixture("vehicles-route-1.json"), MediaType.APPLICATION_JSON));

        List<StptVehicle> vehicles = client.fetchAllVehicles();

        assertThat(vehicles).extracting(StptVehicle::route).containsExactly("1", "1");
        server.verify();
    }

    // "success": false is treated as a failure, so the cache can serve the last value.
    @Test
    void unsuccessfulVehiclesAnswerFails() {
        server.expect(requestTo(BASE + "/gtfs-vehicles.php?route=1"))
                .andRespond(withSuccess("{\"success\":false}", MediaType.APPLICATION_JSON));

        assertThatThrownBy(() -> client.fetchVehicles("1")).isInstanceOf(IllegalStateException.class);
    }

    // Arrivals keep "HH:mm|minutes" strings and the vehicle id (null = timetable).
    @Test
    void parsesArrivals() throws IOException {
        server.expect(requestTo(BASE + "/proxy-smtt-cache.php?stopid=1"))
                .andRespond(withSuccess(fixture("arrivals-stop-1.json"), MediaType.APPLICATION_JSON));

        List<StptArrival> arrivals = client.fetchArrivals("1");

        assertThat(arrivals).extracting(StptArrival::route).containsExactly("9", "2");
        assertThat(arrivals.get(1).destination()).isEqualTo("Shopping City");
        assertThat(arrivals.get(1).times()).containsExactly("20:45|10", "21:00|25");
        assertThat(arrivals.get(1).vehicleId()).isNull();
    }

    // Alerts come from the "alerts" array.
    @Test
    void parsesAlerts() throws IOException {
        server.expect(requestTo(BASE + "/proxy-alerts.php"))
                .andRespond(withSuccess(fixture("alerts.json"), MediaType.APPLICATION_JSON));

        List<StptAlert> alerts = client.fetchAlerts();

        assertThat(alerts).hasSize(1);
        assertThat(alerts.get(0).id()).isEqualTo("A155");
        assertThat(alerts.get(0).headerText()).startsWith("Având în vedere");
    }

    // HTTP errors and empty answers surface as exceptions.
    @Test
    void serverErrorAndEmptyBodyFail() {
        server.expect(requestTo(BASE + "/proxy-alerts.php")).andRespond(withServerError());
        assertThatThrownBy(() -> client.fetchAlerts()).isInstanceOf(RuntimeException.class);

        server.reset();
        server.expect(requestTo(BASE + "/proxy-alerts.php")).andRespond(withSuccess("", MediaType.APPLICATION_JSON));
        assertThatThrownBy(() -> client.fetchAlerts()).isInstanceOf(IllegalStateException.class);
    }
}
