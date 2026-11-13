package com.unihack8.backend.eventimport.mapper.impl;

import com.unihack8.backend.eventimport.client.dto.LiveTicketsEvent;
import com.unihack8.backend.eventimport.config.EventImportProperties;
import com.unihack8.backend.eventimport.domain.dto.ImportedEvent;
import com.unihack8.backend.eventimport.mapper.LiveTicketsEventMapper;
import java.math.BigDecimal;
import java.text.Normalizer;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeParseException;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.regex.Pattern;
import org.springframework.stereotype.Component;
import org.springframework.web.util.HtmlUtils;

/**
 * Mapping rules: only events in the configured city; times are Romanian local time; description
 * HTML becomes plain text; the category is guessed from words in the title and description
 * (LiveTickets has no category field); image and ticket links point to LiveTickets.
 */
@Component
public class LiveTicketsEventMapperImpl implements LiveTicketsEventMapper {

    public static final String EXTERNAL_ID_PREFIX = "livetickets:";
    static final ZoneId ROMANIA = ZoneId.of("Europe/Bucharest");
    static final String IMAGE_BASE = "https://livetickets-cdn.azureedge.net/itemimages/";
    static final String TICKET_PAGE_BASE = "https://www.livetickets.ro/bilete/";
    static final int MAX_DESCRIPTION_LENGTH = 4000;

    /**
     * Category keywords (lowercase, without diacritics), checked in this order; the first category
     * with a matching word wins, OTHER otherwise. Words match whole words only.
     */
    static final List<Map.Entry<String, List<String>>> CATEGORY_KEYWORDS = List.of(
            Map.entry("THEATRE", List.of("teatru", "theatre", "theater", "spectacol", "stand-up", "standup",
                    "stand up", "comedy", "comedie", "opera", "balet", "ballet", "musical", "improv")),
            Map.entry("CONCERT", List.of("concert", "concerte", "live", "tour", "turneu", "album", "orchestra",
                    "orchestre", "recital", "simfonic", "acoustic", "acustic", "band", "trupa", "festival")),
            Map.entry("SPORT", List.of("sport", "meci", "match", "maraton", "marathon", "fotbal", "football",
                    "baschet", "basketball", "handbal", "volei", "fitness", "yoga", "box", "kickbox", "alergare")),
            Map.entry("GAMES", List.of("board game", "board games", "jocuri", "quiz", "trivia", "gaming",
                    "escape room", "poker", "bingo")),
            Map.entry("PARTY", List.of("party", "petrecere", "club", "dj", "rave", "techno", "house", "disco",
                    "bal", "balul", "revelion", "nye", "night", "noapte", "afterparty", "manele", "maneliada",
                    "retro", "hits")),
            Map.entry("FOOD", List.of("food", "degustare", "tasting", "wine", "vin", "beer", "bere", "brunch",
                    "gastronomic", "street food", "cina", "dinner")),
            Map.entry("ART", List.of("expozitie", "exhibition", "galerie", "gallery", "art", "arta", "film",
                    "cinema", "vernisaj", "muzeu", "museum")),
            Map.entry("MEETUP", List.of("meetup", "networking", "conferinta", "conference", "workshop", "talk",
                    "hackathon", "summit", "curs", "masterclass")));


    private static final Pattern TAGS = Pattern.compile("<[^>]+>");
    private static final Pattern LINE_BREAKS = Pattern.compile("(?i)<\\s*(br|/p|/div|/li|/h[1-6])\\s*/?\\s*>");
    private static final Pattern SPACES = Pattern.compile("[ \\t\\x0B\\f\\u00A0]+");
    private static final Pattern BLANK_LINES = Pattern.compile("\\n\\s*\\n\\s*(\\n\\s*)+");
    private static final Pattern DIACRITICS = Pattern.compile("\\p{M}+");

    private final String wantedCity;

    // Remembers which city to keep.
    public LiveTicketsEventMapperImpl(EventImportProperties properties) {
        this.wantedCity = normalize(properties.city());
    }

