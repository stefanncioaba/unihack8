package com.unihack8.backend.reliability.service;

/** Marks participants who never got scanned as NO_SHOW after the event (PLAN 6.3). */
public interface NoShowService {

    // Handles every event that is over; returns how many participants became NO_SHOW. Safe to repeat.
    int markNoShows();
}
