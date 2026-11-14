package com.unihack8.backend.help.repository.impl;

import com.unihack8.backend.help.domain.entity.HelpOffer;
import com.unihack8.backend.help.domain.entity.HelpOfferView;
import com.unihack8.backend.help.repository.HelpOfferRepository;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/** JdbcTemplate implementation over help_offers. Status changes are conditional, like event check-in. */
@Repository
public class HelpOfferRepositoryImpl implements HelpOfferRepository {

    private static final String COLUMNS =
            "o.request_id, o.helper_id, o.status, o.qr_token, o.offered_at, o.checked_in_at";

    private final JdbcTemplate jdbc;

    // Uses the transaction-bound connection supplied by Spring.
    public HelpOfferRepositoryImpl(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    // One offer by its primary key.
    @Override
    public Optional<HelpOffer> find(UUID requestId, UUID helperId) {
        return jdbc.query("SELECT " + COLUMNS + " FROM help_offers o WHERE o.request_id = ? AND o.helper_id = ?",
                (rs, n) -> offer(rs), requestId, helperId).stream().findFirst();
    }

    // One offer by its QR token.
    @Override
    public Optional<HelpOffer> findByToken(UUID qrToken) {
        return jdbc.query("SELECT " + COLUMNS + " FROM help_offers o WHERE o.qr_token = ?", (rs, n) -> offer(rs),
                qrToken).stream().findFirst();
    }

    // Saves a new offer.
    @Override
    public void insert(HelpOffer o) {
        jdbc.update("INSERT INTO help_offers (request_id,helper_id,status,qr_token,offered_at,checked_in_at) "
                        + "VALUES (?,?,?,?,?,?)", o.requestId(), o.helperId(), o.status(), o.qrToken(),
                Timestamp.from(o.offeredAt()), o.checkedInAt() == null ? null : Timestamp.from(o.checkedInAt()));
    }

    // Conditional status change.
    @Override
    public int changeStatus(UUID requestId, UUID helperId, String from, String to) {
        return jdbc.update("UPDATE help_offers SET status = ? WHERE request_id = ? AND helper_id = ? AND status = ?",
                to, requestId, helperId, from);
    }

    // Sets HELPED and checked_in_at together (the table requires both or neither).
    @Override
    public int markHelped(UUID requestId, UUID helperId, Instant checkedInAt) {
        return jdbc.update("UPDATE help_offers SET status = 'HELPED', checked_in_at = ? "
                + "WHERE request_id = ? AND helper_id = ? AND status = 'OFFERED'", Timestamp.from(checkedInAt),
                requestId, helperId);
    }

    // The other helpers are simply no longer needed.
    @Override
    public int markOthersNotNeeded(UUID requestId, UUID helperId) {
        return jdbc.update("UPDATE help_offers SET status = 'NOT_NEEDED' "
                + "WHERE request_id = ? AND helper_id <> ? AND status = 'OFFERED'", requestId, helperId);
    }

    // Offers with helper names and scores, oldest first.
    @Override
    public List<HelpOfferView> offers(UUID requestId) {
        return jdbc.query("SELECT " + COLUMNS + ", p.username, p.reliability_score FROM help_offers o "
                        + "JOIN profiles p ON p.id = o.helper_id "
                        + "WHERE o.request_id = ? AND o.status <> 'WITHDRAWN' ORDER BY o.offered_at, o.helper_id",
                (rs, n) -> new HelpOfferView(offer(rs), rs.getString("username"), rs.getInt("reliability_score")),
                requestId);
    }

    // Maps the offer columns of the current row.
    private static HelpOffer offer(ResultSet rs) throws SQLException {
        Timestamp checkedIn = rs.getTimestamp("checked_in_at");
        return new HelpOffer(rs.getObject("request_id", UUID.class), rs.getObject("helper_id", UUID.class),
                rs.getString("status"), rs.getObject("qr_token", UUID.class),
                rs.getTimestamp("offered_at").toInstant(), checkedIn == null ? null : checkedIn.toInstant());
    }
}
