package com.unihack8.backend.eventimport.service;

/** Imports upcoming LiveTickets events for the city into the events table (PLAN 7.4). */
public interface EventImportService {

    // Downloads, maps, locates and stores the events; safe to run again (no duplicates).
    Result importEvents();

    /**
     * Summary of one run.
     *
     * @param fetched   events LiveTickets returned (all cities)
     * @param inCity    of those, events in our city with the required data
     * @param inserted  new rows
     * @param updated   existing rows refreshed
     * @param located   events stored with coordinates (shown on the map)
     * @param unlocated events stored without coordinates (lists only)
     * @param removed   upcoming imported events LiveTickets no longer lists
     */
    record Result(int fetched, int inCity, int inserted, int updated, int located, int unlocated, int removed) {
    }
}
