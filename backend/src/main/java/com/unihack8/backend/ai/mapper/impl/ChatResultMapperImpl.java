package com.unihack8.backend.ai.mapper.impl;

import com.unihack8.backend.ai.domain.ToolContext;
import com.unihack8.backend.ai.domain.dto.ChatResponse;
import com.unihack8.backend.ai.domain.dto.SourceDto;
import com.unihack8.backend.ai.mapper.ChatResultMapper;
import com.unihack8.backend.common.text.TextMatch;
import com.unihack8.backend.events.domain.dto.EventSummary;
import com.unihack8.backend.places.domain.dto.PlaceSummaryDto;
import com.unihack8.backend.places.domain.dto.PriceDto;
import java.net.URI;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.stereotype.Component;

/**
 * Finds which places/events the reply names. The system prompt asks the model to write every
 * recommended name in **bold**; those bold names are matched against what the tools returned. If
 * the model used no bold at all, whole-word name matches in the text are used instead. The bold
 * markers are removed from the reply the app shows.
 */
@Component
public class ChatResultMapperImpl implements ChatResultMapper {

    static final int MAX_SOURCES = 5;
    private static final Pattern BOLD = Pattern.compile("\\*\\*(.+?)\\*\\*");
    // Names shorter than this are too likely to be ordinary words ("Opera", "Cafea" are 5, so allowed).
    private static final int MIN_PLAIN_NAME_LENGTH = 4;

    // Picks the mentioned items in reply order and collects their price sources.
    @Override
    public ChatResponse toResponse(String modelReply, ToolContext context) {
        String reply = modelReply == null ? "" : modelReply.trim();
        List<String> bold = new ArrayList<>();
        Matcher matcher = BOLD.matcher(reply);
        while (matcher.find()) {
            bold.add(TextMatch.normalize(matcher.group(1)));
        }
        // Plain text for the app: no bold markers, no stray code ticks.
        String plainReply = BOLD.matcher(reply).replaceAll("$1").replace("`", "");
        String normalizedReply = TextMatch.normalize(plainReply);

        Map<String, Mention<ToolContext.FoundPlace>> places = new LinkedHashMap<>();
        for (ToolContext.FoundPlace found : context.places()) {
            String name = TextMatch.normalize(found.place().name());
            int position = position(name, bold, normalizedReply);
            if (position >= 0) {
                places.putIfAbsent(name, new Mention<>(found, position));
            }
        }
        Map<String, Mention<EventSummary>> events = new LinkedHashMap<>();
        for (EventSummary event : context.events()) {
            String title = TextMatch.normalize(event.title());
            int position = position(title, bold, normalizedReply);
            if (position >= 0) {
                events.putIfAbsent(title, new Mention<>(event, position));
            }
        }

        List<ToolContext.FoundPlace> mentionedPlaces = sorted(places.values());
        List<PlaceSummaryDto> placeCards = mentionedPlaces.stream().map(ToolContext.FoundPlace::place).toList();
        List<EventSummary> eventCards = sorted(events.values());
        return new ChatResponse(plainReply, placeCards, eventCards, sources(mentionedPlaces));
    }

    /**
     * Where the name first appears in the reply, or -1 when it is not mentioned. With bold text, a
     * name counts only when a bold segment contains it (or is a long part of it).
     */
    static int position(String name, List<String> bold, String normalizedReply) {
        if (name.isEmpty()) {
            return -1;
        }
        if (!bold.isEmpty()) {
            boolean mentioned = bold.stream().anyMatch(b -> b.contains(name)
                    || (b.length() >= MIN_PLAIN_NAME_LENGTH && name.contains(b)));
            if (!mentioned) {
                return -1;
            }
            int index = normalizedReply.indexOf(name);
            return index >= 0 ? index : firstBoldIndex(name, bold, normalizedReply);
        }
        if (name.length() < MIN_PLAIN_NAME_LENGTH) {
            return -1;
        }
        Matcher word = Pattern.compile("(?<![\\p{L}\\p{N}])" + Pattern.quote(name) + "(?![\\p{L}\\p{N}])")
                .matcher(normalizedReply);
        return word.find() ? word.start() : -1;
    }

    // Position of the bold segment that is part of the name (when the model shortened the name).
    private static int firstBoldIndex(String name, List<String> bold, String normalizedReply) {
        for (String segment : bold) {
            if (name.contains(segment)) {
                int index = normalizedReply.indexOf(segment);
                if (index >= 0) {
                    return index;
                }
            }
        }
        return Integer.MAX_VALUE;
    }

    // Items in the order they appear in the reply.
    private static <T> List<T> sorted(java.util.Collection<Mention<T>> mentions) {
        return mentions.stream().sorted(Comparator.comparingInt(Mention::position)).map(Mention::item).toList();
    }

    // Distinct price source pages of the mentioned places (max 5).
    private static List<SourceDto> sources(List<ToolContext.FoundPlace> places) {
        Set<String> seen = new HashSet<>();
        List<SourceDto> sources = new ArrayList<>();
        for (ToolContext.FoundPlace found : places) {
            for (PriceDto price : found.prices()) {
                String url = price.sourceUrl();
                if (url != null && !url.isBlank() && seen.add(url) && sources.size() < MAX_SOURCES) {
                    sources.add(new SourceDto(found.place().name() + " prices (" + host(url) + ")", url));
                }
            }
        }
        return sources;
    }

    // "glovoapp.com" from a URL, or the URL itself when it cannot be parsed.
    private static String host(String url) {
        try {
            String host = URI.create(url).getHost();
            return host == null ? url : host.replaceFirst("^www\\.", "");
        } catch (IllegalArgumentException e) {
            return url;
        }
    }

    /** An item and where it first appears in the reply. */
    private record Mention<T>(T item, int position) {
    }
}
