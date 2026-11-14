package com.unihack8.backend.help.domain.entity;

/**
 * A help request read together with its requester's public profile, the number of current offers
 * (OFFERED and HELPED) and the caller's own offer status (null when the caller never offered).
 */
public record HelpRequestView(HelpRequest request, String requesterUsername, int requesterScore,
                              int offerCount, String myOffer) {
}
