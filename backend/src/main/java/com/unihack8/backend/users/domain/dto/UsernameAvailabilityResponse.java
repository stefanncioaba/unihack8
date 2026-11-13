package com.unihack8.backend.users.domain.dto;

/** Answer of {@code GET /users/username-available}: the name asked about and whether it is free. */
public record UsernameAvailabilityResponse(String username, boolean available) {
}
