package com.unihack8.backend.users.service;

import com.unihack8.backend.common.exception.ApiException;
import com.unihack8.backend.common.exception.ErrorCode;
import com.unihack8.backend.users.domain.dto.SkillRequest;
import com.unihack8.backend.users.domain.dto.SkillResponse;
import com.unihack8.backend.users.domain.entity.UserSkill;
import com.unihack8.backend.users.mapper.impl.SkillMapperImpl;
import com.unihack8.backend.users.repository.ProfileRepository;
import com.unihack8.backend.users.repository.UserSkillRepository;
import com.unihack8.backend.users.service.impl.SkillServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.IntStream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/** Profile skill rules (PLAN 28) with the database mocked. */
@ExtendWith(MockitoExtension.class)
class SkillServiceImplTest {
    private static final UUID ME = UUID.fromString("11111111-1111-1111-1111-111111111111");
    private static final UUID OTHER = UUID.fromString("22222222-2222-2222-2222-222222222222");
    private static final Instant NOW = Instant.parse("2026-11-14T15:00:00Z");

    @Mock
    private UserSkillRepository skills;

    @Mock
    private ProfileRepository profiles;

    private SkillServiceImpl service;

    // Real mapper, fixed clock; save returns what it was given.
    @BeforeEach
    void setUp() {
        service = new SkillServiceImpl(skills, profiles, new SkillMapperImpl(), Clock.fixed(NOW, ZoneOffset.UTC));
    }

    // A stored skill of `user`.
    private static UserSkill skill(UUID user, String name, String category) {
        return new UserSkill(UUID.randomUUID(), user, name, category, NOW);
    }

    // Asserts the call fails with this error code.
    private static void fails(Runnable call, ErrorCode code) {
        assertThatThrownBy(call::run).isInstanceOf(ApiException.class)
                .satisfies(e -> assertThat(((ApiException) e).code()).isEqualTo(code));
    }

    // Adding trims the name, collapses spaces, upper-cases the category and stamps the time.
    @Test
    void addNormalises() {
        when(profiles.existsById(ME)).thenReturn(true);
        when(skills.findByUserIdOrderByCreatedAtAscIdAsc(ME)).thenReturn(List.of());
        when(skills.saveAndFlush(any())).thenAnswer(i -> i.getArgument(0));

        SkillResponse added = service.add(ME, new SkillRequest("  Fixing   bikes ", "bikes"));

        assertThat(added.name()).isEqualTo("Fixing bikes");
        assertThat(added.category()).isEqualTo("BIKES");
        assertThat(added.id()).isNotNull();
    }

    // Name length, unknown or missing category, and a missing body are 400.
    @Test
    void addValidation() {
        when(profiles.existsById(ME)).thenReturn(true);
        fails(() -> service.add(ME, new SkillRequest("x", "TECH")), ErrorCode.VALIDATION_FAILED);
        fails(() -> service.add(ME, new SkillRequest("x".repeat(41), "TECH")), ErrorCode.VALIDATION_FAILED);
        fails(() -> service.add(ME, new SkillRequest("Welding", "WELDING")), ErrorCode.VALIDATION_FAILED);
        fails(() -> service.add(ME, new SkillRequest("Welding", null)), ErrorCode.VALIDATION_FAILED);
        fails(() -> service.add(ME, null), ErrorCode.VALIDATION_FAILED);
        verify(skills, never()).saveAndFlush(any());
    }

    // The same name twice (any case) is 409 SKILL_EXISTS.
    @Test
    void addDuplicate() {
        when(profiles.existsById(ME)).thenReturn(true);
        when(skills.findByUserIdOrderByCreatedAtAscIdAsc(ME)).thenReturn(List.of(skill(ME, "Carpentry", "CARPENTRY")));
        fails(() -> service.add(ME, new SkillRequest("CARPENTRY", "REPAIRS")), ErrorCode.SKILL_EXISTS);
    }

    // The 11th skill is 409 SKILL_LIMIT.
    @Test
    void addLimit() {
        when(profiles.existsById(ME)).thenReturn(true);
        List<UserSkill> ten = new ArrayList<>(IntStream.range(0, 10).mapToObj(i -> skill(ME, "Skill " + i, "OTHER")).toList());
        when(skills.findByUserIdOrderByCreatedAtAscIdAsc(ME)).thenReturn(ten);
        fails(() -> service.add(ME, new SkillRequest("One more", "OTHER")), ErrorCode.SKILL_LIMIT);
    }

