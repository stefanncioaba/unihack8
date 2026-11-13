package com.unihack8.backend.places.controller;

import com.unihack8.backend.common.dto.PageParams;
import com.unihack8.backend.common.dto.PageResponse;
import com.unihack8.backend.common.exception.ApiException;
import com.unihack8.backend.common.exception.ErrorCode;
import com.unihack8.backend.common.geo.BoundingBox;
import com.unihack8.backend.common.geo.GeoPoint;
import com.unihack8.backend.places.domain.PlaceCategory;
import com.unihack8.backend.places.domain.dto.PlaceDetailDto;
import com.unihack8.backend.places.domain.dto.PlaceSearchCriteria;
import com.unihack8.backend.places.domain.dto.PlaceSummaryDto;
import com.unihack8.backend.places.service.PlaceService;
import java.util.Arrays;
import java.util.EnumSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Public place endpoints (PLAN 8.3, 8.4; docs/API.md -> Places). */
@RestController
@RequestMapping("/places")
public class PlaceController {

    private final PlaceService placeService;

    // Needs the place service.
    public PlaceController(PlaceService placeService) {
        this.placeService = placeService;
    }

    /**
     * GET /places — category (repeatable, or comma-separated), bbox, near + radius, q, page, size.
     * Sorted by distance with near, otherwise by name.
     */
    @GetMapping
    public PageResponse<PlaceSummaryDto> search(
            @RequestParam(required = false) List<String> category,
            @RequestParam(required = false) String bbox,
            @RequestParam(required = false) String near,
            @RequestParam(required = false) Integer radius,
            @RequestParam(required = false) String q,
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size) {
        BoundingBox box = bbox == null ? null : BoundingBox.parse(bbox, "bbox");
        GeoPoint point = near == null ? null : GeoPoint.parse(near, "near");
        PlaceSearchCriteria criteria = new PlaceSearchCriteria(
                parseCategories(category), box, point, parseRadius(radius, point), q);
        PageParams paging = box != null ? PageParams.forMap(page, size) : PageParams.of(page, size);
        return placeService.search(criteria, paging);
    }

    // GET /places/{id} — one place with details.
    @GetMapping("/{id}")
    public PlaceDetailDto get(@PathVariable UUID id) {
        return placeService.get(id);
    }

    // Turns "cafe", "bar,club" into categories; 400 naming the unknown value.
    private static Set<PlaceCategory> parseCategories(List<String> values) {
        Set<PlaceCategory> result = EnumSet.noneOf(PlaceCategory.class);
        if (values == null) {
            return result;
        }
        for (String value : values) {
            for (String name : value.split(",")) {
                if (name.isBlank()) {
                    continue;
                }
                result.add(PlaceCategory.fromApiName(name).orElseThrow(() -> new ApiException(
                        ErrorCode.VALIDATION_FAILED,
                        "Unknown category '" + name.trim() + "'. Use one of: " + allCategoryNames() + ".")));
            }
        }
        return result;
    }

    // Radius in meters: default 1500, max 10000, only meaningful with near.
    private static int parseRadius(Integer radius, GeoPoint near) {
        if (radius == null) {
            return PlaceSearchCriteria.DEFAULT_RADIUS_METERS;
        }
        if (near == null) {
            throw new ApiException(ErrorCode.VALIDATION_FAILED, "radius can only be used together with near.");
        }
        if (radius < 1 || radius > PlaceSearchCriteria.MAX_RADIUS_METERS) {
            throw new ApiException(ErrorCode.VALIDATION_FAILED,
                    "radius must be between 1 and " + PlaceSearchCriteria.MAX_RADIUS_METERS + " meters.");
        }
        return radius;
    }

    // "restaurant, cafe, ..." for error messages.
    private static String allCategoryNames() {
        return Arrays.stream(PlaceCategory.values()).map(PlaceCategory::apiName).collect(Collectors.joining(", "));
    }
}
