package com.unihack8.backend.places.service.impl;

import com.unihack8.backend.common.dto.PageParams;
import com.unihack8.backend.common.dto.PageResponse;
import com.unihack8.backend.common.exception.ApiException;
import com.unihack8.backend.common.geo.BoundingBox;
import com.unihack8.backend.common.geo.GeoPoint;
import com.unihack8.backend.common.text.TextMatch;
import com.unihack8.backend.places.domain.dto.PlaceDetailDto;
import com.unihack8.backend.places.domain.dto.PlaceExploreCriteria;
import com.unihack8.backend.places.domain.dto.PlaceInsightDto;
import com.unihack8.backend.places.domain.dto.PlaceSearchCriteria;
import com.unihack8.backend.places.domain.dto.PlaceSummaryDto;
import com.unihack8.backend.places.domain.dto.PriceDto;
import com.unihack8.backend.places.domain.entity.Place;
import com.unihack8.backend.places.domain.entity.PlacePrice;
import com.unihack8.backend.places.mapper.PlaceMapper;
import com.unihack8.backend.places.repository.PlacePriceRepository;
import com.unihack8.backend.places.repository.PlaceRepository;
import com.unihack8.backend.places.service.PlaceService;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Place search. Category, viewport and name filters run in the database. "Near" searches first
 * narrow to a box around the point in the database, then measure exact distances in Java — the
 * city has about a thousand places, so this stays fast and works on any database.
 */
@Service
@Transactional(readOnly = true)
public class PlaceServiceImpl implements PlaceService {

    private final PlaceRepository places;
    private final PlacePriceRepository prices;
    private final PlaceMapper mapper;

    // Needs the place and price repositories and the DTO mapper.
    public PlaceServiceImpl(PlaceRepository places, PlacePriceRepository prices, PlaceMapper mapper) {
        this.places = places;
        this.prices = prices;
        this.mapper = mapper;
    }

    // Places within the radius matching the keyword, with their stored prices, sorted by distance or price.
    @Override
    public List<PlaceInsightDto> explore(PlaceExploreCriteria criteria) {
        GeoPoint near = criteria.near();
        Specification<Place> filters = PlaceSpecifications.matching(
                        new PlaceSearchCriteria(criteria.categories(), null, null, criteria.radiusMeters(), null))
                .and(PlaceSpecifications.inBox(near.boxAround(criteria.radiusMeters())));
        List<PlaceWithDistance> candidates = places.findAll(filters).stream()
                .filter(place -> criteria.keyword() == null
                        || TextMatch.containsAnyWord(searchableText(place), criteria.keyword()))
                .map(place -> new PlaceWithDistance(place,
                        near.distanceMetersTo(new GeoPoint(place.getLat(), place.getLon()))))
                .filter(p -> p.distanceMeters() <= criteria.radiusMeters())
                .toList();

        Map<String, List<PlacePrice>> pricesByName = loadPrices(candidates);
        List<PlaceInsightDto> results = new ArrayList<>();
        for (PlaceWithDistance candidate : candidates) {
            List<PriceDto> placePrices = pricesFor(candidate.place(), pricesByName).stream()
                    .filter(price -> criteria.priceItemType() == null
                            || criteria.priceItemType().name().equals(price.getItemType()))
                    .map(mapper::toPrice)
                    .toList();
            if (criteria.onlyWithPrices() && placePrices.isEmpty()) {
                continue;
            }
            results.add(new PlaceInsightDto(mapper.toDetail(candidate.place()),
                    (int) Math.round(candidate.distanceMeters()), placePrices));
        }
        Comparator<PlaceInsightDto> byDistance = Comparator.comparingInt(PlaceInsightDto::distanceMeters)
                .thenComparing(p -> p.place().name());
        Comparator<PlaceInsightDto> order = criteria.sortByPrice()
                ? Comparator.comparing(PlaceServiceImpl::cheapest, Comparator.nullsLast(Comparator.naturalOrder()))
                        .thenComparing(byDistance)
                : byDistance;
        return results.stream().sorted(order).limit(Math.max(1, criteria.limit())).toList();
    }

