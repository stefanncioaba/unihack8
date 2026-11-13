package com.unihack8.backend.users.domain.dto;

import java.util.UUID;

public record ProfileSearchResult(UUID id, String username, int reliabilityScore) {
}
