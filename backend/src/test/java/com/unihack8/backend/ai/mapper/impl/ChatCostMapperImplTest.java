package com.unihack8.backend.ai.mapper.impl;

import static org.assertj.core.api.Assertions.assertThat;

import com.unihack8.backend.ai.domain.ToolContext;
import com.unihack8.backend.ai.domain.dto.ChatCostDto;
import com.unihack8.backend.ai.domain.dto.CostItemDto;
import com.unihack8.backend.events.domain.dto.EventSummary;
import com.unihack8.backend.places.domain.dto.PlaceSummaryDto;
import com.unihack8.backend.places.domain.dto.PriceDto;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/** The cost box of an AI answer: stored prices only, sums for one plan, averages across alternatives. */
class ChatCostMapperImplTest {

    private final ChatCostMapperImpl mapper = new ChatCostMapperImpl();

    // One place: the item the reply names is used, not the rest of the stored menu.
    @Test
    void namedItemOfOnePlace() {
        ToolContext.FoundPlace cafe = found("5 to go", price("Espresso", "5.00"), price("Latte", "9.00"));
        ChatCostDto cost = mapper.toCost("5 to go has an espresso for about 5 lei.", List.of(cafe), List.of());

        assertThat(cost.currency()).isEqualTo("RON");
        assertThat(cost.basis()).isEqualTo("TOTAL");
        assertThat(cost.items()).containsExactly(new CostItemDto("5 to go", "Espresso", "MENU", 5.0, 5.0, 5.0));
        assertThat(cost.averageTotalLei()).isEqualTo(5.0);
        assertThat(cost.minTotalLei()).isEqualTo(5.0);
        assertThat(cost.maxTotalLei()).isEqualTo(5.0);
        assertThat(cost.note()).contains("may have changed");
    }

    // No item named: the range of every stored price the tool returned, averaged as (min + max) / 2.
    @Test
    void noItemNamedUsesStoredRange() {
        ToolContext.FoundPlace pizza = found("Pizza Hut", price("Margherita", "30.00"), price("Diavola", "41.00"));
        ChatCostDto cost = mapper.toCost("Pizza Hut is close.", List.of(pizza), List.of());

        CostItemDto item = cost.items().getFirst();
        assertThat(item.detail()).isEqualTo("2 stored prices");
        assertThat(item.minLei()).isEqualTo(30.0);
        assertThat(item.maxLei()).isEqualTo(41.0);
        assertThat(item.averageLei()).isEqualTo(35.5);
        assertThat(cost.averageTotalLei()).isEqualTo(35.5);
    }

    // One place and one event make one plan: the totals are sums of the lines.
    @Test
    void placeAndEventAreSummed() {
        ToolContext.FoundPlace cafe = found("5 to go", price("Espresso", "5.00"));
        EventSummary concert = event("Jazz Night", "40", "60");
        ChatCostDto cost = mapper.toCost("Jazz Night, then an espresso at 5 to go.", List.of(cafe), List.of(concert));

        assertThat(cost.basis()).isEqualTo("TOTAL");
        assertThat(cost.items()).extracting(CostItemDto::kind).containsExactly("MENU", "EVENT");
        assertThat(cost.items().get(1)).isEqualTo(new CostItemDto("Jazz Night", "Ticket", "EVENT", 40.0, 60.0, 50.0));
        assertThat(cost.averageTotalLei()).isEqualTo(55.0);
        assertThat(cost.minTotalLei()).isEqualTo(45.0);
        assertThat(cost.maxTotalLei()).isEqualTo(65.0);
    }

