package com.unihack8.backend.common.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.unihack8.backend.common.exception.ApiException;
import com.unihack8.backend.common.exception.ErrorCode;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

/** Reading the caller's id from the security context (PLAN 3.4). */
class CurrentUserTest {

    private final CurrentUser currentUser = new CurrentUser();

    // Each test starts and ends with an empty security context.
    @AfterEach
    void clearContext() {
        SecurityContextHolder.clearContext();
    }

    // Puts a JWT with the given subject into the security context.
    private static void signInAs(String subject) {
        Jwt jwt = Jwt.withTokenValue("token")
                .header("alg", "HS256")
                .subject(subject)
                .issuedAt(Instant.now())
                .expiresAt(Instant.now().plusSeconds(60))
                .build();
        SecurityContextHolder.getContext().setAuthentication(new JwtAuthenticationToken(jwt));
    }

    // Signed-in caller: id is the token's subject.
    @Test
    void returnsSubjectAsId() {
        UUID id = UUID.randomUUID();
        signInAs(id.toString());
        assertThat(currentUser.id()).isEqualTo(id);
        assertThat(currentUser.optionalId()).contains(id);
    }

    // No token: optional is empty and id() is 401.
    @Test
    void anonymousCallerHasNoId() {
        assertThat(currentUser.optionalId()).isEmpty();
        assertThatThrownBy(currentUser::id)
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).code()).isEqualTo(ErrorCode.UNAUTHORIZED);
    }

    // A subject that is not a UUID is treated as not signed in.
    @Test
    void nonUuidSubjectIsIgnored() {
        signInAs("not-a-uuid");
        assertThat(currentUser.optionalId()).isEmpty();
    }
}
