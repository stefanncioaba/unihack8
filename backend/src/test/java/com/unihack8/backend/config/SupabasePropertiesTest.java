package com.unihack8.backend.config;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

/** Issuer derived from the project URL must match the "iss" claim Supabase writes. */
class SupabasePropertiesTest {

    // Issuer is the project URL plus /auth/v1.
    @Test
    void issuerAppendsAuthPath() {
        assertThat(new SupabaseProperties("https://abc.supabase.co", "x".repeat(32)).issuer())
                .isEqualTo("https://abc.supabase.co/auth/v1");
    }

    // A trailing slash in the configured URL does not produce a double slash.
    @Test
    void issuerIgnoresTrailingSlash() {
        assertThat(new SupabaseProperties("https://abc.supabase.co/", "x".repeat(32)).issuer())
                .isEqualTo("https://abc.supabase.co/auth/v1");
    }
}
