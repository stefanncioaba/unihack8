package com.unihack8.backend.ai.tool.impl;

import com.unihack8.backend.ai.domain.ToolContext;
import com.unihack8.backend.ai.tool.AiTool;
import com.unihack8.backend.ai.tool.ToolArgs;
import com.unihack8.backend.ai.tool.ToolException;
import com.unihack8.backend.common.geo.GeoPoint;
import com.unihack8.backend.common.text.TextMatch;
import com.unihack8.backend.places.domain.PlaceCategory;
import com.unihack8.backend.places.domain.PriceItemType;
import com.unihack8.backend.places.domain.dto.PlaceDetailDto;
import com.unihack8.backend.places.domain.dto.PlaceExploreCriteria;
import com.unihack8.backend.places.domain.dto.PlaceInsightDto;
import com.unihack8.backend.places.domain.dto.PlaceSearchCriteria;
import com.unihack8.backend.places.domain.dto.PlaceSummaryDto;
import com.unihack8.backend.places.domain.dto.PriceDto;
import com.unihack8.backend.places.service.PlaceService;
import com.unihack8.backend.places.domain.OpeningHours;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.EnumSet;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.stereotype.Component;

/**
 * search_places (PLAN 11.2, 11.3): places from our OpenStreetMap import with distance, opening
 * hours, cuisine and the stored menu prices. The only source of prices the model may quote.
 */
@Component
public class SearchPlacesTool implements AiTool {

    static final int DEFAULT_RADIUS = 1500;
    static final int DEFAULT_LIMIT = 8;
    static final int MAX_LIMIT = 15;
    // place_prices notes starting with this mark prices read on another city's listing of a chain.
    static final String OTHER_CITY_PREFIX = "OTHER CITY:";

    private final PlaceService placeService;

    // Needs the place service (task 8).
    public SearchPlacesTool(PlaceService placeService) {
        this.placeService = placeService;
    }

    // Tool name used by the model.
    @Override
    public String name() {
        return "search_places";
    }

    // Parameters: categories, keyword, price filters/sorting, radius, centre point, limit.
    @Override
    public Map<String, Object> declaration() {
        List<String> categories = Arrays.stream(PlaceCategory.values()).map(PlaceCategory::apiName).toList();
        List<String> priceTypes = Arrays.stream(PriceItemType.values()).map(Enum::name).toList();
        Map<String, Object> properties = new LinkedHashMap<>();
        properties.put("categories", Map.of("type", "array", "items", Map.of("type", "string", "enum", categories),
                "description", "Place types to include. Coffee -> cafe; pizza -> restaurant and fast_food; "
                        + "beer/drinks -> bar (and club at night). Empty = all types."));
        properties.put("keyword", Map.of("type", "string",
                "description", "Optional food/drink word or place name matched against name, cuisine and brand, "
                        + "e.g. \"pizza\", \"sushi\", \"burger\", \"Starbucks\". Leave empty when the category is enough "
                        + "(e.g. cafe for coffee)."));
        properties.put("price_item_type", Map.of("type", "string", "enum", priceTypes,
                "description", "Which stored prices to return and sort by: COFFEE, PIZZA, FOOD (meals, burgers, "
                        + "kebab), BEER or DRINK."));
        properties.put("sort", Map.of("type", "string", "enum", List.of("distance", "price"),
                "description", "distance = closest first (default); price = cheapest stored price first, places "
                        + "without a stored price after them."));
        properties.put("only_with_prices", Map.of("type", "boolean",
                "description", "Only return places that have a stored price (of price_item_type when given)."));
        properties.put("open_now", Map.of("type", "boolean",
                "description", "Default true: leave out places that are closed right now (places with unknown "
                        + "hours stay, marked). Set false when the user names a specific place or asks about "
                        + "another time."));
        properties.put("radius_meters", Map.of("type", "integer",
                "description", "Search radius in meters, default 1500, max 10000. Widen it if too few results."));
        properties.put("near_lat", Map.of("type", "number", "description", "Search centre latitude; default = the user."));
        properties.put("near_lon", Map.of("type", "number", "description", "Search centre longitude; default = the user."));
        properties.put("limit", Map.of("type", "integer", "description", "Max results, default 8, max 15."));
        return Map.of(
                "name", name(),
                "description", "Find restaurants, cafes, bars, fast food, clubs, pharmacies, supermarkets, parks, "
                        + "attractions or ATMs in Timisoara. Returns distance and walking minutes from the user, "
                        + "address, opening hours (OpenStreetMap format), cuisine and stored menu prices in lei "
                        + "(with source type and date). Use it for every question about places, food, drinks or prices.",
                "parameters", Map.of("type", "object", "properties", properties));
    }

