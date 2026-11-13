package com.unihack8.backend.routing.config;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * OpenTripPlanner settings (prefix "otp"), see application-local.properties.example.
 *
 * @param baseUrl        where the OTP server listens, e.g. http://localhost:8081
 * @param connectTimeout how long to wait for a connection before falling back
 * @param readTimeout    how long to wait for a route before falling back
 */
@ConfigurationProperties(prefix = "otp")
public record OtpProperties(
        @DefaultValue("http://localhost:8081") String baseUrl,
        @DefaultValue("2s") Duration connectTimeout,
        @DefaultValue("10s") Duration readTimeout) {
}
