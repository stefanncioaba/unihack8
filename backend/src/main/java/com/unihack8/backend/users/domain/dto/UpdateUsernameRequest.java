package com.unihack8.backend.users.domain.dto;

/**
 * Body of {@code PATCH /users/me}. The format is checked in the service, so a bad or missing
 * name answers {@code 400 INVALID_USERNAME} as docs/API.md says.
 */
public record UpdateUsernameRequest(String username) {
}
