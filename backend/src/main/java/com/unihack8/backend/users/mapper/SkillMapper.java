package com.unihack8.backend.users.mapper;

import com.unihack8.backend.users.domain.dto.SkillResponse;
import com.unihack8.backend.users.domain.entity.UserSkill;

/** Builds the skill API shape. */
public interface SkillMapper {
    // The public fields of a skill.
    SkillResponse toResponse(UserSkill skill);
}
