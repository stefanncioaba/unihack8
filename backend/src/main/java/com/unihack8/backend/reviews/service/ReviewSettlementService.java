package com.unihack8.backend.reviews.service;

/** Applies each finished event's average rating to its organiser's reliability score, once. */
public interface ReviewSettlementService {
    // Settles every event whose review window is over; returns how many organisers' scores changed.
    int settleDueEvents();
}
