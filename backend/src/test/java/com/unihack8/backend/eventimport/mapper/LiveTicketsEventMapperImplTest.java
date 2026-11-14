package com.unihack8.backend.eventimport.mapper;

import static org.assertj.core.api.Assertions.assertThat;

import com.unihack8.backend.eventimport.client.dto.LiveTicketsEvent;
import com.unihack8.backend.eventimport.config.EventImportProperties;
import com.unihack8.backend.eventimport.domain.dto.ImportedEvent;
import com.unihack8.backend.eventimport.mapper.impl.LiveTicketsEventMapperImpl;
import com.unihack8.backend.eventimport.support.LiveTicketsFixtures;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

/** LiveTickets event -> events row rules (PLAN 7.2), on a real saved LiveTickets response. */
class LiveTicketsEventMapperImplTest {

    private final LiveTicketsEventMapper mapper = new LiveTicketsEventMapperImpl(EventImportProperties.defaults());

    // Builds a minimal event in Timișoara.
    private static LiveTicketsEvent event(String name, String description, String start, String end) {
        return new LiveTicketsEvent("id-1", "slug", name, description, "Heaven", "Timișoara", start, end,
                new BigDecimal("30"), new BigDecimal("50"), "slug/Background_MEDIUM.jpg", "tok");
    }

    // Only the 8 Timișoara events survive; other cities and a missing city are skipped.
    @Test
    void keepsOnlyTheCity()  {
        List<ImportedEvent> mapped = LiveTicketsFixtures.sample().stream().map(mapper::toImportedEvent).flatMap(Optional::stream).toList();
        assertThat(mapped).hasSize(8);
        assertThat(mapped).allSatisfy(e -> assertThat(e.externalId()).startsWith("livetickets:"));
    }

    // The first saved event mapped field by field.
    @Test
    void mapsAllFields()  {
        LiveTicketsEvent source = LiveTicketsFixtures.sample().get(0);
        ImportedEvent event = mapper.toImportedEvent(source).orElseThrow();

        assertThat(event.externalId()).isEqualTo("livetickets:" + source.eventId());
        assertThat(event.title()).isEqualTo("ALBWHO at Fratelli Timisoara");
        assertThat(event.venueName()).isEqualTo("Fratelli Lounge & Club Timisoara");
        assertThat(event.category()).isEqualTo("PARTY");
        // 23:00 in Romania in November (UTC+2) is 21:00 UTC.
        assertThat(event.startsAt()).isEqualTo(Instant.parse("2026-11-13T21:00:00Z"));
        assertThat(event.endsAt()).isEqualTo(Instant.parse("2026-11-14T03:00:00Z"));
        assertThat(event.priceMin()).isEqualByComparingTo("40");
        assertThat(event.priceMax()).isEqualByComparingTo("50");
        assertThat(event.imageUrl()).isEqualTo("https://livetickets-cdn.azureedge.net/itemimages/"
                + "albwho-at-fratelli-timisoara/Background_MEDIUM.jpg?" + source.imageToken());
        assertThat(event.externalUrl()).isEqualTo("https://www.livetickets.ro/bilete/albwho-at-fratelli-timisoara");
        assertThat(event.description()).doesNotContain("<br").doesNotContain("&rsquo;").contains("we’re");
    }

    // Summer time: 20:00 in Romania in July (UTC+3) is 17:00 UTC.
    @Test
    void convertsRomanianSummerTime() {
        ImportedEvent event = mapper.toImportedEvent(event("Summer party", null, "2026-07-10T20:00:00", null)).orElseThrow();
        assertThat(event.startsAt()).isEqualTo(Instant.parse("2026-07-10T17:00:00Z"));
        assertThat(event.endsAt()).isNull();
    }

    // An end time not after the start is dropped (the events table rejects it).
    @Test
    void dropsEndBeforeStart() {
        ImportedEvent event = mapper.toImportedEvent(
                event("Party", null, "2026-11-20T22:00:00", "2026-11-20T21:00:00")).orElseThrow();
        assertThat(event.endsAt()).isNull();
    }