    // Runs the search and remembers the results for the answer cards.
    @Override
    public Map<String, Object> execute(Map<String, Object> args, ToolContext context) {
        Set<PlaceCategory> categories = EnumSet.noneOf(PlaceCategory.class);
        for (String value : ToolArgs.texts(args, "categories")) {
            categories.add(PlaceCategory.fromApiName(value)
                    .orElseThrow(() -> new ToolException("unknown category " + value)));
        }
        String priceTypeText = ToolArgs.text(args, "price_item_type");
        PriceItemType priceType = priceTypeText == null ? null : PriceItemType.parse(priceTypeText)
                .orElseThrow(() -> new ToolException("unknown price_item_type " + priceTypeText));
        GeoPoint centre = ToolArgs.point(args, "near");
        GeoPoint near = centre == null ? context.origin() : centre;
        int radius = ToolArgs.integer(args, "radius_meters", DEFAULT_RADIUS, 100, PlaceSearchCriteria.MAX_RADIUS_METERS);
        int limit = ToolArgs.integer(args, "limit", DEFAULT_LIMIT, 1, MAX_LIMIT);
        boolean byPrice = "price".equalsIgnoreCase(ToolArgs.text(args, "sort"));

        // Ask for more than needed: chain branches are merged below (only the nearest/cheapest is kept).
        List<PlaceInsightDto> found = placeService.explore(new PlaceExploreCriteria(categories,
                ToolArgs.text(args, "keyword"), near, radius, priceType,
                ToolArgs.bool(args, "only_with_prices", false), byPrice, limit * 4));

        boolean openNowOnly = ToolArgs.bool(args, "open_now", true);
        LocalDateTime localNow = LocalDateTime.ofInstant(context.now(), ToolContext.ZONE);
        Set<String> seenNames = new HashSet<>();
        int closedSkipped = 0;
        List<Map<String, Object>> results = new ArrayList<>();
        for (PlaceInsightDto place : found) {
            if (results.size() >= limit) {
                break;
            }
            OpeningHours.Status status = OpeningHours.at(place.place().openingHours(), localNow);
            if (openNowOnly && Boolean.FALSE.equals(status.open())) {
                closedSkipped++;
                continue;
            }
            if (seenNames.add(TextMatch.normalize(place.place().name()))) {
                results.add(describe(place, status, context));
            }
        }

        Map<String, Object> answer = new LinkedHashMap<>();
        answer.put("search_centre", centre == null
                ? (context.locationKnown() ? "user location" : "city centre (user location unknown)")
                : "given point");
        answer.put("radius_meters", radius);
        answer.put("local_time_now", ToolArgs.localTime(context.now()));
        answer.put("order", byPrice ? "cheapest stored price first (keep this order)" : "closest first");
        answer.put("count", results.size());
        if (closedSkipped > 0) {
            answer.put("closed_now_left_out", closedSkipped);
        }
        answer.put("places", results);
        if (results.isEmpty()) {
            answer.put("hint", closedSkipped > 0
                    ? "Every match is closed now. Say so, and try a bigger radius_meters or open_now=false for later."
                    : "Nothing found. Try a bigger radius_meters, fewer filters or another keyword.");
        }
        return answer;
    }

    // Compact view of one place for the model; also remembered for the response cards.
    private static Map<String, Object> describe(PlaceInsightDto found, OpeningHours.Status status,
                                                ToolContext context) {
        PlaceDetailDto place = found.place();
        int fromUser = (int) Math.round(context.origin().distanceMetersTo(new GeoPoint(place.lat(), place.lon())));
        context.rememberPlace(new PlaceSummaryDto(place.id(), place.osmId(), place.name(), place.category(),
                place.lat(), place.lon(), place.address(), fromUser), found.prices());

        Map<String, Object> view = new LinkedHashMap<>();
        view.put("id", place.id().toString());
        view.put("name", place.name());
        view.put("category", place.category());
        view.put("distance_meters", fromUser);
        view.put("walk_minutes", ToolArgs.walkMinutes(fromUser));
        view.put("lat", place.lat());
        view.put("lon", place.lon());
        putIfPresent(view, "address", place.address());
        view.put("opening_hours", place.openingHours() == null ? "unknown" : place.openingHours());
        if (status.open() == null) {
            view.put("open_now", "unknown");
        } else {
            view.put("open_now", status.open());
            if (status.until() != null) {
                view.put(status.open() ? "closes_at" : "opens_at", status.until());
            }
        }
        Map<String, String> tags = place.tags() == null ? Map.of() : place.tags();
        putIfPresent(view, "cuisine", tags.get("cuisine"));
        putIfPresent(view, "brand", tags.get("brand"));
        putIfPresent(view, "outdoor_seating", tags.get("outdoor_seating"));
        putIfPresent(view, "takeaway", tags.get("takeaway"));
        view.put("prices", found.prices().isEmpty() ? "none stored" : found.prices().stream().map(SearchPlacesTool::price).toList());
        return view;
    }

    // One stored price for the model.
    private static Map<String, Object> price(PriceDto price) {
        Map<String, Object> view = new LinkedHashMap<>();
        view.put("item", price.item());
        view.put("type", price.itemType());
        view.put("lei", price.priceLei());
        putIfPresent(view, "size", price.size());
        view.put("source", price.sourceType());
        putIfPresent(view, "source_date", price.sourceDate());
        putIfPresent(view, "note", price.note());
        if (price.note() != null && price.note().startsWith(OTHER_CITY_PREFIX)) {
            view.put("caution", "price seen on this chain's listing in another city; it may differ in Timisoara");
        }
        return view;
    }

    // Adds a value only when it is not blank.
    private static void putIfPresent(Map<String, Object> map, String key, Object value) {
        if (value != null && !value.toString().isBlank()) {
            map.put(key, value);
        }
    }
}
