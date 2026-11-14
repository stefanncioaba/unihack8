package com.unihack8.backend.users.domain.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

/** One skill a user lists on their profile (PLAN 28), e.g. "Carpentry" in CARPENTRY. Table user_skills. */
@Entity
@Table(name = "user_skills")
public class UserSkill {
    @Id
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(nullable = false, length = 40)
    private String name;

    @Column(nullable = false, length = 20)
    private String category;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    // Required by JPA when loading a skill from the database.
    protected UserSkill() {
    }

    // Creates a new skill after the service validated name and category.
    public UserSkill(UUID id, UUID userId, String name, String category, Instant createdAt) {
        this.id = id;
        this.userId = userId;
        this.name = name;
        this.category = category;
        this.createdAt = createdAt;
    }

    // Returns the skill ID.
    public UUID getId() {
        return id;
    }

    // Returns the owner's user ID.
    public UUID getUserId() {
        return userId;
    }

    // Returns the skill name shown on the profile.
    public String getName() {
        return name;
    }

    // Returns the Help Board category the skill belongs to.
    public String getCategory() {
        return category;
    }

    // Returns when the skill was added.
    public Instant getCreatedAt() {
        return createdAt;
    }

    // Changes name and category after service validation.
    public void edit(String name, String category) {
        this.name = name;
        this.category = category;
    }
}
