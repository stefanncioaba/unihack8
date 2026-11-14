package com.unihack8.backend.reviews.support;

import org.springframework.jdbc.core.JdbcTemplate;

/**
 * H2 version of supabase/migrations/20261114000004_event_reviews.sql for tests that build their own
 * events table. Call it after the events table exists; it also empties event_reviews.
 */
public final class ReviewTestSchema {

    // Static helper only.
    private ReviewTestSchema() {
    }

    // Adds the review table and the columns the review queries read, then clears old reviews.
    public static void create(JdbcTemplate jdbc) {
        jdbc.execute("ALTER TABLE events ADD COLUMN IF NOT EXISTS organizer_id UUID");
        jdbc.execute("ALTER TABLE events ADD COLUMN IF NOT EXISTS review_settled_at TIMESTAMP WITH TIME ZONE");
        jdbc.execute("CREATE TABLE IF NOT EXISTS event_reviews (event_id UUID NOT NULL, reviewer_id UUID NOT NULL, "
                + "rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5), comment VARCHAR(300), "
                + "created_at TIMESTAMP WITH TIME ZONE NOT NULL, updated_at TIMESTAMP WITH TIME ZONE NOT NULL, "
                + "PRIMARY KEY (event_id, reviewer_id))");
        jdbc.update("DELETE FROM event_reviews");
    }
}
