package com.unihack8.backend.users.domain.dto;

import java.util.UUID;

/** A skill on a profile or next to a helper's offer. */
public record SkillResponse(UUID id, String name, String category) {
}
