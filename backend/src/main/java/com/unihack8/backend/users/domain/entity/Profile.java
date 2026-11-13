package com.unihack8.backend.users.domain.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "profiles")
public class Profile {
    @Id
    private UUID id;

    @Column(nullable = false, length = 20)
    private String username;

    @Column(name = "reliability_score", nullable = false)
    private int reliabilityScore;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    // Required by JPA when loading a profile from the database.
    protected Profile() {
    }

    // Creates an in-memory profile for tests and mapping; Supabase creates persisted rows.
    public Profile(UUID id, String username, int reliabilityScore, Instant createdAt) {
        this.id = id;
        this.username = username;
        this.reliabilityScore = reliabilityScore;
        this.createdAt = createdAt;
    }

    // Returns the Supabase auth user ID.
    public UUID getId() {
        return id;
    }

    // Returns the public username.
    public String getUsername() {
        return username;
    }

    // Returns the current reliability score.
    public int getReliabilityScore() {
        return reliabilityScore;
    }

    // Returns the account creation time.
    public Instant getCreatedAt() {
        return createdAt;
    }

    // Updates the username after service validation.
    public void changeUsername(String username) {
        this.username = username;
    }
}