    // Name, cuisine, brand and description joined, so one keyword can match any of them.
    private static String searchableText(Place place) {
        Map<String, String> tags = place.getTags() == null ? Map.of() : place.getTags();
        return String.join(" ", place.getName(),
                tags.getOrDefault("cuisine", "").replace('_', ' '),
                tags.getOrDefault("brand", ""),
                tags.getOrDefault("description", ""));
    }

    // One query for the prices of every candidate (matched by lower-case name or brand).
    private Map<String, List<PlacePrice>> loadPrices(List<PlaceWithDistance> candidates) {
        Set<String> names = new HashSet<>();
        for (PlaceWithDistance candidate : candidates) {
            names.addAll(priceKeys(candidate.place()));
        }
        if (names.isEmpty()) {
            return Map.of();
        }
        Map<String, List<PlacePrice>> byName = new HashMap<>();
        for (PlacePrice price : prices.findByLowerPlaceNameIn(names)) {
            byName.computeIfAbsent(price.getPlaceName().toLowerCase(Locale.ROOT), k -> new ArrayList<>()).add(price);
        }
        return byName;
    }

    // Prices stored under the place's name, or else under its brand (chains), cheapest first.
    private static List<PlacePrice> pricesFor(Place place, Map<String, List<PlacePrice>> pricesByName) {
        for (String key : priceKeys(place)) {
            List<PlacePrice> found = pricesByName.get(key);
            if (found != null) {
                return found.stream().sorted(Comparator.comparing(PlacePrice::getPriceLei)).toList();
            }
        }
        return List.of();
    }

    // Lower-case name first, then brand.
    private static List<String> priceKeys(Place place) {
        List<String> keys = new ArrayList<>();
        keys.add(place.getName().toLowerCase(Locale.ROOT));
        String brand = place.getTags() == null ? null : place.getTags().get("brand");
        if (brand != null && !brand.isBlank()) {
            keys.add(brand.toLowerCase(Locale.ROOT));
        }
        return keys;
    }

    // Lowest stored price of a result, or null when it has none.
    private static BigDecimal cheapest(PlaceInsightDto place) {
        return place.prices().stream().map(PriceDto::priceLei).min(Comparator.naturalOrder()).orElse(null);
    }

    // Chooses the distance search or the name-sorted database search.
    @Override
    public PageResponse<PlaceSummaryDto> search(PlaceSearchCriteria criteria, PageParams page) {
        Specification<Place> filters = PlaceSpecifications.matching(criteria);
        if (criteria.near() != null) {
            return searchNear(criteria, filters, page);
        }
        Page<Place> result = places.findAll(filters, page.toPageable(Sort.by("name").and(Sort.by("id"))));
        return PageResponse.of(result, place -> mapper.toSummary(place, null));
    }

    // Loads one place or answers 404.
    @Override
    public PlaceDetailDto get(UUID id) {
        return places.findById(id)
                .map(mapper::toDetail)
                .orElseThrow(() -> ApiException.notFound("Place"));
    }

    // Places within the radius of criteria.near, closest first, paged in memory.
    private PageResponse<PlaceSummaryDto> searchNear(PlaceSearchCriteria criteria, Specification<Place> filters,
                                                     PageParams page) {
        GeoPoint near = criteria.near();
        BoundingBox around = near.boxAround(criteria.radiusMeters());
        List<PlaceWithDistance> inRadius = places.findAll(filters.and(PlaceSpecifications.inBox(around))).stream()
                .map(place -> new PlaceWithDistance(place, near.distanceMetersTo(new GeoPoint(place.getLat(), place.getLon()))))
                .filter(p -> p.distanceMeters() <= criteria.radiusMeters())
                .sorted(Comparator.comparingDouble(PlaceWithDistance::distanceMeters)
                        .thenComparing(p -> p.place().getName()))
                .toList();

        int from = Math.min(page.page() * page.size(), inRadius.size());
        int to = Math.min(from + page.size(), inRadius.size());
        List<PlaceSummaryDto> items = inRadius.subList(from, to).stream()
                .map(p -> mapper.toSummary(p.place(), (int) Math.round(p.distanceMeters())))
                .toList();
        int totalPages = (int) Math.ceil(inRadius.size() / (double) page.size());
        return new PageResponse<>(items, page.page(), page.size(), inRadius.size(), totalPages);
    }

    /** A place with its distance from the search point, in meters. */
    private record PlaceWithDistance(Place place, double distanceMeters) {
    }
}
