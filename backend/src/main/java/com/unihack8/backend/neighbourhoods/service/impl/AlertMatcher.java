package com.unihack8.backend.neighbourhoods.service.impl;

import com.unihack8.backend.common.text.TextMatch;
import com.unihack8.backend.transit.domain.dto.AlertDto;
import java.util.Collection;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * Decides whether an STPT service alert concerns an area: it names one of the area's lines
 * ("linia 8", "tramvaiele 1 și 2", "line E2") or one of its stops. A bare number on its own
 * (a date, a house number) never counts as a line.
 */
final class AlertMatcher {

    // A line word followed by one or more line names: "linia 8", "liniile 1, 2 si E4", "autobuzul 33b".
    private static final Pattern LINES = Pattern.compile(
            "\\b(?:lini(?:a|ei|e|ile|ilor)|line|lines|tramvai(?:ul|ele|elor)?|autobuz(?:ul|ele|elor)?"
                    + "|troleibuz(?:ul|ele|elor)?|expres(?:ul)?)"
                    + "\\s+((?:[a-z]{0,2}\\d{1,3}[a-z]?)(?:\\s*(?:,|si|and|/|-)\\s*[a-z]{0,2}\\d{1,3}[a-z]?)*)");
    private static final Pattern NAME = Pattern.compile("[a-z]{0,2}\\d{1,3}[a-z]?");
    // Stop names shorter than this are too likely to match by chance.
    private static final int MIN_STOP_NAME = 5;

    // Utility class.
    private AlertMatcher() {
    }

    // True when the alert names one of the lines (by display name) or contains one of the stop names.
    static boolean concerns(AlertDto alert, Collection<String> lineNames, Collection<String> stopNames) {
        String text = TextMatch.normalize((alert.title() == null ? "" : alert.title()) + " "
                + (alert.description() == null ? "" : alert.description()));
        if (text.isEmpty()) {
            return false;
        }
        Set<String> lines = lineNames.stream().map(n -> n.toLowerCase(Locale.ROOT)).collect(Collectors.toSet());
        if (!lines.isEmpty() && mentionedLines(text).stream().anyMatch(lines::contains)) {
            return true;
        }
        return stopNames.stream()
                .map(TextMatch::normalize)
                .filter(name -> name.length() >= MIN_STOP_NAME)
                .anyMatch(text::contains);
    }

    // Every line name written after a line word in already-normalised text.
    static Set<String> mentionedLines(String normalizedText) {
        Matcher lineList = LINES.matcher(normalizedText);
        Set<String> found = new java.util.HashSet<>();
        while (lineList.find()) {
            Matcher name = NAME.matcher(lineList.group(1));
            while (name.find()) {
                found.add(name.group());
            }
        }
        return found;
    }
}