    // Applies the rules above; empty means "skip this event".
    @Override
    public Optional<ImportedEvent> toImportedEvent(LiveTicketsEvent event) {
        if (event == null || blank(event.eventId()) || blank(event.name()) || blank(event.startDate())) {
            return Optional.empty();
        }
        if (!wantedCity.equals(normalize(event.city()))) {
            return Optional.empty();
        }
        Instant startsAt = romanianTime(event.startDate());
        if (startsAt == null) {
            return Optional.empty();
        }
        Instant endsAt = romanianTime(event.endDate());
        if (endsAt != null && !endsAt.isAfter(startsAt)) {
            endsAt = null;
        }
        String title = event.name().trim();
        String description = plainText(event.description());
        BigDecimal priceMin = nonNegative(event.priceMin());
        BigDecimal priceMax = nonNegative(event.priceMax());
        if (priceMin != null && priceMax != null && priceMax.compareTo(priceMin) < 0) {
            BigDecimal swap = priceMin;
            priceMin = priceMax;
            priceMax = swap;
        }
        return Optional.of(new ImportedEvent(
                EXTERNAL_ID_PREFIX + event.eventId().trim(),
                title,
                description,
                guessCategory(title, description),
                blank(event.location()) ? null : event.location().trim(),
                startsAt,
                endsAt,
                imageUrl(event),
                priceMin,
                priceMax,
                blank(event.url()) ? null : TICKET_PAGE_BASE + event.url().trim()));
    }

    /**
     * Category from the title's words; only when the title gives no clue, from the description's
     * (descriptions mention "live", "club"... too loosely to beat the title). OTHER if neither matches.
     */
    public static String guessCategory(String title, String description) {
        String fromTitle = categoryOf(title);
        return fromTitle != null ? fromTitle : Optional.ofNullable(categoryOf(description)).orElse("OTHER");
    }

    // First category with a keyword appearing as a whole word in the text, or null.
    private static String categoryOf(String text) {
        if (blank(text)) {
            return null;
        }
        String words = " " + normalize(text).replaceAll("[^a-z0-9]+", " ") + " ";
        for (Map.Entry<String, List<String>> category : CATEGORY_KEYWORDS) {
            for (String keyword : category.getValue()) {
                if (words.contains(" " + keyword.replace("-", " ") + " ")) {
                    return category.getKey();
                }
            }
        }
        return null;
    }

    /** HTML to readable plain text: line breaks kept, tags removed, entities decoded, max 4000 chars. */
    static String plainText(String html) {
        if (blank(html)) {
            return null;
        }
        String text = LINE_BREAKS.matcher(html.replace("\r", "")).replaceAll("\n");
        text = TAGS.matcher(text).replaceAll("");
        text = HtmlUtils.htmlUnescape(text);
        text = SPACES.matcher(text).replaceAll(" ");
        text = text.lines().map(String::strip).reduce((a, b) -> a + "\n" + b).orElse("");
        text = BLANK_LINES.matcher(text).replaceAll("\n\n").strip();
        if (text.isEmpty()) {
            return null;
        }
        return text.length() <= MAX_DESCRIPTION_LENGTH ? text : text.substring(0, MAX_DESCRIPTION_LENGTH - 1).strip() + "…";
    }

    // Lowercase, without diacritics or surrounding spaces ("Timișoara" -> "timisoara").
    static String normalize(String text) {
        if (text == null) {
            return "";
        }
        String decomposed = Normalizer.normalize(text.replace('ş', 's').replace('ţ', 't')
                .replace('Ş', 'S').replace('Ţ', 'T'), Normalizer.Form.NFD);
        return DIACRITICS.matcher(decomposed).replaceAll("").toLowerCase(Locale.ROOT).trim();
    }

    // "2026-11-13T23:00:00" in Romanian local time -> instant; null when missing or malformed.
    private static Instant romanianTime(String value) {
        if (blank(value)) {
            return null;
        }
        try {
            return LocalDateTime.parse(value.trim()).atZone(ROMANIA).toInstant();
        } catch (DateTimeParseException e) {
            return null;
        }
    }

    // Image on the LiveTickets CDN with its cache token, as their website builds it.
    private static String imageUrl(LiveTicketsEvent event) {
        if (blank(event.image())) {
            return null;
        }
        String url = IMAGE_BASE + event.image().trim().replaceFirst("^/+", "");
        return blank(event.imageToken()) ? url : url + "?" + event.imageToken().trim();
    }

    // Prices below zero are treated as unknown.
    private static BigDecimal nonNegative(BigDecimal price) {
        return price == null || price.signum() < 0 ? null : price;
    }

    // True for null or whitespace-only values.
    private static boolean blank(String value) {
        return value == null || value.isBlank();
    }
}
