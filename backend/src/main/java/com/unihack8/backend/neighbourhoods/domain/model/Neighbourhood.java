package com.unihack8.backend.neighbourhoods.domain.model;

import com.unihack8.backend.common.geo.GeoPoint;

/**
 * One Timișoara area on the Neighbourhood Pulse screen: a hard-coded centre and radius.
 *
 * @param id           stable id the app uses for its photo, e.g. "cetate"
 * @param name         display name, e.g. "Cetate"
 * @param centre       middle of the area
 * @param radiusMeters how far from the centre a point still belongs to the area
 */
public record Neighbourhood(String id, String name, GeoPoint centre, int radiusMeters) {
}