    // A concurrent duplicate caught by the unique index is also 409 SKILL_EXISTS.
    @Test
    void addRaceIsConflict() {
        when(profiles.existsById(ME)).thenReturn(true);
        when(skills.findByUserIdOrderByCreatedAtAscIdAsc(ME)).thenReturn(List.of());
        when(skills.saveAndFlush(any())).thenThrow(new DataIntegrityViolationException("duplicate"));
        fails(() -> service.add(ME, new SkillRequest("Cooking", "COOKING")), ErrorCode.SKILL_EXISTS);
    }

    // Unknown users get 404.
    @Test
    void addUnknownUser() {
        when(profiles.existsById(ME)).thenReturn(false);
        fails(() -> service.add(ME, new SkillRequest("Cooking", "COOKING")), ErrorCode.NOT_FOUND);
    }

    // Editing changes name and category; keeping its own name is not a duplicate.
    @Test
    void update() {
        UserSkill mine = skill(ME, "Carpentry", "CARPENTRY");
        when(skills.findByIdAndUserId(mine.getId(), ME)).thenReturn(Optional.of(mine));
        when(skills.findByUserIdOrderByCreatedAtAscIdAsc(ME)).thenReturn(List.of(mine));
        when(skills.saveAndFlush(any())).thenAnswer(i -> i.getArgument(0));

        SkillResponse edited = service.update(ME, mine.getId(), new SkillRequest("carpentry", "repairs"));

        assertThat(edited.name()).isEqualTo("carpentry");
        assertThat(edited.category()).isEqualTo("REPAIRS");
        assertThat(edited.id()).isEqualTo(mine.getId());
    }

    // Renaming to another of my skills is 409; someone else's skill is 404.
    @Test
    void updateRefusals() {
        UserSkill a = skill(ME, "Carpentry", "CARPENTRY");
        UserSkill b = skill(ME, "Painting", "PAINTING");
        when(skills.findByIdAndUserId(a.getId(), ME)).thenReturn(Optional.of(a));
        when(skills.findByUserIdOrderByCreatedAtAscIdAsc(ME)).thenReturn(List.of(a, b));
        fails(() -> service.update(ME, a.getId(), new SkillRequest("painting", "PAINTING")), ErrorCode.SKILL_EXISTS);

        UUID theirs = UUID.randomUUID();
        when(skills.findByIdAndUserId(theirs, ME)).thenReturn(Optional.empty());
        fails(() -> service.update(ME, theirs, new SkillRequest("Cooking", "COOKING")), ErrorCode.NOT_FOUND);
    }

    // Deleting my skill removes it; someone else's is 404 and nothing is deleted.
    @Test
    void delete() {
        UserSkill mine = skill(ME, "Carpentry", "CARPENTRY");
        when(skills.findByIdAndUserId(mine.getId(), ME)).thenReturn(Optional.of(mine));
        service.delete(ME, mine.getId());
        verify(skills).delete(mine);

        UUID theirs = UUID.randomUUID();
        when(skills.findByIdAndUserId(theirs, ME)).thenReturn(Optional.empty());
        fails(() -> service.delete(ME, theirs), ErrorCode.NOT_FOUND);
    }

    // Skills of several users are grouped by user, keeping the stored order; no IDs means no query.
    @Test
    void skillsOfMany() {
        when(skills.findByUserIdInOrderByCreatedAtAscIdAsc(List.of(ME, OTHER))).thenReturn(List.of(
                skill(ME, "Carpentry", "CARPENTRY"), skill(OTHER, "Cooking", "COOKING"), skill(ME, "Tech help", "TECH")));

        Map<UUID, List<SkillResponse>> byUser = service.skillsOf(List.of(ME, OTHER));

        assertThat(byUser.get(ME)).extracting(SkillResponse::name).containsExactly("Carpentry", "Tech help");
        assertThat(byUser.get(OTHER)).extracting(SkillResponse::name).containsExactly("Cooking");
        assertThat(new SkillServiceImpl(skills, profiles, new SkillMapperImpl(), Clock.systemUTC()).skillsOf(List.of()))
                .isEmpty();
    }

    // An empty ID list does not touch the database.
    @Test
    void skillsOfNoneSkipsQuery() {
        assertThat(service.skillsOf(List.<UUID>of())).isEmpty();
        verifyNoInteractions(skills);
    }
}
