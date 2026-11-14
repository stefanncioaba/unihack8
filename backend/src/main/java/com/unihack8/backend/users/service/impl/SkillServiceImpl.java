package com.unihack8.backend.users.service.impl;

import com.unihack8.backend.common.exception.ApiException;
import com.unihack8.backend.common.exception.ErrorCode;
import com.unihack8.backend.help.domain.HelpRules;
import com.unihack8.backend.users.domain.SkillRules;
import com.unihack8.backend.users.domain.dto.SkillRequest;
import com.unihack8.backend.users.domain.dto.SkillResponse;
import com.unihack8.backend.users.domain.entity.UserSkill;
import com.unihack8.backend.users.mapper.SkillMapper;
import com.unihack8.backend.users.repository.ProfileRepository;
import com.unihack8.backend.users.repository.UserSkillRepository;
import com.unihack8.backend.users.service.SkillService;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

@Service
public class SkillServiceImpl implements SkillService {
    private final UserSkillRepository skills;
    private final ProfileRepository profiles;
    private final SkillMapper mapper;
    private final Clock clock;

    // Skill storage, profile lookup (404 for unknown users), mapping and the clock for created_at.
    public SkillServiceImpl(UserSkillRepository skills, ProfileRepository profiles, SkillMapper mapper, Clock clock) {
        this.skills = skills;
        this.profiles = profiles;
        this.mapper = mapper;
        this.clock = clock;
    }

    // Oldest first, so a new skill appears at the end of the list.
    @Override
    @Transactional(readOnly = true)
    public List<SkillResponse> skillsOf(UUID userId) {
        return skills.findByUserIdOrderByCreatedAtAscIdAsc(userId).stream().map(mapper::toResponse).toList();
    }

    // One query for all helpers of a request.
    @Override
    @Transactional(readOnly = true)
    public Map<UUID, List<SkillResponse>> skillsOf(Collection<UUID> userIds) {
        Map<UUID, List<SkillResponse>> byUser = new LinkedHashMap<>();
        if (userIds.isEmpty()) {
            return byUser;
        }
        for (UserSkill skill : skills.findByUserIdInOrderByCreatedAtAscIdAsc(userIds)) {
            byUser.computeIfAbsent(skill.getUserId(), id -> new ArrayList<>()).add(mapper.toResponse(skill));
        }
        return byUser;
    }

    // Validates, checks the limit and duplicates, then saves.
    @Override
    @Transactional
    public SkillResponse add(UUID userId, SkillRequest request) {
        if (!profiles.existsById(userId)) {
            throw ApiException.notFound("User");
        }
        String name = validName(request);
        String category = validCategory(request);
        List<UserSkill> mine = skills.findByUserIdOrderByCreatedAtAscIdAsc(userId);
        if (mine.size() >= SkillRules.MAX_PER_USER) {
            throw new ApiException(ErrorCode.SKILL_LIMIT);
        }
        requireNewName(mine, name, null);
        return mapper.toResponse(save(new UserSkill(UUID.randomUUID(), userId, name, category, clock.instant())));
    }

    // Only the owner's own skill can change; renaming it to another of their skills is refused.
    @Override
    @Transactional
    public SkillResponse update(UUID userId, UUID skillId, SkillRequest request) {
        UserSkill skill = skills.findByIdAndUserId(skillId, userId).orElseThrow(() -> ApiException.notFound("Skill"));
        String name = validName(request);
        String category = validCategory(request);
        requireNewName(skills.findByUserIdOrderByCreatedAtAscIdAsc(userId), name, skillId);
        skill.edit(name, category);
        return mapper.toResponse(save(skill));
    }

    // A skill of another user looks the same as a missing one (404).
    @Override
    @Transactional
    public void delete(UUID userId, UUID skillId) {
        UserSkill skill = skills.findByIdAndUserId(skillId, userId).orElseThrow(() -> ApiException.notFound("Skill"));
        skills.delete(skill);
    }

    // Saves and turns a concurrent duplicate (unique index on user_id, lower(name)) into 409 SKILL_EXISTS.
    private UserSkill save(UserSkill skill) {
        try {
            return skills.saveAndFlush(skill);
        } catch (DataIntegrityViolationException exception) {
            throw new ApiException(ErrorCode.SKILL_EXISTS);
        }
    }

    // Trimmed name with inner spaces collapsed; 400 unless 2-40 characters.
    private static String validName(SkillRequest request) {
        String name = request == null || request.name() == null ? "" : request.name().trim().replaceAll("\\s+", " ");
        if (name.length() < SkillRules.NAME_MIN || name.length() > SkillRules.NAME_MAX) {
            throw new ApiException(ErrorCode.VALIDATION_FAILED,
                    "Skill name must be " + SkillRules.NAME_MIN + "-" + SkillRules.NAME_MAX + " characters.");
        }
        return name;
    }

    // Upper-cased Help Board category; 400 for anything else.
    private static String validCategory(SkillRequest request) {
        String category = request == null || request.category() == null ? null
                : request.category().trim().toUpperCase(Locale.ROOT);
        if (category == null || !HelpRules.CATEGORIES.contains(category)) {
            throw new ApiException(ErrorCode.VALIDATION_FAILED,
                    "Category must be one of " + String.join(", ", HelpRules.CATEGORY_ORDER) + ".");
        }
        return category;
    }

    // 409 SKILL_EXISTS when another of the user's skills has the same name (ignoring case).
    private static void requireNewName(List<UserSkill> mine, String name, UUID except) {
        boolean taken = mine.stream().anyMatch(s -> !s.getId().equals(except) && s.getName().equalsIgnoreCase(name));
        if (taken) {
            throw new ApiException(ErrorCode.SKILL_EXISTS);
        }
    }
}
