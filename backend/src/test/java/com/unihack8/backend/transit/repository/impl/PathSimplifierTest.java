package com.unihack8.backend.transit.repository.impl;

import static org.assertj.core.api.Assertions.assertThat;

import com.unihack8.backend.common.geo.GeoPoint;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;

/** Douglas-Peucker simplification of line paths. */
class PathSimplifierTest {

    // About 1.1 m of latitude.
    private static final double ONE_METER_LAT = 1 / 111_320.0;

    // A straight street with a point every meter collapses to its two ends.
    @Test
    void straightLineKeepsOnlyItsEnds() {
        List<GeoPoint> line = new ArrayList<>();
        for (int i = 0; i <= 500; i++) {
            line.add(new GeoPoint(45.75 + i * ONE_METER_LAT, 21.22));
        }
        assertThat(PathSimplifier.simplify(line, 5)).containsExactly(line.get(0), line.get(500));
    }

    // A real corner (about 100 m off the straight line) is kept, small wiggles under the tolerance are not.
    @Test
    void keepsCornersAndDropsWiggles() {
        GeoPoint start = new GeoPoint(45.75, 21.22);
        GeoPoint wiggle = new GeoPoint(45.7505, 21.22 + 0.00003); // about 2 m sideways
        GeoPoint corner = new GeoPoint(45.751, 21.22);
        GeoPoint end = new GeoPoint(45.751, 21.2213); // turns east, about 100 m
        List<GeoPoint> out = PathSimplifier.simplify(List.of(start, wiggle, corner, end), 5);
        assertThat(out).containsExactly(start, corner, end);
    }

    // Every dropped point stays within the tolerance of the simplified path, and far fewer points remain.
    @Test
    void droppedPointsStayWithinTolerance() {
        List<GeoPoint> curve = new ArrayList<>();
        for (int i = 0; i <= 720; i++) {
            double a = Math.toRadians(i / 4.0);
            curve.add(new GeoPoint(45.75 + Math.sin(a) * 0.003, 21.22 + Math.cos(a) * 0.004)); // ~300 m arc
        }
        List<GeoPoint> out = PathSimplifier.simplify(curve, 5);
        assertThat(out.size()).isLessThan(curve.size() / 5);
        assertThat(out.get(0)).isEqualTo(curve.get(0));
        assertThat(out.get(out.size() - 1)).isEqualTo(curve.get(curve.size() - 1));
        double lonScale = Math.cos(Math.toRadians(45.75)) * 111_320;
        for (GeoPoint p : curve) {
            double best = Double.MAX_VALUE;
            for (int i = 0; i + 1 < out.size(); i++) {
                GeoPoint a = out.get(i);
                GeoPoint b = out.get(i + 1);
                best = Math.min(best, PathSimplifier.distanceToSegment(p.lon() * lonScale, p.lat() * 111_320,
                        a.lon() * lonScale, a.lat() * 111_320, b.lon() * lonScale, b.lat() * 111_320));
            }
            assertThat(best).isLessThanOrEqualTo(5.0 + 1e-6);
        }
    }

    // Short paths come back as they are.
    @Test
    void shortPathsUnchanged() {
        List<GeoPoint> two = List.of(new GeoPoint(45.75, 21.22), new GeoPoint(45.76, 21.23));
        assertThat(PathSimplifier.simplify(two, 5)).isSameAs(two);
        assertThat(PathSimplifier.simplify(List.of(), 5)).isEmpty();
    }
}
