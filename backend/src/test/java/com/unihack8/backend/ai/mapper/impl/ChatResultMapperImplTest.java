package com.unihack8.backend.ai.mapper.impl;

import static org.assertj.core.api.Assertions.assertThat;

import com.unihack8.backend.ai.domain.ToolContext;
import com.unihack8.backend.ai.domain.dto.ChatResponse;
import com.unihack8.backend.events.domain.dto.EventSummary;
import com.unihack8.backend.places.domain.dto.PlaceSummaryDto;
import com.unihack8.backend.places.domain.dto.PriceDto;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/** Picking the places/events a reply names (PLAN 11.5). */
class ChatResultMapperImplTest {

    private final ChatResultMapperImpl mapper = new ChatResultMapperImpl();

    // Bold names select the cards, in reply order; markdown is removed; price sources are listed once.
    @Test
    void boldNamesInReplyOrder() {
        ToolContext context = context();
        ChatResponse response = mapper.toResponse(
                "Try **Starbucks** (8.90 lei) or **5 to go** (5 lei). Cafea is cheap at `home`.", context);

        assertThat(response.reply()).isEqualTo("Try Starbucks (8.90 lei) or 5 to go (5 lei). Cafea is cheap at home.");
        assertThat(response.places()).extracting(PlaceSummaryDto::name).containsExactly("Starbucks", "5 to go");
        assertThat(response.sources()).extracting(s -> s.url())
                .containsExactly("https://glovoapp.com/starbucks", "https://playtech.ro/5togo");
        assertThat(response.sources().getFirst().title()).isEqualTo("Starbucks prices (glovoapp.com)");
        // "Cafea" is a place too, but it was not bold, so it is not a card.
        assertThat(response.places()).extracting(PlaceSummaryDto::name).doesNotContain("Cafea");
    }

    // Without any bold text, whole-word name matches are used; short names never match.
    @Test
    void plainTextFallback() {
        ToolContext context = context();
        ChatResponse response = mapper.toResponse("5 to go has espresso; the Starbucksy shop does not exist.", context);
        assertThat(response.places()).extracting(PlaceSummaryDto::name).containsExactly("5 to go");
    }

    // Events are matched the same way, even when the model shortens the bold title.
    @Test
    void events() {
        ToolContext context = context();
        EventSummary event = new EventSummary(UUID.randomUUID(), "EXTERNAL", "Jazz Night at Scârț", "CONCERT",
                "Scârț", 45.75, 21.23, Instant.parse("2026-11-14T18:00:00Z"), null, null, null, null, null, null);
        context.rememberEvent(event);
        ChatResponse response = mapper.toResponse("Go to **Jazz Night** on Saturday.", context);
        assertThat(response.events()).containsExactly(event);
        assertThat(response.places()).isEmpty();
    }

    // Nothing remembered or mentioned gives empty lists, never null.
    @Test
    void nothingMentioned() {
        ChatResponse response = mapper.toResponse("I can only help with Timisoara.", context());
        assertThat(response.places()).isEmpty();
        assertThat(response.events()).isEmpty();
        assertThat(response.sources()).isEmpty();
    }

    // Three remembered places, two with prices.
    private static ToolContext context() {
        ToolContext context = new ToolContext(null, Instant.parse("2026-11-14T10:00:00Z"));
        context.rememberPlace(place("Starbucks"), List.of(price("https://glovoapp.com/starbucks")));
        context.rememberPlace(place("5 to go"), List.of(price("https://playtech.ro/5togo"), price("https://playtech.ro/5togo")));
        context.rememberPlace(place("Cafea"), List.of());
        return context;
    }

    // Minimal place summary.
    private static PlaceSummaryDto place(String name) {
        return new PlaceSummaryDto(UUID.randomUUID(), "node/" + name.hashCode(), name, "cafe", 45.75, 21.22, null, 100);
    }

    // Minimal price row.
    private static PriceDto price(String url) {
        return new PriceDto("Espresso", "COFFEE", new BigDecimal("5.00"), null, "delivery_app", url, "2026-11", null);
    }
}
