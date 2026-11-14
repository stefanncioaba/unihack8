package com.unihack8.backend.transit.repository.impl;

import com.unihack8.backend.common.geo.GeoPoint;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.List;

/**
 * Douglas-Peucker simplification of a line path: drops the points that lie within a tolerance (meters) of the line
 * through their neighbours. The STPT shapes have a point every few meters (41,729 points for 181 shapes); at 5 m the
 * drawn lines look the same and the map draws about a quarter of the points, which keeps panning smooth.
 */
public final class PathSimplifier {

    /** Tolerance used for the line shapes, in meters. */
    public static final double SHAPE_TOLERANCE_METERS = 5;

    private static final double METERS_PER_DEGREE = 111_320;

    // Utility class.
    private PathSimplifier() {
    }

    // The path without the points closer than toleranceMeters to the simplified line; the first and last points
    // always stay. Paths of fewer than three points come back unchanged.
    public static List<GeoPoint> simplify(List<GeoPoint> points, double toleranceMeters) {
        int n = points.size();
        if (n < 3) {
            return points;
        }
        // Local flat projection in meters (fine at city scale).
        double lonScale = Math.cos(Math.toRadians(points.get(0).lat())) * METERS_PER_DEGREE;
        double[] x = new double[n];
        double[] y = new double[n];
        for (int i = 0; i < n; i++) {
            x[i] = points.get(i).lon() * lonScale;
            y[i] = points.get(i).lat() * METERS_PER_DEGREE;
        }
        boolean[] keep = new boolean[n];
        keep[0] = true;
        keep[n - 1] = true;
        // Iterative, so a very long path cannot overflow the stack.
        Deque<int[]> ranges = new ArrayDeque<>();
        ranges.push(new int[] {0, n - 1});
        while (!ranges.isEmpty()) {
            int[] range = ranges.pop();
            int a = range[0];
            int b = range[1];
            double worst = -1;
            int worstIndex = -1;
            for (int i = a + 1; i < b; i++) {
                double d = distanceToSegment(x[i], y[i], x[a], y[a], x[b], y[b]);
                if (d > worst) {
                    worst = d;
                    worstIndex = i;
                }
            }
            if (worstIndex >= 0 && worst > toleranceMeters) {
                keep[worstIndex] = true;
                ranges.push(new int[] {a, worstIndex});
                ranges.push(new int[] {worstIndex, b});
            }
        }
        List<GeoPoint> out = new ArrayList<>();
        for (int i = 0; i < n; i++) {
            if (keep[i]) {
                out.add(points.get(i));
            }
        }
        return List.copyOf(out);
    }

    // Distance from point p to the segment a-b (all in projected meters).
    static double distanceToSegment(double px, double py, double ax, double ay, double bx, double by) {
        double dx = bx - ax;
        double dy = by - ay;
        double lengthSquared = dx * dx + dy * dy;
        double t = lengthSquared == 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSquared));
        return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
    }
}
