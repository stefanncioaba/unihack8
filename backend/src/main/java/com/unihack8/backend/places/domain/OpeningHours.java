package com.unihack8.backend.places.domain;

import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Reads the common forms of OpenStreetMap opening_hours ("Mo-Fr 08:00-22:00; Sa,Su 10:00-22:00",
 * "Mo-Su 09:00-24:00", "24/7", "18:00-02:00", "Su off") and says whether a place is open at a given
 * local time. Anything it does not understand (public holidays, months, "sunset"...) gives
 * "unknown" rather than a wrong answer.
 */
public final class OpeningHours {

    private static final List<String> DAYS = List.of("mo", "tu", "we", "th", "fr", "sa", "su");
    private static final Pattern RANGE = Pattern.compile("(\\d{1,2}):(\\d{2})\\s*-\\s*(\\d{1,2}):(\\d{2})\\+?");
    private static final Pattern DAY_PART = Pattern.compile("^([A-Za-z]{2}(?:\\s*[-,]\\s*[A-Za-z]{2})*)\\s+(.*)$");

    /** Result of a check: open is null when the text could not be understood. */
    public record Status(Boolean open, String until) {
        static final Status UNKNOWN = new Status(null, null);
    }

    // Utility class.
    private OpeningHours() {
    }

    /**
     * Whether the place is open at the local time; until = "HH:mm" when it closes (if open) or
     * the next opening today (if closed and it opens later today), otherwise null.
     */
    public static Status at(String openingHours, LocalDateTime local) {
        if (openingHours == null || openingHours.isBlank()) {
            return Status.UNKNOWN;
        }
        String text = openingHours.trim();
        if (text.equals("24/7")) {
            return new Status(true, null);
        }
        Optional<List<Interval>> parsed = parse(text);
        if (parsed.isEmpty()) {
            return Status.UNKNOWN;
        }
        List<Interval> intervals = parsed.get();
        int today = local.getDayOfWeek().getValue() - 1;
        int minute = local.getHour() * 60 + local.getMinute();
        // Absolute minutes from Monday 00:00 of this week; yesterday's after-midnight hours count too.
        int now = today * 1440 + minute;
        for (Interval interval : intervals) {
            for (int shift : new int[] {0, 7 * 1440, -7 * 1440}) {
                int start = interval.start() + shift;
                int end = interval.end() + shift;
                if (now >= start && now < end) {
                    return new Status(true, clock(end));
                }
            }
        }
        Integer nextToday = intervals.stream()
                .filter(i -> i.start() > now && i.start() < (today + 1) * 1440)
                .map(Interval::start).min(Integer::compare).orElse(null);
        return new Status(false, nextToday == null ? null : clock(nextToday));
    }

    // Every opening interval in minutes from Monday 00:00, or empty when the text is not understood.
    static Optional<List<Interval>> parse(String text) {
        List<Interval>[] perDay = newDayLists();
        for (String rawRule : text.split(";")) {
            String rule = rawRule.trim();
            if (rule.isEmpty()) {
                continue;
            }
            List<Integer> days;
            String times;
            Matcher dayMatcher = DAY_PART.matcher(rule);
            if (Character.isDigit(rule.charAt(0))) {
                days = List.of(0, 1, 2, 3, 4, 5, 6);
                times = rule;
            } else if (dayMatcher.matches()) {
                Optional<List<Integer>> parsedDays = days(dayMatcher.group(1));
                if (parsedDays.isEmpty()) {
                    return Optional.empty();
                }
                days = parsedDays.get();
                times = dayMatcher.group(2).trim();
            } else {
                return Optional.empty();
            }
            List<int[]> ranges = new ArrayList<>();
            if (!times.equalsIgnoreCase("off") && !times.equalsIgnoreCase("closed")) {
                for (String piece : times.split(",")) {
                    Matcher range = RANGE.matcher(piece.trim());
                    if (!range.matches()) {
                        return Optional.empty();
                    }
                    int from = Integer.parseInt(range.group(1)) * 60 + Integer.parseInt(range.group(2));
                    int to = Integer.parseInt(range.group(3)) * 60 + Integer.parseInt(range.group(4));
                    if (to <= from) {
                        to += 1440; // closes after midnight
                    }
                    ranges.add(new int[] {from, to});
                }
            }
            // A later rule for the same day replaces the earlier one (OSM semantics).
            for (int day : days) {
                perDay[day].clear();
                for (int[] range : ranges) {
                    perDay[day].add(new Interval(day * 1440 + range[0], day * 1440 + range[1]));
                }
            }
        }
        List<Interval> all = new ArrayList<>();
        for (List<Interval> day : perDay) {
            all.addAll(day);
        }
        return Optional.of(all);
    }

    // "Mo-Fr", "Sa,Su", "Mo-We,Fr" -> day indexes (0 = Monday).
    private static Optional<List<Integer>> days(String spec) {
        List<Integer> result = new ArrayList<>();
        for (String part : spec.toLowerCase(Locale.ROOT).replace(" ", "").split(",")) {
            String[] ends = part.split("-");
            int from = DAYS.indexOf(ends[0]);
            int to = ends.length > 1 ? DAYS.indexOf(ends[1]) : from;
            if (from < 0 || to < 0 || ends.length > 2) {
                return Optional.empty();
            }
            for (int day = from; ; day = (day + 1) % 7) {
                result.add(day);
                if (day == to) {
                    break;
                }
            }
        }
        return Optional.of(result);
    }

    // Minutes from Monday 00:00 -> "HH:mm" (24:00 stays "24:00").
    private static String clock(int absoluteMinutes) {
        int inDay = Math.floorMod(absoluteMinutes, 1440);
        if (inDay == 0 && absoluteMinutes > 0) {
            return "24:00";
        }
        return LocalTime.of(inDay / 60, inDay % 60).toString();
    }

    @SuppressWarnings("unchecked")
    private static List<Interval>[] newDayLists() {
        List<Interval>[] lists = new List[7];
        for (int i = 0; i < 7; i++) {
            lists[i] = new ArrayList<>();
        }
        return lists;
    }

    /** One opening period in minutes from Monday 00:00 (end may pass Sunday midnight). */
    record Interval(int start, int end) {
    }
}
