package com.unihack8.backend.routing.client.impl;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.content;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.jsonPath;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withServerError;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import com.unihack8.backend.routing.client.OtpUnavailableException;
import com.unihack8.backend.common.geo.GeoPoint;
import com.unihack8.backend.routing.domain.model.TravelMode;
import com.unihack8.backend.routing.domain.otp.OtpPlanResult;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

/** The GraphQL request we send to OTP and how its answer is read (no network). */
class OtpGraphQlClientTest {

    private static final GeoPoint FROM = new GeoPoint(45.7537, 21.2257);
    private static final GeoPoint TO = new GeoPoint(45.7505, 21.2075);
    private static final Instant DEPART = Instant.parse("2026-11-14T18:00:00.123Z");

    private MockRestServiceServer server;
    private OtpGraphQlClient client;

    // Client bound to a mock server instead of a real OTP.
    @BeforeEach
    void setUp() {
        RestClient.Builder builder = RestClient.builder().baseUrl("http://otp.test");
        server = MockRestServiceServer.bindTo(builder).build();
        client = new OtpGraphQlClient(builder.build());
    }

    // A transit request carries coordinates, labels, time (UTC, seconds) and vehicle modes; the fixture is parsed.
    @Test
    void transitRequestAndSavedAnswer() {
        server.expect(requestTo("http://otp.test/otp/gtfs/v1"))
                .andExpect(method(HttpMethod.POST))
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                // OTP rejects chunked bodies, so the length must be known up front.
                .andExpect(header("Content-Length", org.hamcrest.Matchers.notNullValue()))
                .andExpect(jsonPath("$.query").value(org.hamcrest.Matchers.containsString("planConnection")))
                .andExpect(jsonPath("$.variables.origin.label").value("Start"))
                .andExpect(jsonPath("$.variables.origin.location.coordinate.latitude").value(45.7537))
                .andExpect(jsonPath("$.variables.destination.location.coordinate.longitude").value(21.2075))
                .andExpect(jsonPath("$.variables.dateTime.earliestDeparture").value("2026-11-14T18:00:00Z"))
                .andExpect(jsonPath("$.variables.modes.transit.transit[0].mode").value("TRAM"))
                .andExpect(jsonPath("$.variables.first").value(3))
                .andRespond(withSuccess(new ClassPathResource("otp/plan-transit.json"), MediaType.APPLICATION_JSON));

        List<OtpPlanResult.Itinerary> itineraries = client.plan(FROM, TO, TravelMode.TRANSIT, DEPART);

        server.verify();
        // Real OTP order: direct walk first, then trolleybus 18, then M14.
        assertThat(itineraries).hasSize(3);
        assertThat(itineraries.getFirst().legs()).singleElement()
                .satisfies(leg -> assertThat(leg.mode()).isEqualTo("WALK"));
        OtpPlanResult.Itinerary trolleybus = itineraries.get(1);
        assertThat(trolleybus.duration()).isEqualTo(673L);
        assertThat(trolleybus.end()).isEqualTo("2026-11-16T10:13:39+02:00");
        assertThat(trolleybus.legs()).hasSize(3);
        OtpPlanResult.Leg ride = trolleybus.legs().get(1);
        assertThat(ride.mode()).isEqualTo("TROLLEYBUS");
        assertThat(ride.route().shortName()).isEqualTo("18");
        assertThat(ride.from().name()).isEqualTo("Piața Regina Maria (Spitalul de copii)");
        assertThat(ride.start().scheduledTime()).isEqualTo("2026-11-16T10:09:00+02:00");
        assertThat(ride.legGeometry().points()).isNotBlank();
    }

    // A walking request asks OTP for direct walking only.
    @Test
    void walkRequestIsDirectWalkOnly() {
        server.expect(requestTo("http://otp.test/otp/gtfs/v1"))
                .andExpect(jsonPath("$.variables.modes.directOnly").value(true))
                .andExpect(jsonPath("$.variables.modes.direct[0]").value("WALK"))
                .andExpect(jsonPath("$.variables.modes.transit").doesNotExist())
                .andRespond(withSuccess("{\"data\":{\"planConnection\":{\"edges\":[]}}}", MediaType.APPLICATION_JSON));

        assertThat(client.plan(FROM, TO, TravelMode.WALK, DEPART)).isEmpty();
        server.verify();
    }

    // HTTP error from OTP -> OtpUnavailableException.
    @Test
    void serverErrorIsUnavailable() {
        server.expect(requestTo("http://otp.test/otp/gtfs/v1")).andRespond(withServerError());

        assertThatThrownBy(() -> client.plan(FROM, TO, TravelMode.WALK, DEPART))
                .isInstanceOf(OtpUnavailableException.class);
    }

    // GraphQL error without data (e.g. schema mismatch) -> OtpUnavailableException with OTP's message.
    @Test
    void graphQlErrorIsUnavailable() {
        server.expect(requestTo("http://otp.test/otp/gtfs/v1"))
                .andRespond(withSuccess("{\"data\":null,\"errors\":[{\"message\":\"Validation error\"}]}",
                        MediaType.APPLICATION_JSON));

        assertThatThrownBy(() -> client.plan(FROM, TO, TravelMode.TRANSIT, DEPART))
                .isInstanceOf(OtpUnavailableException.class)
                .hasMessageContaining("Validation error");
    }
}
