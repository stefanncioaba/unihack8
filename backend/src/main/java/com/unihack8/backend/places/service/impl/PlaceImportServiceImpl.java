package com.unihack8.backend.places.service.impl;

import com.unihack8.backend.places.client.OverpassClient;
import com.unihack8.backend.places.client.dto.OverpassElement;
import com.unihack8.backend.places.domain.OsmPlaceData;
import com.unihack8.backend.places.domain.entity.Place;
import com.unihack8.backend.places.mapper.OsmElementMapper;
import com.unihack8.backend.places.repository.PlaceRepository;
import com.unihack8.backend.places.service.PlaceImportService;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Upserts OpenStreetMap places by osmId. The download happens outside the database transaction
 * so no connection is held while Overpass is slow.
 */
@Service
public class PlaceImportServiceImpl implements PlaceImportService {

    private static final Logger log = LoggerFactory.getLogger(PlaceImportServiceImpl.class);

    private final OverpassClient overpassClient;
    private final OsmElementMapper osmElementMapper;
    private final PlaceRepository placeRepository;
    private final TransactionTemplate transactionTemplate;

    // Wires the Overpass client, the element mapper, the repository and a transaction helper.
    public PlaceImportServiceImpl(OverpassClient overpassClient, OsmElementMapper osmElementMapper,
                                  PlaceRepository placeRepository, PlatformTransactionManager transactionManager) {
        this.overpassClient = overpassClient;
        this.osmElementMapper = osmElementMapper;
        this.placeRepository = placeRepository;
        this.transactionTemplate = new TransactionTemplate(transactionManager);
    }

    // Downloads from Overpass, then stores the result in one transaction.
    @Override
    public Result importPlaces() {
        List<OverpassElement> elements = overpassClient.fetchPlaces().elements();
        return importElements(elements);
    }

    // Maps, de-duplicates and upserts the elements; deletes vanished places only if something valid came back.
    @Override
    public Result importElements(List<OverpassElement> elements) {
        List<OverpassElement> input = elements == null ? List.of() : elements;
        Result result = transactionTemplate.execute(status -> store(input));
        log.info("Places import: fetched={} inserted={} updated={} skipped={} removed={}",
                result.fetched(), result.inserted(), result.updated(), result.skipped(), result.removed());
        return result;
    }

    // The database part of the import (runs inside a transaction).
    private Result store(List<OverpassElement> elements) {
        // Valid places by osmId; the first occurrence wins if Overpass repeats an element.
        Map<String, OsmPlaceData> incoming = new LinkedHashMap<>();
        for (OverpassElement element : elements) {
            osmElementMapper.toPlaceData(element).ifPresent(data -> incoming.putIfAbsent(data.osmId(), data));
        }
        int skipped = elements.size() - incoming.size();
        if (incoming.isEmpty()) {
            // Nothing usable came back: keep the table as it is rather than wiping it.
            return new Result(elements.size(), 0, 0, skipped, 0);
        }

        Map<String, Place> existing = placeRepository.findByOsmIdIn(incoming.keySet()).stream()
                .collect(Collectors.toMap(Place::getOsmId, Function.identity()));
        List<Place> toSave = new ArrayList<>(incoming.size());
        int inserted = 0;
        for (OsmPlaceData data : incoming.values()) {
            Place place = existing.get(data.osmId());
            if (place == null) {
                place = new Place(data.osmId());
                inserted++;
            }
            data.applyTo(place);
            toSave.add(place);
        }
        placeRepository.saveAll(toSave);

        List<Place> vanished = placeRepository.findByOsmIdNotIn(incoming.keySet());
        placeRepository.deleteAll(vanished);
        return new Result(elements.size(), inserted, existing.size(), skipped, vanished.size());
    }
}
