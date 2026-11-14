package com.unihack8.backend.users.domain.dto;

/**
 * Body of POST /users/me/skills and PATCH /users/me/skills/{id}.
 *
 * @param name     2-40 characters, trimmed
 * @param category one of the Help Board categories
 */
public record SkillRequest(String name, String category) {
}
