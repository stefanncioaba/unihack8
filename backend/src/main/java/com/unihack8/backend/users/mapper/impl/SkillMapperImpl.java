package com.unihack8.backend.users.mapper.impl;

import com.unihack8.backend.users.domain.dto.SkillResponse;
import com.unihack8.backend.users.domain.entity.UserSkill;
import com.unihack8.backend.users.mapper.SkillMapper;
import org.springframework.stereotype.Component;

@Component
public class SkillMapperImpl implements SkillMapper {

    // Copies id, name and category; the owner and creation time stay internal.
    @Override
    public SkillResponse toResponse(UserSkill skill) {
        return new SkillResponse(skill.getId(), skill.getName(), skill.getCategory());
    }
}
