package com.unihack8.backend.ai.tool;

import com.unihack8.backend.ai.domain.ToolContext;
import com.unihack8.backend.common.geo.GeoPoint;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/** Reads tool arguments leniently (the model may send numbers as strings, one value instead of a list...). */
public final class ToolArgs {

    private static final DateTimeFormatter LOCAL_TIME = DateTimeFormatter.ofPattern("EEE d MMM yyyy, HH:mm", Locale.ENGLISH);

    // Utility class.
    private ToolArgs() {
    }

    // Trimmed text, or null when missing/blank.
    public static String text(Map<String, Object> args, String key) {
        Object value = args == null ? null : args.get(key);
        if (value == null) {
            return null;
        }
        String text = value.toString().trim();
        return text.isEmpty() ? null : text;
    }

    // Number, or null when missing; ToolException when not a number.
    public static Double number(Map<String, Object> args, String key) {
        Object value = args == null ? null : args.get(key);
        if (value == null) {
            return null;
        }
        if (value instanceof Number n) {
            return n.doubleValue();
        }
        try {
            return Double.parseDouble(value.toString().trim());
        } catch (NumberFormatException e) {
            throw new ToolException(key + " must be a number");
        }
    }

    // Whole number clamped to [min, max], or the default when missing.
    public static int integer(Map<String, Object> args, String key, int defaultValue, int min, int max) {
        Double value = number(args, key);
        int result = value == null ? defaultValue : (int) Math.round(value);
        return Math.max(min, Math.min(max, result));
    }

    // true/false, or the default when missing.
    public static boolean bool(Map<String, Object> args, String key, boolean defaultValue) {
        Object value = args == null ? null : args.get(key);
        if (value == null) {
            return defaultValue;
        }
        return value instanceof Boolean b ? b : Boolean.parseBoolean(value.toString().trim());
    }

    // List of texts; accepts a JSON list or a comma-separated text.
    public static List<String> texts(Map<String, Object> args, String key) {
        Object value = args == null ? null : args.get(key);
        List<String> result = new ArrayList<>();
        if (value instanceof Collection<?> items) {
            items.forEach(item -> addSplit(result, String.valueOf(item)));
        } else if (value != null) {
            addSplit(result, value.toString());
        }
        return result;
    }

    // Point from <prefix>_lat / <prefix>_lon, or null when either is missing.
    public static GeoPoint point(Map<String, Object> args, String prefix) {
        Double lat = number(args, prefix + "_lat");
        Double lon = number(args, prefix + "_lon");
        if (lat == null || lon == null) {
            return null;
        }
        try {
            return new GeoPoint(lat, lon);
        } catch (IllegalArgumentException e) {
            throw new ToolException(prefix + "_lat/" + prefix + "_lon are not valid coordinates");
        }
    }

    /**
     * Time from "2026-11-14", "2026-11-14T19:00" (Romanian local time) or an ISO time with offset.
     * A bare date means the start of that day, or its end when endOfDay is true.
     */
    public static Instant time(Map<String, Object> args, String key, boolean endOfDay) {
        String value = text(args, key);
        if (value == null) {
            return null;
        }
        try {
            if (value.length() == 10) {
                LocalDate date = LocalDate.parse(value);
                LocalDateTime local = endOfDay ? date.atTime(23, 59, 59) : date.atStartOfDay();
                return local.atZone(ToolContext.ZONE).toInstant();
            }
            if (value.endsWith("Z") || value.matches(".*[+-]\\d\\d:\\d\\d$")) {
                return OffsetDateTime.parse(value).toInstant();
            }
            return LocalDateTime.parse(value).atZone(ToolContext.ZONE).toInstant();
        } catch (DateTimeParseException e) {
            throw new ToolException(key + " must look like 2026-11-14 or 2026-11-14T19:00");
        }
    }

    // "Sat 14 Nov 2026, 21:00" in Romanian local time, or null.
    public static String localTime(Instant instant) {
        return instant == null ? null : LOCAL_TIME.format(instant.atZone(ToolContext.ZONE));
    }

    // "21:00" in Romanian local time, or null.
    public static String localClock(Instant instant) {
        return instant == null ? null : DateTimeFormatter.ofPattern("HH:mm").format(instant.atZone(ToolContext.ZONE));
    }

    // Walking minutes for a distance (about 80 m per minute), at least 1.
    public static int walkMinutes(double meters) {
        return Math.max(1, (int) Math.ceil(meters / 80.0));
    }

    // Adds the non-blank comma-separated pieces of a text.
    private static void addSplit(List<String> into, String text) {
        for (String piece : text.split(",")) {
            if (!piece.isBlank()) {
                into.add(piece.trim());
            }
        }
    }
}
