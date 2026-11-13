package com.unihack8.backend.places.service.impl;

import com.unihack8.backend.common.dto.PageParams;
import com.unihack8.backend.common.dto.PageResponse;
import com.unihack8.backend.common.exception.ApiException;
import com.unihack8.backend.common.geo.BoundingBox;
import com.unihack8.backend.common.geo.GeoPoint;
import com.unihack8.backend.places.domain.dto.PlaceDetailDto;
import com.unihack8.backend.places.domain.dto.PlaceSearchCriteria;
import com.unihack8.backend.places.domain.dto.PlaceSummaryDto;
import com.unihack8.backend.places.domain.entity.Place;
import com.unihack8.backend.places.mapper.PlaceMapper;
import com.unihack8.backend.places.repository.PlaceRepository;
import com.unihack8.backend.places.service.PlaceService;
import java.util.Comparator;
import java.util.List;
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
    private final PlaceMapper mapper;

    // Needs the repository and the DTO mapper.
    public PlaceServiceImpl(PlaceRepository places, PlaceMapper mapper) {
        this.places = places;
        this.mapper = mapper;
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