    // Several places are alternatives: never summed, the average is across the options.
    @Test
    void alternativesAreAveragedNotSummed() {
        List<ToolContext.FoundPlace> places = List.of(
                found("5 to go", price("Espresso", "5.00")),
                found("Starbucks", price("Espresso", "9.00")),
                found("Cafea", price("Espresso", "7.50")));
        ChatCostDto cost = mapper.toCost("Espresso at 5 to go, Starbucks or Cafea.", places, List.of());

        assertThat(cost.basis()).isEqualTo("OPTIONS");
        assertThat(cost.items()).hasSize(3);
        assertThat(cost.averageTotalLei()).isEqualTo(7.2); // (5 + 9 + 7.5) / 3 = 7.17
        assertThat(cost.minTotalLei()).isEqualTo(5.0);
        assertThat(cost.maxTotalLei()).isEqualTo(9.0);
    }

    // Unpriced recommendations are named in the note; an alternative without price still keeps the OPTIONS basis.
    @Test
    void unpricedAreNamedInNote() {
        List<ToolContext.FoundPlace> places = List.of(found("5 to go", price("Espresso", "5.00")), found("Cafea"));
        ChatCostDto cost = mapper.toCost("5 to go or Cafea.", places, List.of());
        assertThat(cost.basis()).isEqualTo("OPTIONS");
        assertThat(cost.items()).hasSize(1);
        assertThat(cost.note()).contains("No stored price for Cafea.");

        ChatCostDto plan = mapper.toCost("Cafea, then Jazz.", List.of(found("Cafea")), List.of(event("Jazz", "20", null)));
        assertThat(plan.basis()).isEqualTo("TOTAL");
        assertThat(plan.averageTotalLei()).isEqualTo(20.0);
        assertThat(plan.note()).contains("Not included (price unknown): Cafea.").contains("ticket");
    }

    // Nothing with a stored price (or nothing recommended): no cost box, never a guess.
    @Test
    void nullWithoutStoredPrices() {
        assertThat(mapper.toCost("Espresso is about 6 lei at Cafea.", List.of(found("Cafea")), List.of())).isNull();
        assertThat(mapper.toCost("Free party!", List.of(), List.of(event("Party", null, null)))).isNull();
        assertThat(mapper.toCost("Hi", List.of(), List.of())).isNull();
    }

    // Two places (pick one) and one event: the meal options are averaged, then the ticket is added, never mixed.
    @Test
    void twoPlacesAndOneEventAverageWithinKindThenSum() {
        List<ToolContext.FoundPlace> places = List.of(
                found("Napoli", price("Margherita", "PIZZA", "36.00")),
                found("Pizza Hut", price("Margherita", "PIZZA", "44.00")));
        ChatCostDto cost = mapper.toCost("Napoli or Pizza Hut, then Rock Night.", places,
                List.of(event("Rock Night", "100", null)));

        assertThat(cost.basis()).isEqualTo("OPTIONS");
        assertThat(cost.items()).hasSize(3);
        assertThat(cost.averageTotalLei()).isEqualTo(140.0); // (36 + 44) / 2 + 100, not (36 + 44 + 100) / 3
        assertThat(cost.minTotalLei()).isEqualTo(136.0);
        assertThat(cost.maxTotalLei()).isEqualTo(144.0);
    }

    // One place and two events (pick one): the ticket options are averaged, then the place is added.
    @Test
    void onePlaceAndTwoEventsAverageWithinKindThenSum() {
        ChatCostDto cost = mapper.toCost("Jazz or Rock, then an espresso at 5 to go.",
                List.of(found("5 to go", price("Espresso", "5.00"))),
                List.of(event("Jazz", "40", "60"), event("Rock", "80", null)));

        assertThat(cost.basis()).isEqualTo("OPTIONS");
        assertThat(cost.averageTotalLei()).isEqualTo(70.0); // 5 + (50 + 80) / 2
        assertThat(cost.minTotalLei()).isEqualTo(45.0); // 5 + 40
        assertThat(cost.maxTotalLei()).isEqualTo(85.0); // 5 + 80
    }

