package com.unihack8.backend.help.domain.entity;

/** An offer read together with the helper's username and civic trust score. */
public record HelpOfferView(HelpOffer offer, String username, int reliabilityScore) {
}
