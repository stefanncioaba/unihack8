package com.unihack8.backend.common.security;

import com.unihack8.backend.common.exception.ApiException;
import com.unihack8.backend.common.exception.ErrorCode;
import java.util.Optional;
import java.util.UUID;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Component;

/**
 * Who is calling (PLAN 3.4). The user id is the Supabase token's "sub" claim, which equals
 * auth.users.id and profiles.id.
 */
@Component
public class CurrentUser {

    // Id of the signed-in caller; throws 401 UNAUTHORIZED when there is no valid token.
    public UUID id() {
        return optionalId().orElseThrow(() -> new ApiException(ErrorCode.UNAUTHORIZED));
    }

    // Id of the caller if signed in, empty on public endpoints called without a token.
    public Optional<UUID> optionalId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (!(auth instanceof JwtAuthenticationToken jwtAuth)) {
            return Optional.empty();
        }
        try {
            return Optional.of(UUID.fromString(jwtAuth.getToken().getSubject()));
        } catch (IllegalArgumentException | NullPointerException e) {
            return Optional.empty();
        }
    }
}
