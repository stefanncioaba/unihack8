package com.unihack8.backend.config;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/**
 * Supabase settings, read from application-local.properties (prefix "supabase").
 *
 * @param url       project URL, e.g. https://abc.supabase.co
 * @param jwtSecret legacy JWT secret (HS256) that signs the app's access tokens
 */
@Validated
@ConfigurationProperties(prefix = "supabase")
public record SupabaseProperties(
        @NotBlank String url,
        // HS256 needs a key of at least 256 bits (32 bytes).
        @NotBlank @Size(min = 32, message = "must be at least 32 characters (HS256 key)") String jwtSecret) {

    // Issuer Supabase writes into every access token ("iss" claim).
    public String issuer() {
        return url.replaceAll("/+$", "") + "/auth/v1";
    }
}
