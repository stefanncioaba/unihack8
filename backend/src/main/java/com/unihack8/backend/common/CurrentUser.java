package com.unihack8.backend.common;

import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Component;

import java.util.UUID;

@Component
public class CurrentUser {

    // Uses the subject of Spring Security's verified JWT as the Supabase user ID.
    public UUID id(Jwt jwt) {
        return UUID.fromString(jwt.getSubject());
    }
}
