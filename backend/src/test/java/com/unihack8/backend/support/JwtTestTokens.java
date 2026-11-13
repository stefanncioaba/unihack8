package com.unihack8.backend.support;

import com.nimbusds.jose.JOSEException;
import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.JWSHeader;
import com.nimbusds.jose.crypto.MACSigner;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import java.util.UUID;

/**
 * Signs HS256 tokens shaped like Supabase access tokens, for tests.
 * Defaults match src/test/resources/application.properties.
 */
public final class JwtTestTokens {

    public static final String SECRET = "test-secret-for-automated-tests-only-0123456789";
    public static final String ISSUER = "https://test-project.supabase.co/auth/v1";
    public static final String AUDIENCE = "authenticated";

    // Utility class.
    private JwtTestTokens() {
    }

    // Valid token for the given user, expiring in one hour.
    public static String valid(UUID userId) {
        return sign(SECRET, userId.toString(), ISSUER, AUDIENCE, Instant.now().plusSeconds(3600));
    }

    // Token with every part chosen by the test (to build invalid ones).
    public static String sign(String secret, String subject, String issuer, String audience, Instant expiresAt) {
        try {
            JWTClaimsSet claims = new JWTClaimsSet.Builder()
                    .subject(subject)
                    .issuer(issuer)
                    .audience(audience)
                    .claim("role", "authenticated")
                    .issueTime(Date.from(Instant.now().minusSeconds(60)))
                    .expirationTime(Date.from(expiresAt))
                    .build();
            SignedJWT jwt = new SignedJWT(new JWSHeader(JWSAlgorithm.HS256), claims);
            jwt.sign(new MACSigner(secret.getBytes(StandardCharsets.UTF_8)));
            return jwt.serialize();
        } catch (JOSEException e) {
            throw new IllegalStateException("Could not sign test token", e);
        }
    }
}
