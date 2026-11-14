package com.unihack8.backend.users.repository;

import com.unihack8.backend.users.domain.entity.UserSkill;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Storage of user_skills. */
public interface UserSkillRepository extends JpaRepository<UserSkill, UUID> {
    // Skills of one user, oldest first.
    List<UserSkill> findByUserIdOrderByCreatedAtAscIdAsc(UUID userId);

    // Skills of several users at once (helpers on a help request), oldest first.
    List<UserSkill> findByUserIdInOrderByCreatedAtAscIdAsc(Collection<UUID> userIds);

    // One skill of the given owner; empty if it does not exist or belongs to someone else.
    Optional<UserSkill> findByIdAndUserId(UUID id, UUID userId);
}
