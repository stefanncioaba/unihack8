package com.unihack8.backend.ai.mapper.impl;

import com.unihack8.backend.ai.domain.ToolContext;
import com.unihack8.backend.ai.domain.dto.ChatCostDto;
import com.unihack8.backend.ai.domain.dto.CostItemDto;
import com.unihack8.backend.ai.mapper.ChatCostMapper;
import com.unihack8.backend.common.text.TextMatch;
import com.unihack8.backend.events.domain.dto.EventSummary;
import com.unihack8.backend.places.domain.dto.PriceDto;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;
import org.springframework.stereotype.Component;

/**
 * The cost box of an AI answer (docs/API.md -> AI assistant, `cost`). Only stored prices the tools returned
 * are used (PLAN 20: never a price from memory or a guess), and only for the places/events the answer
 * recommends (its result cards).
 * <ul>
 *   <li>A place: the stored prices whose item its part of the reply names ("espresso"), its part running from
 *       its name to the next recommended name (the whole reply when it is the only recommendation). When none
 *       is named, every stored price the tools returned for it, but only if they are all of one item type
 *       (e.g. PIZZA); mixed types (a whole menu) give no line, so a water and a steak are never averaged.
 *       Its line spans the lowest to the highest of the chosen prices.</li>
 *   <li>An event: its price_min..price_max (one of them alone is used as both).</li>
 *   <li>Line average = (min + max) / 2.</li>
 *   <li>The lines are grouped by kind (places, events). Within a group the user picks one, so the group
 *       counts with the mean of its line averages, its cheapest min and its dearest max. The totals are the
 *       sums over the groups: one place and one event ("concert, then pizza") are added up, alternatives of
 *       one kind are never summed.</li>
 *   <li>Basis TOTAL when every group has at most one recommendation, OPTIONS when one has two or more.</li>
 * </ul>
 */
@Component
public class ChatCostMapperImpl implements ChatCostMapper {

    static final String CURRENCY = "RON";
    static final String TOTAL = "TOTAL";
    static final String OPTIONS = "OPTIONS";
    static final String KIND_MENU = "MENU";
    static final String KIND_EVENT = "EVENT";
    // Item names shorter than this are too likely to match ordinary words in the reply.
    private static final int MIN_ITEM_NAME_LENGTH = 3;

    // Builds the cost box, or null when nothing recommended has a stored price.
    @Override
    public ChatCostDto toCost(String plainReply, List<ToolContext.FoundPlace> places, List<Integer> placePositions,
                              List<EventSummary> events, List<Integer> eventPositions) {
        String reply = TextMatch.normalize(plainReply);
        List<Integer> boundaries = new ArrayList<>(placePositions);
        boundaries.addAll(eventPositions);
        boolean single = places.size() + events.size() == 1;
        List<CostItemDto> menuItems = new ArrayList<>();
        List<CostItemDto> eventItems = new ArrayList<>();
        List<String> unpriced = new ArrayList<>();
        for (int i = 0; i < places.size(); i++) {
            ToolContext.FoundPlace found = places.get(i);
            int position = i < placePositions.size() ? placePositions.get(i) : -1;
            CostItemDto item = placeItem(found, reply, segment(reply, position, boundaries), single);
            if (item == null) {
                unpriced.add(found.place().name());
            } else {
                menuItems.add(item);
            }
        }
        for (EventSummary event : events) {
            CostItemDto item = eventItem(event);
            if (item == null) {
                unpriced.add(event.title());
            } else {
                eventItems.add(item);
            }
        }
        List<CostItemDto> items = new ArrayList<>(menuItems);
        items.addAll(eventItems);
        if (items.isEmpty()) {
            return null;
        }
        boolean options = places.size() > 1 || events.size() > 1;
        double average = 0;
        double min = 0;
        double max = 0;
        for (List<CostItemDto> group : List.of(menuItems, eventItems)) {
            if (group.isEmpty()) {
                continue;
            }
            average += group.stream().mapToDouble(CostItemDto::averageLei).average().orElse(0);
            min += group.stream().mapToDouble(CostItemDto::minLei).min().orElse(0);
            max += group.stream().mapToDouble(CostItemDto::maxLei).max().orElse(0);
        }
        return new ChatCostDto(CURRENCY, options ? OPTIONS : TOTAL, List.copyOf(items), round(average), round(min),
                round(max), note(items, unpriced, options));
    }

