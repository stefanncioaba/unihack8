package com.unihack8.backend.users.service;

import com.unihack8.backend.users.domain.dto.SkillRequest;
import com.unihack8.backend.users.domain.dto.SkillResponse;

import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Profile skills (PLAN 28): the owner adds, edits and deletes them; everyone can read them. */
public interface SkillService {
    // Skills of a user, oldest first.
    List<SkillResponse> skillsOf(UUID userId);

    // Skills of several users, keyed by user ID (users without skills are left out).
    Map<UUID, List<SkillResponse>> skillsOf(Collection<UUID> userIds);

    // Adds a skill; 400 VALIDATION_FAILED, 409 SKILL_EXISTS or 409 SKILL_LIMIT.
    SkillResponse add(UUID userId, SkillRequest request);

    // Edits one of the caller's skills; 404 when it is not theirs, 400 / 409 like add.
    SkillResponse update(UUID userId, UUID skillId, SkillRequest request);

    // Deletes one of the caller's skills; 404 when it is not theirs.
    void delete(UUID userId, UUID skillId);
}