    // No item named and the stored prices are a mixed menu (water, steak): no line, never their midpoint.
    @Test
    void mixedItemTypesWithoutNamedItemGiveNoLine() {
        ToolContext.FoundPlace bistro = found("Bistro", price("Water", "DRINK", "6.00"), price("Steak", "FOOD", "80.00"));
        assertThat(mapper.toCost("Bistro is close.", List.of(bistro), List.of())).isNull();

        ChatCostDto steak = mapper.toCost("Bistro has a great steak.", List.of(bistro), List.of());
        assertThat(steak.items()).containsExactly(new CostItemDto("Bistro", "Steak", "MENU", 80.0, 80.0, 80.0));
    }

    // Item names are matched only in the place's own part of the reply, not in what is said about another place.
    @Test
    void itemsAreMatchedInThePlacesOwnPart() {
        List<ToolContext.FoundPlace> places = List.of(
                found("Cafe A", price("Espresso", "5.00"), price("Cappuccino", "9.00")),
                found("Cafe B", price("Espresso", "7.00"), price("Cappuccino", "9.00")));
        ChatCostDto cost = mapper.toCost("Cafe A: espresso 5 lei. Cafe B: cappuccino 9 lei.", places, List.of());

        assertThat(cost.items()).extracting(CostItemDto::detail).containsExactly("Espresso", "Cappuccino");
        assertThat(cost.items()).extracting(CostItemDto::averageLei).containsExactly(5.0, 9.0);
    }

    // A single recommendation may name its item before its own name ("the espresso at 5 to go").
    @Test
    void singleRecommendationSearchesTheWholeReply() {
        ToolContext.FoundPlace cafe = found("5 to go", price("Espresso", "5.00"), price("Latte", "9.00"));
        ChatCostDto cost = mapper.toCost("Try the espresso at 5 to go.", List.of(cafe), List.of());
        assertThat(cost.items().getFirst().detail()).isEqualTo("Espresso");
    }

    // The part of the reply runs from the name to the next recommended name; an unknown position gives none.
    @Test
    void segmentRunsToTheNextName() {
        assertThat(ChatCostMapperImpl.segment("a x. b y.", 0, List.of(0, 5))).isEqualTo("a x. ");
        assertThat(ChatCostMapperImpl.segment("a x. b y.", 5, List.of(0, 5))).isEqualTo("b y.");
        assertThat(ChatCostMapperImpl.segment("a x.", -1, List.of())).isNull();
        assertThat(ChatCostMapperImpl.segment("a x.", Integer.MAX_VALUE, List.of())).isNull();
    }

    // Only one of price_min/price_max stored: used as both ends.
    @Test
    void eventWithOnePriceEnd() {
        assertThat(ChatCostMapperImpl.eventItem(event("Show", null, "35")).averageLei()).isEqualTo(35.0);
        assertThat(ChatCostMapperImpl.eventItem(event("Show", "0", null)).averageLei()).isEqualTo(0.0);
    }

    // A place with prices.
    private static ToolContext.FoundPlace found(String name, PriceDto... prices) {
        return new ToolContext.FoundPlace(new PlaceSummaryDto(UUID.randomUUID(), "node/1", name, "cafe", 45.75,
                21.22, null, 100), List.of(prices));
    }

    // A stored coffee price.
    private static PriceDto price(String item, String lei) {
        return price(item, "COFFEE", lei);
    }

    // A stored menu price of the given item type.
    private static PriceDto price(String item, String type, String lei) {
        return new PriceDto(item, type, new BigDecimal(lei), null, "delivery_app", null, "2026-11", null);
    }

    // An event with an optional price range.
    private static EventSummary event(String title, String min, String max) {
        return new EventSummary(UUID.randomUUID(), "EXTERNAL", title, "CONCERT", "Club", 45.75, 21.23,
                Instant.parse("2026-11-14T18:00:00Z"), null, null, min == null ? null : new BigDecimal(min),
                max == null ? null : new BigDecimal(max), null, null, null, 0);
    }
}