    // The part of the reply from a name's position to the next recommended name, or null when the position is unknown.
    static String segment(String normalizedReply, int position, List<Integer> boundaries) {
        if (position < 0 || position >= normalizedReply.length()) {
            return null;
        }
        int end = boundaries.stream().filter(b -> b > position && b <= normalizedReply.length())
                .min(Integer::compare).orElse(normalizedReply.length());
        return normalizedReply.substring(position, end);
    }

    // The priced line of a place, or null when it has no usable stored price. segment is its part of the reply
    // (null when unknown); the whole reply is searched too when it is the only recommendation or the part is unknown.
    static CostItemDto placeItem(ToolContext.FoundPlace found, String normalizedReply, String segment, boolean single) {
        List<PriceDto> stored = found.prices().stream()
                .filter(p -> p.priceLei() != null && p.priceLei().signum() >= 0)
                .toList();
        if (stored.isEmpty()) {
            return null;
        }
        List<PriceDto> named = segment == null ? List.of()
                : stored.stream().filter(p -> namedIn(p.item(), segment)).toList();
        if (named.isEmpty() && (segment == null || single)) {
            named = stored.stream().filter(p -> namedIn(p.item(), normalizedReply)).toList();
        }
        List<PriceDto> chosen;
        if (!named.isEmpty()) {
            chosen = named;
        } else if (oneItemType(stored)) {
            chosen = stored;
        } else {
            return null;
        }
        double min = chosen.stream().map(PriceDto::priceLei).mapToDouble(BigDecimal::doubleValue).min().orElse(0);
        double max = chosen.stream().map(PriceDto::priceLei).mapToDouble(BigDecimal::doubleValue).max().orElse(0);
        String detail;
        if (chosen.size() == 1) {
            detail = chosen.getFirst().item();
        } else if (!named.isEmpty()) {
            detail = String.join(", ", chosen.stream().map(PriceDto::item).distinct().toList());
        } else {
            detail = chosen.size() + " stored prices";
        }
        return new CostItemDto(found.place().name(), detail, KIND_MENU, round(min), round(max), round((min + max) / 2));
    }

    // True when every price has the same, known item type (a PIZZA search), not a whole mixed menu.
    private static boolean oneItemType(List<PriceDto> prices) {
        String first = prices.getFirst().itemType();
        return first != null && prices.stream().allMatch(p -> first.equalsIgnoreCase(p.itemType()));
    }

    // The priced line of an event, or null when it has no stored price.
    static CostItemDto eventItem(EventSummary event) {
        BigDecimal low = event.priceMin() != null ? event.priceMin() : event.priceMax();
        BigDecimal high = event.priceMax() != null ? event.priceMax() : event.priceMin();
        if (low == null || low.signum() < 0) {
            return null;
        }
        double min = Math.min(low.doubleValue(), high.doubleValue());
        double max = Math.max(low.doubleValue(), high.doubleValue());
        return new CostItemDto(event.title(), "Ticket", KIND_EVENT, round(min), round(max), round((min + max) / 2));
    }

    // True when the reply names the item as a whole word ("espresso" in "an espresso is 5 lei").
    private static boolean namedIn(String item, String normalizedReply) {
        String name = TextMatch.normalize(item);
        if (name.length() < MIN_ITEM_NAME_LENGTH) {
            return false;
        }
        return Pattern.compile("(?<![\\p{L}\\p{N}])" + Pattern.quote(name) + "(?![\\p{L}\\p{N}])")
                .matcher(normalizedReply).find();
    }

    // Short remark: menu prices may have changed, and which recommended items have no stored price.
    private static String note(List<CostItemDto> items, List<String> unpriced, boolean options) {
        List<String> parts = new ArrayList<>();
        if (items.stream().anyMatch(i -> KIND_MENU.equals(i.kind()))) {
            parts.add("Saved menu prices (often from delivery apps); they may have changed.");
        } else {
            parts.add("Saved ticket prices; they may have changed.");
        }
        if (!unpriced.isEmpty()) {
            parts.add((options ? "No stored price for " : "Not included (price unknown): ")
                    + String.join(", ", unpriced) + ".");
        }
        return String.join(" ", parts);
    }

    // Rounded to 0.1 lei.
    static double round(double lei) {
        return Math.round(lei * 10) / 10.0;
    }
}
