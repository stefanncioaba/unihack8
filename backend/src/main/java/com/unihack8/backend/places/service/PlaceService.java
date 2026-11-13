package com.unihack8.backend.places.service;

import com.unihack8.backend.common.dto.PageParams;
import com.unihack8.backend.common.dto.PageResponse;
import com.unihack8.backend.places.domain.dto.PlaceDetailDto;
import com.unihack8.backend.places.domain.dto.PlaceSearchCriteria;
import com.unihack8.backend.places.domain.dto.PlaceSummaryDto;
import com.unihack8.backend.places.domain.dto.PlaceExploreCriteria;
import com.unihack8.backend.places.domain.dto.PlaceInsightDto;
import java.util.List;
import java.util.UUID;

/** Reading places (PLAN 8.3, 8.4). Also used by the AI assistant's search_places tool (PLAN 11.2). */
public interface PlaceService {

    // Filtered, paged places: by distance when criteria.near is set, otherwise by name.
    PageResponse<PlaceSummaryDto> search(PlaceSearchCriteria criteria, PageParams page);

    // One place with details; 404 NOT_FOUND when the id is unknown.
    PlaceDetailDto get(UUID id);

    // AI assistant search (PLAN 11.2/11.3): keyword also matches cuisine/brand tags, results carry stored prices.
    List<PlaceInsightDto> explore(PlaceExploreCriteria criteria);
}
