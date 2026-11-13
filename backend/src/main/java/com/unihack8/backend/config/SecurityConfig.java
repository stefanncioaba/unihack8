package com.unihack8.backend.config;

import com.unihack8.backend.common.security.JsonAccessDeniedHandler;
import com.unihack8.backend.common.security.JsonAuthenticationEntryPoint;
import java.nio.charset.StandardCharsets;
import java.util.List;
import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtClaimValidator;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

/**
 * Security rules (PLAN 3.3): every request is stateless and carries a Supabase access token,
 * except the public read-only endpoints listed in docs/API.md.
 */
@Configuration
@EnableConfigurationProperties(SupabaseProperties.class)
public class SecurityConfig {

    // Audience Supabase puts in the tokens of signed-in users.
    static final String SUPABASE_AUDIENCE = "authenticated";

    // Builds the request rules: public GETs, everything else needs a valid token.
    @Bean
    public SecurityFilterChain securityFilterChain(
            HttpSecurity http,
            JsonAuthenticationEntryPoint authenticationEntryPoint,
            JsonAccessDeniedHandler accessDeniedHandler) throws Exception {
        http
                .csrf(AbstractHttpConfigurer::disable)
                .cors(Customizer.withDefaults())
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                        .requestMatchers(HttpMethod.GET,
                                "/events", "/events/*",
                                "/places", "/places/*",
                                "/transit/**",
                                "/users/username-available").permitAll()
                        .requestMatchers("/error").permitAll()
                        .anyRequest().authenticated())
                .oauth2ResourceServer(oauth -> oauth
                        .jwt(Customizer.withDefaults())
                        .authenticationEntryPoint(authenticationEntryPoint)
                        .accessDeniedHandler(accessDeniedHandler))
                .exceptionHandling(e -> e
                        .authenticationEntryPoint(authenticationEntryPoint)
                        .accessDeniedHandler(accessDeniedHandler));
        return http.build();
    }

    // Checks token signature (HS256 with the legacy Supabase secret), expiry, issuer and audience.
    @Bean
    public JwtDecoder jwtDecoder(SupabaseProperties supabase) {
        SecretKey key = new SecretKeySpec(supabase.jwtSecret().getBytes(StandardCharsets.UTF_8), "HmacSHA256");
        NimbusJwtDecoder decoder = NimbusJwtDecoder.withSecretKey(key)
                .macAlgorithm(MacAlgorithm.HS256)
                .build();
        decoder.setJwtValidator(tokenValidator(supabase.issuer()));
        return decoder;
    }

    // Default checks (expiry, not-before) plus Supabase's issuer and "authenticated" audience.
    static OAuth2TokenValidator<Jwt> tokenValidator(String issuer) {
        OAuth2TokenValidator<Jwt> audience = new JwtClaimValidator<List<String>>(
                "aud", aud -> aud != null && aud.contains(SUPABASE_AUDIENCE));
        return new DelegatingOAuth2TokenValidator<>(JwtValidators.createDefaultWithIssuer(issuer), audience);
    }

    // CORS open to any origin while developing (only matters for Expo web; phones ignore CORS).
    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration cors = new CorsConfiguration();
        cors.setAllowedOriginPatterns(List.of("*"));
        cors.setAllowedMethods(List.of("GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"));
        cors.setAllowedHeaders(List.of("*"));
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", cors);
        return source;
    }
}
