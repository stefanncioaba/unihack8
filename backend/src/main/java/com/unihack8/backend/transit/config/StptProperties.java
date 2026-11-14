package com.unihack8.backend.transit.config;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * STPT live-transit settings (prefix "stpt"). Defaults work as-is; override in properties if needed.
 *
 * @param baseUrl        STPT live site
 * @param connectTimeout max wait to open a connection
 * @param readTimeout    max wait for an answer, so a slow STPT never hangs our API (PLAN 9.1)
 * @param userAgent      identifies our app to STPT
 * @param ttl            how long each kind of data stays fresh in our cache
 * @param gtfsPath       STPT timetable zip from infra/otp/get-data.sh (relative to the backend/ folder)
 */
@ConfigurationProperties(prefix = "stpt")
public record StptProperties(
        @DefaultValue("https://live.stpt.ro") String baseUrl,
        @DefaultValue("3s") Duration connectTimeout,
        @DefaultValue("5s") Duration readTimeout,
        @DefaultValue("unihack8-timisoara-app (hackathon demo)") String userAgent,
        @DefaultValue Ttl ttl,
        @DefaultValue("../infra/otp/stpt-gtfs.zip") String gtfsPath) {

    /** Cache lifetimes: vehicles 5 s (the map polls every 5 s and animates between positions, like live.stpt.ro),
     * arrivals 20 s, alerts 5 min, stops/routes 24 h. */
    public record Ttl(
            @DefaultValue("5s") Duration vehicles,
            @DefaultValue("20s") Duration arrivals,
            @DefaultValue("5m") Duration alerts,
            @DefaultValue("24h") Duration staticData) {
    }
}
