package com.unihack8.backend.neighbourhoods.domain.model;

import static org.assertj.core.api.Assertions.assertThat;

import com.unihack8.backend.common.geo.GeoPoint;
import java.util.HashSet;
import java.util.List;
import org.junit.jupiter.api.Test;

/** Point-in-radius assignment of items to Timișoara areas. */
class NeighbourhoodAreasTest {

    // Piața Unirii is in Cetate, Piața Traian in Fabric, the Iosefin water tower in Iosefin.
    @Test
    void knownLandmarksLandInTheirArea() {
        assertThat(NeighbourhoodAreas.assign(45.7580, 21.2290)).map(Neighbourhood::id).hasValue("cetate");
        assertThat(NeighbourhoodAreas.assign(45.7600, 21.2490)).map(Neighbourhood::id).hasValue("fabric");
        assertThat(NeighbourhoodAreas.assign(45.7495, 21.2110)).map(Neighbourhood::id).hasValue("iosefin");
    }

    // A point far outside the city belongs to no area.
    @Test
    void outsideEveryAreaIsEmpty() {
        assertThat(NeighbourhoodAreas.assign(44.4268, 26.1025)).isEmpty();
        assertThat(NeighbourhoodAreas.assign(Double.NaN, 21.2)).isEmpty();
    }

    // Where two circles overlap the nearer centre wins.
    @Test
    void overlapGoesToNearestCentre() {
        List<Neighbourhood> areas = List.of(
                new Neighbourhood("a", "A", new GeoPoint(45.75, 21.20), 2000),
                new Neighbourhood("b", "B", new GeoPoint(45.75, 21.22), 2000));
        assertThat(NeighbourhoodAreas.assign(45.75, 21.205, areas)).map(Neighbourhood::id).hasValue("a");
        assertThat(NeighbourhoodAreas.assign(45.75, 21.215, areas)).map(Neighbourhood::id).hasValue("b");
    }

    // The point exactly on the radius is still inside.
    @Test
    void edgeOfRadiusIsInside() {
        Neighbourhood area = new Neighbourhood("a", "A", new GeoPoint(45.75, 21.20), 1000);
        GeoPoint edge = new GeoPoint(45.75 + Math.toDegrees(999.0 / 6_371_000), 21.20);
        assertThat(NeighbourhoodAreas.assign(edge.lat(), edge.lon(), List.of(area))).isPresent();
    }

    // Ids are unique and each area can be found by id.
    @Test
    void idsAreUniqueAndFindable() {
        assertThat(new HashSet<>(NeighbourhoodAreas.ALL.stream().map(Neighbourhood::id).toList()))
                .hasSize(NeighbourhoodAreas.ALL.size());
        assertThat(NeighbourhoodAreas.byId("mehala")).map(Neighbourhood::name).hasValue("Mehala");
        assertThat(NeighbourhoodAreas.byId("nope")).isEmpty();
    }
}
