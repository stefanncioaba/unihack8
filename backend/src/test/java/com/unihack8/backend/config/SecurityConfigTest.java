package com.unihack8.backend.config;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.unihack8.backend.support.JwtTestTokens;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;

/** Token validation and public/protected rules (PLAN 3.3), with real HS256 tokens. */
@SpringBootTest
@AutoConfigureMockMvc
class SecurityConfigTest {

    private static final UUID USER = UUID.fromString("8b0f6c1e-2d3a-4f5b-9c7d-1e2f3a4b5c6d");

    @Autowired
    private MockMvc mvc;

    // Protected endpoint without a token answers 401 in the standard error shape.
    @Test
    void protectedEndpointWithoutTokenIs401() throws Exception {
        mvc.perform(get("/test-probe/me"))
                .andExpect(status().isUnauthorized())
                .andExpect(header().string("WWW-Authenticate", "Bearer"))
                .andExpect(jsonPath("$.status").value(401))
                .andExpect(jsonPath("$.code").value("UNAUTHORIZED"))
                .andExpect(jsonPath("$.path").value("/test-probe/me"))
                .andExpect(jsonPath("$.timestamp").exists());
    }

    // A correctly signed Supabase-style token is accepted and its "sub" becomes the user id.
    @Test
    void validTokenIsAcceptedAndSubIsTheUserId() throws Exception {
        mvc.perform(get("/test-probe/me").header("Authorization", "Bearer " + JwtTestTokens.valid(USER)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(USER.toString()));
    }

    // Token signed with another secret is rejected.
    @Test
    void tokenWithWrongSecretIs401() throws Exception {
        String token = JwtTestTokens.sign("another-secret-that-is-long-enough-0123456789", USER.toString(),
                JwtTestTokens.ISSUER, JwtTestTokens.AUDIENCE, Instant.now().plusSeconds(3600));
        mvc.perform(get("/test-probe/me").header("Authorization", "Bearer " + token))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
    }

    // Expired token is rejected.
    @Test
    void expiredTokenIs401() throws Exception {
        String token = JwtTestTokens.sign(JwtTestTokens.SECRET, USER.toString(),
                JwtTestTokens.ISSUER, JwtTestTokens.AUDIENCE, Instant.now().minusSeconds(3600));
        mvc.perform(get("/test-probe/me").header("Authorization", "Bearer " + token))
                .andExpect(status().isUnauthorized());
    }

    // Token from another Supabase project (different issuer) is rejected.
    @Test
    void tokenWithWrongIssuerIs401() throws Exception {
        String token = JwtTestTokens.sign(JwtTestTokens.SECRET, USER.toString(),
                "https://other-project.supabase.co/auth/v1", JwtTestTokens.AUDIENCE, Instant.now().plusSeconds(3600));
        mvc.perform(get("/test-probe/me").header("Authorization", "Bearer " + token))
                .andExpect(status().isUnauthorized());
    }

    // Token not meant for signed-in users (e.g. the anon key) is rejected.
    @Test
    void tokenWithWrongAudienceIs401() throws Exception {
        String token = JwtTestTokens.sign(JwtTestTokens.SECRET, USER.toString(),
                JwtTestTokens.ISSUER, "anon", Instant.now().plusSeconds(3600));
        mvc.perform(get("/test-probe/me").header("Authorization", "Bearer " + token))
                .andExpect(status().isUnauthorized());
    }

    // Garbage instead of a token is rejected.
    @Test
    void malformedTokenIs401() throws Exception {
        mvc.perform(get("/test-probe/me").header("Authorization", "Bearer not-a-jwt"))
                .andExpect(status().isUnauthorized());
    }

    // Public endpoints work without a token.
    @Test
    void publicEndpointWorksWithoutToken() throws Exception {
        mvc.perform(get("/transit/test-probe"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.signedIn").value(false));
    }

    // Public endpoints still recognise the caller when a token is sent (e.g. myStatus on events).
    @Test
    void publicEndpointSeesCallerWhenTokenSent() throws Exception {
        mvc.perform(get("/transit/test-probe").header("Authorization", "Bearer " + JwtTestTokens.valid(USER)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.signedIn").value(true));
    }

    // Unknown paths still require a token (no accidental public endpoints).
    @Test
    void unknownPathWithoutTokenIs401() throws Exception {
        mvc.perform(get("/does-not-exist"))
                .andExpect(status().isUnauthorized());
    }
}