    // "Timisoara" without diacritics and with other casing still counts as the city.
    @Test
    void cityComparisonIgnoresDiacriticsAndCase() {
        LiveTicketsEvent plain = new LiveTicketsEvent("id-2", "s", "Party", null, "Heaven", " TIMISOARA ",
                "2026-11-20T22:00:00", null, null, null, null, null);
        assertThat(mapper.toImportedEvent(plain)).isPresent();
    }

    // Missing id, name or start time, or an unparseable start, means "skip".
    @Test
    void skipsIncompleteEvents() {
        assertThat(mapper.toImportedEvent(null)).isEmpty();
        assertThat(mapper.toImportedEvent(new LiveTicketsEvent(null, "s", "Party", null, "Heaven", "Timișoara",
                "2026-11-20T22:00:00", null, null, null, null, null))).isEmpty();
        assertThat(mapper.toImportedEvent(event(" ", null, "2026-11-20T22:00:00", null))).isEmpty();
        assertThat(mapper.toImportedEvent(event("Party", null, "tomorrow", null))).isEmpty();
    }

    // No image or slug gives null links; swapped prices are put in order; negative prices are dropped.
    @Test
    void handlesMissingLinksAndOddPrices() {
        LiveTicketsEvent odd = new LiveTicketsEvent("id-3", null, "Party", null, null, "Timișoara",
                "2026-11-20T22:00:00", null, new BigDecimal("80"), new BigDecimal("20"), null, null);
        ImportedEvent event = mapper.toImportedEvent(odd).orElseThrow();
        assertThat(event.imageUrl()).isNull();
        assertThat(event.externalUrl()).isNull();
        assertThat(event.venueName()).isNull();
        assertThat(event.priceMin()).isEqualByComparingTo("20");
        assertThat(event.priceMax()).isEqualByComparingTo("80");

        LiveTicketsEvent negative = new LiveTicketsEvent("id-4", "s", "Party", null, "Heaven", "Timișoara",
                "2026-11-20T22:00:00", null, new BigDecimal("-1"), null, "img.jpg", null);
        ImportedEvent cleaned = mapper.toImportedEvent(negative).orElseThrow();
        assertThat(cleaned.priceMin()).isNull();
        assertThat(cleaned.imageUrl()).isEqualTo("https://livetickets-cdn.azureedge.net/itemimages/img.jpg");
    }

    // HTML description becomes readable text: paragraphs separated by a blank line, <br> as a line break.
    @Test
    void turnsHtmlIntoPlainText() {
        LiveTicketsEvent html = event("Party", "<p><strong>Doors&nbsp;open</strong> at 22:00</p>\r\n<p>We&rsquo;re"
                + " back!<br />See you</p><p></p><p></p>", "2026-11-20T22:00:00", null);
        assertThat(mapper.toImportedEvent(html).orElseThrow().description())
                .isEqualTo("Doors open at 22:00\n\nWe’re back!\nSee you");
        assertThat(mapper.toImportedEvent(event("Party", "<p> </p>", "2026-11-20T22:00:00", null))
                .orElseThrow().description()).isNull();
    }

    // Category guesses: the title decides first, the description only when the title gives no clue.
    @ParameterizedTest
    @CsvSource(delimiter = '|', value = {
            "Efra x Medicina Party x Stoma Party | Live music all night | PARTY",
            "URSARU LIVE ÎN TIMISOARA            |                      | CONCERT",
            "CONCERT LANSARE ALBUM BEJI          |                      | CONCERT",
            "Stand-up comedy cu Micutzu          |                      | THEATRE",
            "Curs de prim ajutor la Timișoara    |                      | MEETUP",
            "ctrl Z @ Nemesis Art Club           |                      | PARTY",
            "Mama Dansează                       | Cea mai tare petrecere | PARTY",
            "Board games night                   |                      | GAMES",
            "Degustare de vin                    |                      | FOOD",
            "Ecologizare Parcul Rozelor          |                      | VOLUNTEER",
            "Food drive for the winter           |                      | VOLUNTEER",
            "Mama Dansează                       |                      | OTHER"})
    void guessesCategory(String title, String description, String expected) {
        assertThat(LiveTicketsEventMapperImpl.guessCategory(title, description)).isEqualTo(expected);
    }
}
