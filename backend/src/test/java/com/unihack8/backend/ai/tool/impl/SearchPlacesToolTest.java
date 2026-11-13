package com.unihack8.backend.ai.tool.impl;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.unihack8.backend.ai.domain.ToolContext;
import com.unihack8.backend.ai.tool.ToolException;
import com.unihack8.backend.common.geo.GeoPoint;
import com.unihack8.backend.places.domain.PlaceCategory;
import com.unihack8.backend.places.domain.PriceItemType;
import com.unihack8.backend.places.domain.dto.PlaceDetailDto;
import com.unihack8.backend.places.domain.dto.PlaceExploreCriteria;
import com.unihack8.backend.places.domain.dto.PlaceInsightDto;
import com.unihack8.backend.places.domain.dto.PriceDto;
import com.unihack8.backend.places.service.PlaceService;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

/** search_places: arguments, open-now filter, chain merging, cautions and remembered cards. */
class SearchPlacesToolTest {

    // Friday 2026-11-13 21:00 in Timisoara (19:00 UTC).
    private static final Instant FRIDAY_21H = Instant.parse("2026-11-13T19:00:00Z");
    private static final GeoPoint USER = new GeoPoint(45.7537, 21.2257);

    private final PlaceService places = mock(PlaceService.class);
    private final SearchPlacesTool tool = new SearchPlacesTool(places);

    // The model's arguments become explore criteria; the default centre is the user.
    @Test
    @SuppressWarnings("unchecked")
    void passesCriteria() {
        when(places.explore(any())).thenReturn(List.of());
        ToolContext context = new ToolContext(USER, FRIDAY_21H);

        Map<String, Object> answer = tool.execute(Map.of("categories", List.of("cafe"), "price_item_type", "coffee",
                "sort", "price", "radius_meters", 2000, "only_with_prices", true, "limit", 3), context);

        ArgumentCaptor<PlaceExploreCriteria> captor = ArgumentCaptor.forClass(PlaceExploreCriteria.class);
        verify(places).explore(captor.capture());
        PlaceExploreCriteria criteria = captor.getValue();
        assertThat(criteria.categories()).containsExactly(PlaceCategory.CAFE);
        assertThat(criteria.priceItemType()).isEqualTo(PriceItemType.COFFEE);
        assertThat(criteria.sortByPrice()).isTrue();
        assertThat(criteria.onlyWithPrices()).isTrue();
        assertThat(criteria.radiusMeters()).isEqualTo(2000);
        assertThat(criteria.near()).isEqualTo(USER);
        assertThat(answer).containsEntry("count", 0).containsKey("hint");
    }

    // Closed places are left out (counted), chain branches merged, prices and cautions shown, cards remembered.
    @Test
    @SuppressWarnings("unchecked")
    void filtersAndDescribes() {
        when(places.explore(any())).thenReturn(List.of(
                insight("5 to go", "Mo-Fr 07:00-19:00", 120, price("Espresso", "5.00", "national chain price")),
                insight("Ted's Coffee Co.", "Mo-Su 07:30-22:00", 300, price("Espresso", "12.00", "OTHER CITY: Bucharest listing")),
                insight("Ted's Coffee Co.", "Mo-Su 07:30-22:00", 900, price("Espresso", "12.00", "OTHER CITY: Bucharest listing")),
                insight("Night Owl", null, 400)));
        ToolContext context = new ToolContext(USER, FRIDAY_21H);

        Map<String, Object> answer = tool.execute(Map.of("categories", "cafe"), context);

        List<Map<String, Object>> results = (List<Map<String, Object>>) answer.get("places");
        assertThat(results).extracting(r -> r.get("name")).containsExactly("Ted's Coffee Co.", "Night Owl");
        assertThat(answer).containsEntry("closed_now_left_out", 1);
        Map<String, Object> teds = results.getFirst();
        assertThat(teds).containsEntry("open_now", true).containsEntry("closes_at", "22:00");
        List<Map<String, Object>> prices = (List<Map<String, Object>>) teds.get("prices");
        assertThat(prices.getFirst()).containsEntry("lei", new BigDecimal("12.00")).containsKey("caution");
        assertThat(results.get(1)).containsEntry("open_now", "unknown").containsEntry("prices", "none stored");
        assertThat(context.places()).hasSize(2);
        assertThat(context.places().getFirst().prices()).hasSize(1);
    }

    // open_now=false keeps closed places (questions about another time).
    @Test
    @SuppressWarnings("unchecked")
    void openNowFalseKeepsClosed() {
        when(places.explore(any())).thenReturn(List.of(insight("5 to go", "Mo-Fr 07:00-19:00", 120)));
        Map<String, Object> answer = tool.execute(Map.of("open_now", false), new ToolContext(USER, FRIDAY_21H));
        List<Map<String, Object>> results = (List<Map<String, Object>>) answer.get("places");
        assertThat(results.getFirst()).containsEntry("open_now", false);
    }

    // Unknown enum values are reported to the model, not thrown as server errors.
    @Test
    void badArguments() {
        ToolContext context = new ToolContext(USER, FRIDAY_21H);
        assertThatThrownBy(() -> tool.execute(Map.of("categories", List.of("boat")), context))
                .isInstanceOf(ToolException.class).hasMessageContaining("boat");
        assertThatThrownBy(() -> tool.execute(Map.of("price_item_type", "wine"), context))
                .isInstanceOf(ToolException.class).hasMessageContaining("wine");
    }

    // The declaration lists every category and price type.
    @Test
    @SuppressWarnings("unchecked")
    void declaration() {
        Map<String, Object> parameters = (Map<String, Object>) tool.declaration().get("parameters");
        Map<String, Object> properties = (Map<String, Object>) parameters.get("properties");
        assertThat(properties).containsKeys("categories", "keyword", "price_item_type", "sort", "open_now");
        assertThat(tool.declaration()).containsEntry("name", "search_places");
    }

    // A place result at the given distance.
    private static PlaceInsightDto insight(String name, String hours, int distance, PriceDto... prices) {
        return new PlaceInsightDto(new PlaceDetailDto(UUID.randomUUID(), "node/" + distance, name, "cafe",
                45.75, 21.22, null, hours, Map.of("cuisine", "coffee_shop")), distance, List.of(prices));
    }

    // A coffee price.
    private static PriceDto price(String item, String lei, String note) {
        return new PriceDto(item, "COFFEE", new BigDecimal(lei), null, "delivery_app", "https://x.ro", "2026-11", note);
    }
}
