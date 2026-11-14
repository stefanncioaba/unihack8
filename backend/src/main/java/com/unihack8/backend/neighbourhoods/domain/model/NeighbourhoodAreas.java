package com.unihack8.backend.neighbourhoods.domain.model;

import com.unihack8.backend.common.geo.GeoPoint;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;

/**
 * The hard-coded Timișoara areas and the point-in-radius check that assigns a place, event,
 * stop or vehicle to one of them. Where two circles overlap, the nearer centre wins, so nothing
 * is counted twice.
 */
public final class NeighbourhoodAreas {

    /** Every area. */
    public static final List<Neighbourhood> ALL = List.of(
            new Neighbourhood("cetate", "Cetate", new GeoPoint(45.7568, 21.2290), 750),
            new Neighbourhood("fabric", "Fabric", new GeoPoint(45.7585, 21.2475), 900),
            new Neighbourhood("iosefin", "Iosefin", new GeoPoint(45.7495, 21.2105), 800),
            new Neighbourhood("elisabetin", "Elisabetin", new GeoPoint(45.7465, 21.2255), 750),
            new Neighbourhood("mehala", "Mehala", new GeoPoint(45.7660, 21.2010), 1000),
            new Neighbourhood("complex", "Complexul Studențesc", new GeoPoint(45.7475, 21.2395), 650),
            new Neighbourhood("circumvalatiunii", "Circumvalațiunii", new GeoPoint(45.7660, 21.2175), 700),
            new Neighbourhood("fratelia", "Fratelia", new GeoPoint(45.7270, 21.2070), 900),
            new Neighbourhood("soarelui", "Soarelui", new GeoPoint(45.7290, 21.2410), 900));

    // Utility class.
    private NeighbourhoodAreas() {
    }

    // The area a point belongs to: the nearest centre whose radius covers it, or empty when none does.
    public static Optional<Neighbourhood> assign(double lat, double lon) {
        return assign(lat, lon, ALL);
    }

    // Same check against a given list of areas.
    public static Optional<Neighbourhood> assign(double lat, double lon, List<Neighbourhood> areas) {
        if (!Double.isFinite(lat) || !Double.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
            return Optional.empty();
        }
        GeoPoint point = new GeoPoint(lat, lon);
        return areas.stream()
                .filter(area -> area.centre().distanceMetersTo(point) <= area.radiusMeters())
                .min(Comparator.comparingDouble(area -> area.centre().distanceMetersTo(point)));
    }

    // Area by id, or empty when unknown.
    public static Optional<Neighbourhood> byId(String id) {
        return ALL.stream().filter(area -> area.id().equals(id)).findFirst();
    }
}
