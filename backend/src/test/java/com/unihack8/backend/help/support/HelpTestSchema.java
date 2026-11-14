package com.unihack8.backend.help.support;

import org.springframework.jdbc.core.JdbcTemplate;

/**
 * H2 version of supabase/migrations/20261114000005_help_board.sql (without the partial indexes H2
 * does not support), plus the reliability_log table the check-in writes to. Also empties the tables.
 */
public final class HelpTestSchema {

    // Static helper only.
    private HelpTestSchema() {
    }

    // Creates the help tables if needed and clears old rows.
    public static void create(JdbcTemplate jdbc) {
        jdbc.execute("CREATE TABLE IF NOT EXISTS reliability_log (id UUID PRIMARY KEY, user_id UUID NOT NULL, "
                + "event_id UUID, points_change INTEGER NOT NULL, reason VARCHAR(30) NOT NULL, "
                + "created_at TIMESTAMP WITH TIME ZONE NOT NULL)");
        jdbc.execute("CREATE TABLE IF NOT EXISTS help_requests (id UUID PRIMARY KEY, requester_id UUID NOT NULL, "
                + "title VARCHAR(80) NOT NULL, description VARCHAR(500), category VARCHAR(20) NOT NULL, "
                + "address VARCHAR(120), lat DOUBLE PRECISION, lon DOUBLE PRECISION, status VARCHAR(20) NOT NULL, "
                + "created_at TIMESTAMP WITH TIME ZONE NOT NULL, expires_at TIMESTAMP WITH TIME ZONE NOT NULL, "
                + "closed_at TIMESTAMP WITH TIME ZONE, helper_id UUID, "
                + "CHECK ((status = 'OPEN') = (closed_at IS NULL)))");
        jdbc.execute("CREATE TABLE IF NOT EXISTS help_offers (request_id UUID NOT NULL, helper_id UUID NOT NULL, "
                + "status VARCHAR(20) NOT NULL, qr_token UUID NOT NULL UNIQUE, "
                + "offered_at TIMESTAMP WITH TIME ZONE NOT NULL, checked_in_at TIMESTAMP WITH TIME ZONE, "
                + "PRIMARY KEY (request_id, helper_id), "
                + "FOREIGN KEY (request_id) REFERENCES help_requests(id) ON DELETE CASCADE, "
                + "CHECK ((status = 'HELPED') = (checked_in_at IS NOT NULL)))");
        jdbc.update("DELETE FROM help_offers");
        jdbc.update("DELETE FROM help_requests");
    }
}
