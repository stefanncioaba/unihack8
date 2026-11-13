package com.unihack8.backend.routing.support;

import com.unihack8.backend.routing.domain.otp.OtpPlanResult;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.util.List;
import tools.jackson.databind.json.JsonMapper;

/**
 * Real OpenTripPlanner 2.7 answers saved in src/test/resources/otp/ (recorded 2026-11-13 from our
 * own OTP with the STPT GTFS, query = OtpGraphQlClient.PLAN_QUERY).
 */
public final class OtpFixtures {

    // Piața Victoriei -> Gara de Nord, Monday 2026-11-16 10:00 local time. OTP lists, in this order:
    // a 20-min direct walk, trolleybus 18 (arrives 10:13) and trolleybus M14 (arrives 10:16).
    public static final String TRANSIT = "otp/plan-transit.json";

    // Utility class.
    private OtpFixtures() {
    }

    // Itineraries of a saved answer, read the same way RestClient reads the live one.
    public static List<OtpPlanResult.Itinerary> itineraries(String resource) {
        try (InputStream in = OtpFixtures.class.getClassLoader().getResourceAsStream(resource)) {
            if (in == null) {
                throw new IllegalArgumentException("Missing test resource " + resource);
            }
            OtpPlanResult result = JsonMapper.builder().build().readValue(in, OtpPlanResult.class);
            return result.data().planConnection().edges().stream().map(OtpPlanResult.Edge::node).toList();
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }
}
